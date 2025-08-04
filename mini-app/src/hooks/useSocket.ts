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
    console.log(`[useSocket] 🔄 Попытка подключения к серверу: ${серверUrl}`);
    console.log(`[useSocket] Состояние сокета: ${socket?.readyState || 'null'}`);
    console.log(`[useSocket] Пользователь:`, пользователь);
    
    if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING || !пользователь) {
      console.log(`[useSocket] ❌ Подключение отменено:`, {
        socketState: socket?.readyState,
        hasUser: !!пользователь,
        reason: !пользователь ? 'нет пользователя' : 'уже подключен или подключается'
      });
      return;
    }

    try {
      setЗагружается(true);
      console.log(`[useSocket] ⏳ Начинаем подключение к WebSocket...`);
      
      // Подключаемся без параметров, данные отправим после подключения
      const новый_socket = new WebSocket(серверUrl);
      console.log(`[useSocket] 🌐 WebSocket создан, состояние: ${новый_socket.readyState}`);

      // Обработка успешного подключения
      новый_socket.onopen = () => {
        console.log(`[useSocket] ✅ WebSocket подключен успешно!`);
        console.log(`[useSocket] Состояние: OPEN (${WebSocket.OPEN})`);
        setПодключено(true);
        setЗагружается(false);
        попытки_переподключения.current = 0; // Сбрасываем счетчик при успешном подключении
        
        // Отправляем сообщение о подключении (согласно серверному протоколу)
        const сообщение = {
          тип: 'присоединиться',
          пользователь: {
            id: пользователь.id,
            имя: пользователь.имя,
            телеграм_id: пользователь.телеграм_id,
            аватар: пользователь.аватар,
            подключен: true,
            в_комнате: null,
            микрофон_включен: false,
            говорит: false,
            последняя_активность: new Date().toISOString()
          }
        };
        console.log(`[useSocket] 📤 Отправляем сообщение присоединения:`, сообщение);
        новый_socket.send(JSON.stringify(сообщение));
      };

      // Обработка входящих сообщений
      новый_socket.onmessage = (event) => {
        console.log(`[useSocket] 📥 Получено сообщение:`, event.data);
        try {
          const данные = JSON.parse(event.data);
          console.log(`[useSocket] 📋 Распарсенные данные:`, данные);
          
          // Определяем тип сообщения
          const тип = данные.тип || 'unknown';
          console.log(`[useSocket] 🏷️ Тип сообщения: ${тип}`);
          
          // Вызываем обработчики для типа сообщения
          const handlers = обработчики.current.get(тип);
          if (handlers) {
            console.log(`[useSocket] 🎯 Найдено ${handlers.size} обработчиков для типа: ${тип}`);
            handlers.forEach(handler => {
              handler(данные);
            });
          } else {
            console.log(`[useSocket] ⚠️ Нет обработчиков для типа: ${тип}`);
          }
          
          // Обработка системных сообщений
          switch (тип) {
            case 'пользователи-обновлены':
              console.log(`[useSocket] 👥 Обновление пользователей:`, данные.пользователи);
              на_обновление_пользователей?.(данные.пользователи || []);
              break;
            case 'комнаты-обновлены':
              console.log(`[useSocket] 🏠 Обновление комнат:`, данные.комнаты);
              на_обновление_комнат?.(данные.комнаты || []);
              break;
            case 'ошибка':
              console.error(`[useSocket] ❌ Ошибка от сервера:`, данные.сообщение);
              на_ошибку?.(данные.сообщение || 'Неизвестная ошибка');
              break;
          }
        } catch (error) {
          console.error(`[useSocket] 💥 Ошибка обработки сообщения:`, error);
          console.error(`[useSocket] 📄 Проблемное сообщение:`, event.data);
        }
      };

      // Обработка закрытия соединения
      новый_socket.onclose = (event) => {
        console.log(`[useSocket] 🔌 WebSocket закрыт:`, {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          попытки: попытки_переподключения.current
        });
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
          console.log(`[useSocket] 🔄 Переподключение ${попытки_переподключения.current}/${максимум_попыток}...`);
          
          const задержка = Math.min(1000 * Math.pow(2, попытки_переподключения.current - 1), 10000);
          console.log(`[useSocket] ⏰ Задержка перед переподключением: ${задержка}мс`);
          таймер_переподключения.current = setTimeout(() => {
            таймер_переподключения.current = null;
            подключиться();
          }, задержка);
        } else if (попытки_переподключения.current >= максимум_попыток) {
          console.error(`[useSocket] 🚫 Превышено максимальное количество попыток подключения`);
          на_ошибку?.('Превышено максимальное количество попыток подключения');
        }
      };

      // Обработка ошибок
      новый_socket.onerror = (error) => {
        console.error(`[useSocket] 💥 Ошибка WebSocket:`, error);
        console.error(`[useSocket] 🌐 URL сервера: ${серверUrl}`);
        console.error(`[useSocket] 📊 Состояние сокета: ${новый_socket.readyState}`);
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

  // Отправка WebRTC сигнала
  const отправить_webrtc_сигнал = useCallback((данные: any, к: string, комната: string) => {
    if (socket && socket.readyState === WebSocket.OPEN && пользователь) {
      const сообщение = {
        тип: 'webrtc-signal',
        от: пользователь.id,
        к,
        комната,
        данные
      };
      
      console.log('[Socket] Отправка WebRTC сигнала:', { 
        от: пользователь.id, 
        к, 
        комната,
        тип_данных: данные.type 
      });
      
      socket.send(JSON.stringify(сообщение));
    }
  }, [socket, пользователь]);

  // Отправка общего сообщения (для обратной совместимости)
  const отправить_сообщение = отправить_webrtc_сигнал;

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
    console.log(`[useSocket] 🔄 useEffect автоподключения:`, {
      есть_пользователь: !!пользователь,
      пользователь_id: пользователь?.id,
      есть_сокет: !!socket,
      состояние_сокета: socket?.readyState,
      подключено: подключено,
      загружается: загружается
    });
    
    if (пользователь && !socket) {
      console.log(`[useSocket] 🚀 Инициализация автоматического подключения для пользователя ${пользователь.id}`);
      подключиться();
    } else if (пользователь && socket) {
      console.log(`[useSocket] ℹ️ Пользователь есть, сокет есть (состояние: ${socket.readyState})`);
    } else if (!пользователь) {
      console.log(`[useSocket] ⏸️ Нет пользователя - ждем инициализации`);
    }
    
    return () => {
      console.log(`[useSocket] 🧹 Очистка useEffect автоподключения`);
      // Очищаем таймер переподключения
      if (таймер_переподключения.current) {
        clearTimeout(таймер_переподключения.current);
        таймер_переподключения.current = null;
      }
      
      if (socket && socket.readyState === WebSocket.OPEN) {
        console.log(`[useSocket] 🔌 Закрываем WebSocket при размонтировании`);
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
    отправить_webrtc_сигнал,
    переключить_микрофон,
    уведомить_о_речи,
    получить_комнаты,
    получить_пользователей_комнаты,
    подписаться
  };
};