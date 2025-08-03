import { useEffect, useState, useCallback, useRef } from 'react';
import { СообщениеВебСокета, Пользователь, Комната } from '@/types';

interface UseSocketProps {
  серверUrl: string;
  пользователь: Пользователь | null;
  на_обновление_пользователей?: (пользователи: Пользователь[]) => void;
  на_обновление_комнат?: (комнаты: Комната[]) => void;
  на_ошибку?: (ошибка: string) => void;
}

export const useSocket = ({
  серверUrl,
  пользователь,
  на_обновление_пользователей,
  на_обновление_комнат,
  на_ошибку
}: UseSocketProps) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [подключено, setПодключено] = useState(false);
  const [загружается, setЗагружается] = useState(false);
  const обработчики = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map());
  const попытки_переподключения = useRef(0);
  const максимум_попыток = 3;
  const таймер_переподключения = useRef<NodeJS.Timeout | null>(null);

  // Подключение к серверу
  const подключиться = useCallback(async () => {
    if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING || !пользователь) return;

    try {
      setЗагружается(true);
      
      // Подключаемся без параметров, данные отправим после подключения
      const новый_socket = new WebSocket(серверUrl);

      // Обработка успешного подключения
      новый_socket.onopen = () => {
        console.log('Подключено к серверу WebSocket');
        setПодключено(true);
        setЗагружается(false);
        попытки_переподключения.current = 0; // Сбрасываем счетчик при успешном подключении
        
        // Отправляем сообщение о подключении (согласно серверному протоколу)
        const сообщение = {
          тип: 'подключение',
          данные: {
            имя: пользователь.имя,
            телеграм_id: пользователь.телеграм_id
          }
        };
        новый_socket.send(JSON.stringify(сообщение));
      };

      // Обработка входящих сообщений
      новый_socket.onmessage = (event) => {
        try {
          const данные = JSON.parse(event.data);
          
          // Определяем тип сообщения
          const тип = данные.тип || 'unknown';
          
          // Вызываем обработчики для типа сообщения
          const handlers = обработчики.current.get(тип);
          if (handlers) {
            handlers.forEach(handler => {
              handler(данные);
            });
          }
          
          // Обработка системных сообщений
          switch (тип) {
            case 'пользователи-обновлены':
              на_обновление_пользователей?.(данные.пользователи || []);
              break;
            case 'комнаты-обновлены':
              на_обновление_комнат?.(данные.комнаты || []);
              break;
            case 'ошибка':
              console.error('Ошибка от сервера:', данные.сообщение);
              на_ошибку?.(данные.сообщение || 'Неизвестная ошибка');
              break;
          }
        } catch (error) {
          console.error('Ошибка обработки сообщения:', error);
        }
      };

      // Обработка закрытия соединения
      новый_socket.onclose = (event) => {
        console.log('Отключено от сервера:', event.reason);
        setПодключено(false);
        setSocket(null);
        
        // Очищаем предыдущий таймер если есть
        if (таймер_переподключения.current) {
          clearTimeout(таймер_переподключения.current);
          таймер_переподключения.current = null;
        }
        
        // Автоматическое переподключение при неожиданном отключении
        if (!event.wasClean && попытки_переподключения.current < максимум_попыток) {
          попытки_переподключения.current++;
          console.log(`Попытка переподключения ${попытки_переподключения.current}/${максимум_попыток}...`);
          
          const задержка = Math.min(1000 * Math.pow(2, попытки_переподключения.current - 1), 10000);
          таймер_переподключения.current = setTimeout(() => {
            таймер_переподключения.current = null;
            подключиться();
          }, задержка);
        } else if (попытки_переподключения.current >= максимум_попыток) {
          на_ошибку?.('Превышено максимальное количество попыток подключения');
        }
      };

      // Обработка ошибок
      новый_socket.onerror = (error) => {
        console.error('Ошибка WebSocket:', error);
        setПодключено(false);
        setЗагружается(false);
        // Не вызываем ошибку сразу, позволяем onclose обработать переподключение
      };

      setSocket(новый_socket);
    } catch (error) {
      console.error('Ошибка создания WebSocket соединения:', error);
      setЗагружается(false);
      на_ошибку?.('Ошибка инициализации соединения');
    }
  }, [серверUrl, пользователь, на_обновление_пользователей, на_обновление_комнат, на_ошибку]);

  // Отключение от сервера
  const отключиться = useCallback(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
      setSocket(null);
      setПодключено(false);
    }
  }, [socket]);

  // Присоединение к комнате
  const присоединиться_к_комнате = useCallback((комната_id: string, пароль?: string) => {
    if (socket && socket.readyState === WebSocket.OPEN && пользователь) {
      const сообщение = {
        тип: 'присоединиться-к-комнате',
        комната_id,
        пользователь_id: пользователь.id,
        пароль
      };
      socket.send(JSON.stringify(сообщение));
    }
  }, [socket, пользователь]);

  // Покинуть комнату
  const покинуть_комнату = useCallback((комната_id: string) => {
    if (socket && socket.readyState === WebSocket.OPEN && пользователь) {
      const сообщение = {
        тип: 'покинуть-комнату',
        комната_id,
        пользователь_id: пользователь.id
      };
      socket.send(JSON.stringify(сообщение));
    }
  }, [socket, пользователь]);

  // Создать новую комнату
  const создать_комнату = useCallback((название: string, максимум_участников: number = 10, приватная: boolean = false, пароль?: string) => {
    if (socket && socket.readyState === WebSocket.OPEN && пользователь) {
      const сообщение = {
        тип: 'создать-комнату',
        название,
        создатель: пользователь.id,
        максимум_участников,
        приватная,
        пароль
      };
      socket.send(JSON.stringify(сообщение));
    }
  }, [socket, пользователь]);

  // Отправка сообщения
  const отправить_сообщение = useCallback((тип: string, данные: any, к?: string, комната?: string) => {
    if (socket && socket.readyState === WebSocket.OPEN && пользователь) {
      const сообщение = {
        тип: 'webrtc-signal',
        от: пользователь.id,
        к,
        комната,
        данные
      };
      
      socket.send(JSON.stringify(сообщение));
    }
  }, [socket, пользователь]);

  // Переключение состояния микрофона
  const переключить_микрофон = useCallback((включен: boolean, комната_id?: string) => {
    if (socket && socket.readyState === WebSocket.OPEN && пользователь) {
      const сообщение = {
        тип: 'микрофон-переключен',
        пользователь_id: пользователь.id,
        комната_id,
        включен
      };
      socket.send(JSON.stringify(сообщение));
    }
  }, [socket, пользователь]);

  // Уведомление о том, что пользователь говорит
  const уведомить_о_речи = useCallback((говорит: boolean, комната_id?: string) => {
    if (socket && socket.readyState === WebSocket.OPEN && пользователь) {
      const сообщение = {
        тип: 'говорит',
        пользователь_id: пользователь.id,
        комната_id,
        говорит
      };
      socket.send(JSON.stringify(сообщение));
    }
  }, [socket, пользователь]);

  // Получение списка комнат
  const получить_комнаты = useCallback(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const сообщение = {
        тип: 'получить-комнаты',
        данные: {},
        от: пользователь?.id || 'anonymous',
        время: Date.now()
      };
      socket.send(JSON.stringify(сообщение));
    }
  }, [socket, пользователь]);

  // Получение списка пользователей в комнате
  const получить_пользователей_комнаты = useCallback((комната_id: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const сообщение = {
        тип: 'получить-пользователей-комнаты',
        данные: { комната_id },
        от: пользователь?.id || 'anonymous',
        время: Date.now()
      };
      socket.send(JSON.stringify(сообщение));
    }
  }, [socket, пользователь]);

  // Подписка на событие
  const подписаться = useCallback((событие: string, обработчик: (...args: any[]) => void) => {
    if (!обработчики.current.has(событие)) {
      обработчики.current.set(событие, new Set());
    }
    обработчики.current.get(событие)!.add(обработчик);
    
    return () => {
      обработчики.current.get(событие)?.delete(обработчик);
    };
  }, []);

  // Автоматическое подключение при наличии пользователя
  useEffect(() => {
    if (пользователь && !socket) {
      подключиться();
    }
    
    return () => {
      // Очищаем таймер переподключения
      if (таймер_переподключения.current) {
        clearTimeout(таймер_переподключения.current);
        таймер_переподключения.current = null;
      }
      
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [пользователь]);

  // Обработка переподключения при восстановлении соединения
  useEffect(() => {
    const обработать_онлайн = () => {
      if (пользователь && socket && socket.readyState !== WebSocket.OPEN) {
        подключиться();
      }
    };

    window.addEventListener('online', обработать_онлайн);
    
    return () => {
      window.removeEventListener('online', обработать_онлайн);
    };
  }, [пользователь, socket, подключиться]);

  return {
    socket,
    подключено,
    загружается,
    подключиться,
    отключиться,
    присоединиться_к_комнате,
    покинуть_комнату,
    создать_комнату,
    отправить_сообщение,
    переключить_микрофон,
    уведомить_о_речи,
    получить_комнаты,
    получить_пользователей_комнаты,
    подписаться
  };
};