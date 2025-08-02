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

  // Подключение к серверу
  const подключиться = useCallback(async () => {
    if (socket?.readyState === WebSocket.OPEN || !пользователь) return;

    try {
      setЗагружается(true);
      
      const params = new URLSearchParams({
        пользователь_id: пользователь.id,
        имя: пользователь.имя,
        телеграм_id: пользователь.телеграм_id?.toString() || '',
      });
      
      const url = `${серверUrl}?${params}`;
      const новый_socket = new WebSocket(url);

      // Обработка успешного подключения
      новый_socket.onopen = () => {
        console.log('Подключено к серверу WebSocket');
        setПодключено(true);
        setЗагружается(false);
        
        // Отправляем сообщение о подключении
        const сообщение = {
          тип: 'подключение',
          данные: {
            пользователь_id: пользователь.id,
            имя: пользователь.имя,
            телеграм_id: пользователь.телеграм_id
          },
          от: пользователь.id,
          время: Date.now()
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
        
        // Автоматическое переподключение при неожиданном отключении
        if (!event.wasClean) {
          setTimeout(() => {
            подключиться();
          }, 1000);
        }
      };

      // Обработка ошибок
      новый_socket.onerror = (error) => {
        console.error('Ошибка WebSocket:', error);
        setПодключено(false);
        setЗагружается(false);
        на_ошибку?.('Не удалось подключиться к серверу');
      };

      setSocket(новый_socket);
    } catch (error) {
      console.error('Ошибка создания WebSocket соединения:', error);
      setЗагружается(false);
      на_ошибку?.('Ошибка инициализации соединения');
    }
  }, [серверUrl, пользователь, на_обновление_пользователей, на_обновление_комнат, на_ошибку, socket?.readyState]);

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
        данные: {
          комната_id,
          пользователь_id: пользователь.id,
          пароль
        },
        от: пользователь.id,
        время: Date.now()
      };
      socket.send(JSON.stringify(сообщение));
    }
  }, [socket, пользователь]);

  // Покинуть комнату
  const покинуть_комнату = useCallback((комната_id: string) => {
    if (socket && socket.readyState === WebSocket.OPEN && пользователь) {
      const сообщение = {
        тип: 'покинуть-комнату',
        данные: {
          комната_id,
          пользователь_id: пользователь.id
        },
        от: пользователь.id,
        время: Date.now()
      };
      socket.send(JSON.stringify(сообщение));
    }
  }, [socket, пользователь]);

  // Создать новую комнату
  const создать_комнату = useCallback((название: string, максимум_участников: number = 10, приватная: boolean = false, пароль?: string) => {
    if (socket && socket.readyState === WebSocket.OPEN && пользователь) {
      const сообщение = {
        тип: 'создать-комнату',
        данные: {
          название,
          создатель: пользователь.id,
          максимум_участников,
          приватная,
          пароль
        },
        от: пользователь.id,
        время: Date.now()
      };
      socket.send(JSON.stringify(сообщение));
    }
  }, [socket, пользователь]);

  // Отправка сообщения
  const отправить_сообщение = useCallback((тип: string, данные: any, к?: string, комната?: string) => {
    if (socket && socket.readyState === WebSocket.OPEN && пользователь) {
      const сообщение: СообщениеВебСокета = {
        тип: тип as any,
        данные,
        от: пользователь.id,
        к,
        комната,
        время: Date.now()
      };
      
      socket.send(JSON.stringify(сообщение));
    }
  }, [socket, пользователь]);

  // Переключение состояния микрофона
  const переключить_микрофон = useCallback((включен: boolean, комната_id?: string) => {
    if (socket && socket.readyState === WebSocket.OPEN && пользователь) {
      const сообщение = {
        тип: 'микрофон-переключен',
        данные: {
          пользователь_id: пользователь.id,
          комната_id,
          включен
        },
        от: пользователь.id,
        время: Date.now()
      };
      socket.send(JSON.stringify(сообщение));
    }
  }, [socket, пользователь]);

  // Уведомление о том, что пользователь говорит
  const уведомить_о_речи = useCallback((говорит: boolean, комната_id?: string) => {
    if (socket && socket.readyState === WebSocket.OPEN && пользователь) {
      const сообщение = {
        тип: 'говорит',
        данные: {
          пользователь_id: пользователь.id,
          комната_id,
          говорит
        },
        от: пользователь.id,
        время: Date.now()
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
    if (пользователь && (!socket || socket.readyState !== WebSocket.OPEN)) {
      подключиться();
    }
    
    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [пользователь, подключиться]);

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