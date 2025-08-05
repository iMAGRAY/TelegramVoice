'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Пользователь, Комната, СостояниеПриложения } from '@/types';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';
import { useSocket } from '@/hooks/useSocket';
import { useSettings } from '@/hooks/useSettings';
import { SimpleRoomsList } from '@/components/SimpleRoomsList';
import { SimpleVoiceRoom } from '@/components/SimpleVoiceRoom';
import { SettingsPage } from '@/components/SettingsPage';
import { DebugModal } from '@/components/DebugModal';
import { useDebugConsole } from '@/hooks/useDebugConsole';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const [состояние, setСостояние] = useState<СостояниеПриложения>({
    текущий_пользователь: null,
    комнаты: [],
    активная_комната: null,
    подключено_к_серверу: false,
    состояние_микрофона: true,
    громкость: 50,
    ошибка: null,
    загружается: true,
  });

  const [показать_настройки, setПоказать_настройки] = useState(false);
  const [можно_показать_ошибку, setМожно_показать_ошибку] = useState(false);
  
  // Debug console хук
  const { показать_отладку, закрыть_отладку } = useDebugConsole();

  // Добавляем приветственное сообщение в лог при загрузке
  useEffect(() => {
    // Апп инициализирован
  }, []);

  // Задержка перед показом экрана ошибки подключения (даем время WebSocket подключиться)
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log(`[page.tsx] ⏰ Истекла задержка - разрешаем показ экрана ошибки`);
      setМожно_показать_ошибку(true);
    }, 2000); // 2 секунды задержка

    return () => clearTimeout(timer);
  }, []);

  // АВАРИЙНЫЙ таймер для принудительной инициализации если всё зависло
  useEffect(() => {
    const emergencyTimer = setTimeout(() => {
      console.log(`[page.tsx] 🚨 АВАРИЙНАЯ ИНИЦИАЛИЗАЦИЯ - приложение зависло!`);
      
      // Принудительно создаём пользователя если его нет
      if (!состояние.текущий_пользователь) {
        console.log(`[page.tsx] 🆘 Создаём аварийного пользователя`);
        const аварийный_пользователь: Пользователь = {
          id: uuidv4(),  
          имя: `Пользователь_${Math.random().toString(36).substr(2, 5)}`,
          подключен: true,
          микрофон_включен: true,
          говорит: false,
        };
        
        setСостояние(prev => ({
          ...prev,
          текущий_пользователь: аварийный_пользователь,
          загружается: false,
        }));
      }
    }, 5000); // 5 секунд аварийный таймер

    return () => clearTimeout(emergencyTimer);
  }, []); // Запускается только один раз
  
  const { 
    настройки, 
    загружено: настройки_загружены, 
    сохранить_настройки,
    получить_настройки_микрофона 
  } = useSettings();

  const {
    пользователь: телеграм_пользователь,
    готов: телеграм_готов,
    версия: телеграм_версия,
    поддерживается,
    показатьУведомление,
    показатьПодтверждение,
    показатьВсплывающееОкно,
    вибрация
  } = useTelegramWebApp();

  // Создание пользователя из данных Telegram
  useEffect(() => {
    console.log(`[page.tsx] 👤 useEffect создания пользователя:`, {
      телеграм_готов,
      телеграм_пользователь: !!телеграм_пользователь,
      текущий_пользователь: !!состояние.текущий_пользователь
    });
    
    if (телеграм_готов && телеграм_пользователь && !состояние.текущий_пользователь) {
      console.log(`[page.tsx] 📝 Создаём пользователя из Telegram данных`);
      const пользователь: Пользователь = {
        id: uuidv4(),
        имя: `${телеграм_пользователь.first_name}${телеграм_пользователь.last_name ? ` ${телеграм_пользователь.last_name}` : ''}`,
        телеграм_id: телеграм_пользователь.id,
        аватар: телеграм_пользователь.photo_url,
        подключен: true,
        микрофон_включен: true,
        говорит: false,
      };

      console.log(`[page.tsx] ✅ Пользователь создан:`, пользователь.имя);
      setСостояние(prev => ({
        ...prev,
        текущий_пользователь: пользователь,
        загружается: false,
      }));
    } else if (телеграм_готов && !телеграм_пользователь && !состояние.текущий_пользователь) {
      // Создаем гостевого пользователя, если Telegram данные недоступны
      console.log(`[page.tsx] 👻 Создаём гостевого пользователя`);
      const гостевой_пользователь: Пользователь = {
        id: uuidv4(),
        имя: `Гость_${Math.random().toString(36).substr(2, 5)}`,
        подключен: true,
        микрофон_включен: true,
        говорит: false,
      };

      console.log(`[page.tsx] ✅ Гостевой пользователь создан:`, гостевой_пользователь.имя);
      setСостояние(prev => ({
        ...prev,
        текущий_пользователь: гостевой_пользователь,
        загружается: false,
      }));
    } else {
      console.log(`[page.tsx] ⏸️ Ждём инициализации Telegram или пользователь уже создан`);
    }
  }, [телеграм_готов, телеграм_пользователь, состояние.текущий_пользователь]);

  // ИСПРАВЛЕНИЕ: Мемоизированный WebSocket URL - вычисляется ТОЛЬКО ОДИН РАЗ
  const [webSocketURL] = useState(() => {
    console.log(`[page.tsx] 🌐 Определение WebSocket URL (ОДИН РАЗ)...`);
    console.log(`[page.tsx] 🔧 NEXT_PUBLIC_WEBSOCKET_URL:`, process.env.NEXT_PUBLIC_WEBSOCKET_URL);
    
    // Если есть переменная окружения, используем её
    if (process.env.NEXT_PUBLIC_WEBSOCKET_URL) {
      console.log(`[page.tsx] ✅ Используем URL из переменной окружения:`, process.env.NEXT_PUBLIC_WEBSOCKET_URL);
      return process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    }
    
    // Автоматический выбор на основе текущего URL
    if (typeof window !== 'undefined') {
      const isHTTPS = window.location.protocol === 'https:';
      const hostname = window.location.hostname;
      console.log(`[page.tsx] 🌍 Текущий домен:`, {
        protocol: window.location.protocol,
        hostname: hostname,
        isHTTPS: isHTTPS,
        fullURL: window.location.href
      });
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        const url = 'ws://localhost:8080';
        console.log(`[page.tsx] 🏠 Локальная разработка, URL:`, url);
        return url;
      }
      
      if (hostname === '89.23.115.156') {
        const url = isHTTPS ? 'wss://hesovoice.online/ws' : 'ws://89.23.115.156:8080';
        console.log(`[page.tsx] 🖥️ IP адрес сервера, URL:`, url);
        return url;
      }
      
      if (hostname === 'hesovoice.online') {
        const url = isHTTPS ? 'wss://hesovoice.online/ws' : 'ws://hesovoice.online/ws';
        console.log(`[page.tsx] 🌐 Домен hesovoice.online, URL:`, url);
        return url;
      }
      
      console.log(`[page.tsx] ⚠️ Неизвестный домен: ${hostname}`);
    }
    
    const fallbackUrl = 'ws://localhost:8080';
    console.log(`[page.tsx] 🔄 Используем fallback URL:`, fallbackUrl);
    return fallbackUrl;
  });
  console.log(`[page.tsx] 🎛️ Инициализация useSocket с параметрами:`, {
    серверUrl: webSocketURL,
    пользователь: состояние.текущий_пользователь ? {
      id: состояние.текущий_пользователь.id,
      имя: состояние.текущий_пользователь.имя
    } : null
  });

  // ИСПРАВЛЕНИЕ: Мемоизированные коллбэки для предотвращения перемонтирований
  const на_обновление_комнат = useCallback((комнаты: Комната[]) => {
    console.log(`[page.tsx] 🏠 Получены обновленные комнаты:`, комнаты);
    setСостояние(prev => ({ ...prev, комнаты }));
  }, []);

  const на_ошибку = useCallback((ошибка: string) => {
    console.log(`[page.tsx] ❌ Получена ошибка от useSocket:`, ошибка);
    setСостояние(prev => ({ ...prev, ошибка }));
    показатьУведомление(`Ошибка: ${ошибка}`);
  }, [показатьУведомление]);

  const socketAPI = useSocket({
    серверUrl: webSocketURL,
    пользователь: состояние.текущий_пользователь,
    на_обновление_комнат,
    на_ошибку,
  });

  // Деструктуризация для удобства
  const {
    socket,
    подключено,
    загружается: загружается_сокет,
    присоединиться_к_комнате,
    покинуть_комнату,
    подписаться
  } = socketAPI;

  // Обновление состояния подключения
  useEffect(() => {
    console.log(`[page.tsx] 🔄 Обновление состояния подключения:`, {
      подключено: подключено,
      загружается: загружается_сокет,
      socket: !!socket,
      socketReadyState: socket?.readyState,
      предыдущее_состояние: {
        подключено_к_серверу: состояние.подключено_к_серверу,
        загружается: состояние.загружается
      }
    });
    
    // Если подключились успешно, сбрасываем возможность показа ошибки
    if (подключено && можно_показать_ошибку) {
      console.log(`[page.tsx] ✅ Подключение успешно - сбрасываем флаг показа ошибки`);
      setМожно_показать_ошибку(false);
    }
    
    setСостояние(prev => {
      const новое_состояние = {
        ...prev,
        подключено_к_серверу: подключено,
        загружается: загружается_сокет,
      };
      
      console.log(`[page.tsx] 📝 Обновляем состояние приложения:`, {
        было: {
          подключено_к_серверу: prev.подключено_к_серверу,
          загружается: prev.загружается
        },
        стало: {
          подключено_к_серверу: новое_состояние.подключено_к_серверу,
          загружается: новое_состояние.загружается
        }
      });
      
      return новое_состояние;
    });
  }, [подключено, загружается_сокет, socket, можно_показать_ошибку]);

  // ИСПРАВЛЕНИЕ: Мемоизированные функции для управления настройками
  const открыть_настройки = useCallback(() => {
    setПоказать_настройки(true);
    вибрация?.();
  }, [вибрация]);

  const закрыть_настройки = useCallback(() => {
    setПоказать_настройки(false);
  }, []);

  const сохранить_и_закрыть_настройки = useCallback((новые_настройки: typeof настройки) => {
    сохранить_настройки(новые_настройки);
    setПоказать_настройки(false);
    показатьУведомление?.('Настройки сохранены');
  }, [сохранить_настройки, показатьУведомление]);


  // ИСПРАВЛЕНИЕ: Мемоизированные обработчики комнат
  const обработать_присоединение_к_комнате = useCallback(async (комната_id: string, пароль?: string) => {
    if (!состояние.текущий_пользователь) return;

    try {
      присоединиться_к_комнате(комната_id, пароль);
      вибрация();

      const комната = состояние.комнаты.find(r => r.id === комната_id);
      if (комната) {
        setСостояние(prev => ({ ...prev, активная_комната: комната }));
      }
    } catch (error) {
      показатьУведомление('Не удалось присоединиться к комнате');
    }
  }, [состояние.текущий_пользователь, состояние.комнаты, присоединиться_к_комнате, вибрация, показатьУведомление]);

  const обработать_выход_из_комнаты = useCallback(async () => {
    if (!состояние.текущий_пользователь || !состояние.активная_комната) return;

    const подтверждено = await показатьПодтверждение('Вы уверены, что хотите покинуть комнату?');
    if (!подтверждено) return;

    try {
      покинуть_комнату(состояние.активная_комната.id);
      setСостояние(prev => ({ ...prev, активная_комната: null }));
      вибрация();
      показатьУведомление('Вы покинули комнату');
    } catch (error) {
      показатьУведомление('Не удалось покинуть комнату');
    }
  }, [состояние.текущий_пользователь, состояние.активная_комната, покинуть_комнату, вибрация, показатьПодтверждение, показатьУведомление]);

  // Обработка обновлений через WebSocket
  useEffect(() => {
    if (!socket || !socket.подписаться) return;

    // Обработка присоединения к комнате
    const unsubscribeПрисоединение = socket.подписаться('присоединился-к-комнате', (данные: any) => {
      const { комната } = данные;
      setСостояние(prev => ({ ...prev, активная_комната: комната }));
      показатьУведомление(`Добро пожаловать в комнату \"${комната.название}\"!`);
    });

    // Обработка выхода из комнаты
    const unsubscribeВыход = socket.подписаться('покинул-комнату', (данные: any) => {
      setСостояние(prev => ({ ...prev, активная_комната: null }));
    });

    // Обработка создания комнаты
    const unsubscribeСоздание = socket.подписаться('комната-создана', (данные: any) => {
      const { комната } = данные;
      if (комната.создатель === состояние.текущий_пользователь?.id) {
        setСостояние(prev => ({ ...prev, активная_комната: комната }));
      }
    });

    return () => {
      unsubscribeПрисоединение();
      unsubscribeВыход();
      unsubscribeСоздание();
    };
  }, [socket, состояние.текущий_пользователь?.id, показатьУведомление]);

  // Показываем загрузку пока инициализируется приложение
  if (состояние.загружается || !состояние.текущий_пользователь || !настройки_загружены) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin"></div>
          </div>
          <div className="text-lg font-medium text-[var(--text-primary)]">
            Голосовые комнаты
          </div>
          <div className="text-sm text-[var(--text-secondary)]">
            Инициализация приложения...
          </div>
        </div>
      </div>
    );
  }

  // Показываем ошибку подключения (с задержкой чтобы избежать race condition)
  const условие_ошибки = !состояние.подключено_к_серверу && !загружается_сокет && можно_показать_ошибку;
  console.log(`[page.tsx] 🚨 ДЕТАЛЬНАЯ проверка условий ошибки подключения:`, {
    'состояние.подключено_к_серверу': состояние.подключено_к_серверу,
    'загружается_сокет': загружается_сокет,
    'можно_показать_ошибку': можно_показать_ошибку,
    'socket существует': !!socket,
    'socket?.readyState': socket?.readyState,
    'WebSocket.OPEN': WebSocket.OPEN,
    'WebSocket.CONNECTING': WebSocket.CONNECTING,
    'WebSocket.CLOSING': WebSocket.CLOSING,
    'WebSocket.CLOSED': WebSocket.CLOSED,
    'socket === WebSocket.OPEN': socket?.readyState === WebSocket.OPEN,
    'socket === WebSocket.CONNECTING': socket?.readyState === WebSocket.CONNECTING,
    'условие_ошибки (!подключено && !загружается && можно_показать)': условие_ошибки,
    'НЕ подключено к серверу': !состояние.подключено_к_серверу,
    'НЕ загружается сокет': !загружается_сокет,
    'текущий_пользователь': состояние.текущий_пользователь ? {
      id: состояние.текущий_пользователь.id,
      имя: состояние.текущий_пользователь.имя
    } : null
  });
  
  if (условие_ошибки) {
    console.log(`[page.tsx] ❌ ПОКАЗЫВАЕМ ЭКРАН ОШИБКИ ПОДКЛЮЧЕНИЯ`);
    console.log(`[page.tsx] 📊 Полное состояние приложения:`, {
      ...состояние,
      текущий_пользователь: состояние.текущий_пользователь ? {
        id: состояние.текущий_пользователь.id,
        имя: состояние.текущий_пользователь.имя
      } : null
    });
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--danger)] bg-opacity-10 flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-lg font-medium text-[var(--text-primary)]">
            Нет подключения к серверу
          </div>
          <div className="text-sm text-[var(--text-secondary)]">
            Проверьте интернет-соединение и попробуйте снова
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg transition-colors border border-[var(--border-color)]"
          >
            Перезагрузить
          </button>
        </div>
      </div>
    );
  }

  console.log(`[page.tsx] ✅ РЕНДЕРИМ НОРМАЛЬНЫЙ ИНТЕРФЕЙС`);
  console.log(`[page.tsx] 🎯 Финальное состояние для рендера:`, {
    подключено_к_серверу: состояние.подключено_к_серверу,
    загружается_сокет: загружается_сокет,
    активная_комната: состояние.активная_комната?.название,
    количество_комнат: состояние.комнаты.length,
    текущий_пользователь: состояние.текущий_пользователь?.имя
  });

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Статус подключения */}
      <div className="border-b border-[var(--border-color)]">
        <div className="max-w-4xl mx-auto px-6 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${состояние.подключено_к_серверу ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'} animate-pulse`}></div>
            <span className="text-[var(--text-secondary)]">
              {состояние.подключено_к_серверу ? 'Подключено' : 'Подключение...'}
            </span>
          </div>
          <div className="text-[var(--text-tertiary)]">
            v{телеграм_версия}
          </div>
        </div>
      </div>

      {/* Основной контент */}
      {состояние.активная_комната ? (
        <SimpleVoiceRoom
          key={`room-${состояние.активная_комната.id}`} // ИСПРАВЛЕНИЕ: Стабильный ключ для предотвращения перемонтирований
          комната={состояние.активная_комната}
          текущий_пользователь={состояние.текущий_пользователь}
          socket={socketAPI}
          подписаться={подписаться}
          на_покинуть_комнату={обработать_выход_из_комнаты}
          на_открыть_настройки={открыть_настройки}
        />
      ) : (
        <SimpleRoomsList
          комнаты={состояние.комнаты}
          пользователь={состояние.текущий_пользователь}
          на_присоединение={обработать_присоединение_к_комнате}
          загружается={загружается_сокет}
          на_открыть_настройки={открыть_настройки}
        />
      )}

      {/* Страница настроек */}
      {показать_настройки && (
        <SettingsPage
          настройки={настройки}
          на_закрыть={закрыть_настройки}
          на_сохранить={сохранить_и_закрыть_настройки}
        />
      )}

      {/* Debug Modal */}
      <DebugModal
        открыт={показать_отладку}
        на_закрыть={закрыть_отладку}
      />

      {/* Отображение ошибок */}
      {состояние.ошибка && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto">
          <div className="bg-[var(--bg-primary)] border border-[var(--danger)] rounded-lg shadow-[var(--shadow-md)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[var(--danger)] bg-opacity-10 flex-shrink-0 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-[var(--danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="text-sm text-[var(--text-primary)]">{состояние.ошибка}</div>
              </div>
              <button
                onClick={() => setСостояние(prev => ({ ...prev, ошибка: null }))}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
