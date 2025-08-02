'use client';

import React, { useState, useEffect } from 'react';
import { Пользователь, Комната, СостояниеПриложения } from '@/types';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';
import { useSocket } from '@/hooks/useSocket';
import { SimpleRoomsList } from '@/components/SimpleRoomsList';
import { SimpleVoiceRoom } from '@/components/SimpleVoiceRoom';
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

  const {
    пользователь: телеграм_пользователь,
    готов: телеграм_готов,
    показатьУведомление,
    показатьПодтверждение,
    вибрация
  } = useTelegramWebApp();

  // Создание пользователя из данных Telegram
  useEffect(() => {
    if (телеграм_готов && телеграм_пользователь && !состояние.текущий_пользователь) {
      const пользователь: Пользователь = {
        id: uuidv4(),
        имя: `${телеграм_пользователь.first_name}${телеграм_пользователь.last_name ? ` ${телеграм_пользователь.last_name}` : ''}`,
        телеграм_id: телеграм_пользователь.id,
        аватар: телеграм_пользователь.photo_url,
        подключен: true,
        микрофон_включен: true,
        говорит: false,
      };

      setСостояние(prev => ({
        ...prev,
        текущий_пользователь: пользователь,
        загружается: false,
      }));
    } else if (телеграм_готов && !телеграм_пользователь) {
      // Создаем гостевого пользователя, если Telegram данные недоступны
      const гостевой_пользователь: Пользователь = {
        id: uuidv4(),
        имя: `Гость_${Math.random().toString(36).substr(2, 5)}`,
        подключен: true,
        микрофон_включен: true,
        говорит: false,
      };

      setСостояние(prev => ({
        ...prev,
        текущий_пользователь: гостевой_пользователь,
        загружается: false,
      }));
    }
  }, [телеграм_готов, телеграм_пользователь, состояние.текущий_пользователь]);

  const {
    socket,
    подключено,
    загружается: загружается_сокет,
    присоединиться_к_комнате,
    покинуть_комнату,
    создать_комнату,
  } = useSocket({
    серверUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080',
    пользователь: состояние.текущий_пользователь,
    на_обновление_комнат: (комнаты: Комната[]) => {
      setСостояние(prev => ({ ...prev, комнаты }));
    },
    на_ошибку: (ошибка: string) => {
      setСостояние(prev => ({ ...prev, ошибка }));
      показатьУведомление(`Ошибка: ${ошибка}`);
    },
  });

  // Обновление состояния подключения
  useEffect(() => {
    setСостояние(prev => ({
      ...prev,
      подключено_к_серверу: подключено,
      загружается: загружается_сокет,
    }));
  }, [подключено, загружается_сокет]);

  // Обработка создания комнаты
  const обработать_создание_комнаты = async (
    название: string,
    максимум_участников: number,
    приватная: boolean,
    пароль?: string
  ) => {
    if (!состояние.текущий_пользователь) return;

    try {
      создать_комнату(название, максимум_участников, приватная, пароль);
      вибрация();
      показатьУведомление('Комната создана!');
    } catch (error) {
      console.error('Ошибка создания комнаты:', error);
      показатьУведомление('Не удалось создать комнату');
    }
  };

  // Обработка присоединения к комнате
  const обработать_присоединение_к_комнате = async (комната_id: string, пароль?: string) => {
    if (!состояние.текущий_пользователь) return;

    try {
      присоединиться_к_комнате(комната_id, пароль);
      вибрация();

      // Находим комнату и устанавливаем как активную
      const комната = состояние.комнаты.find(r => r.id === комната_id);
      if (комната) {
        setСостояние(prev => ({ ...prev, активная_комната: комната }));
      }
    } catch (error) {
      console.error('Ошибка присоединения к комнате:', error);
      показатьУведомление('Не удалось присоединиться к комнате');
    }
  };

  // Обработка выхода из комнаты
  const обработать_выход_из_комнаты = async () => {
    if (!состояние.текущий_пользователь || !состояние.активная_комната) return;

    const подтверждено = await показатьПодтверждение('Вы уверены, что хотите покинуть комнату?');
    if (!подтверждено) return;

    try {
      покинуть_комнату(состояние.активная_комната.id);
      setСостояние(prev => ({ ...prev, активная_комната: null }));
      вибрация();
      показатьУведомление('Вы покинули комнату');
    } catch (error) {
      console.error('Ошибка выхода из комнаты:', error);
      показатьУведомление('Не удалось покинуть комнату');
    }
  };

  // Обработка обновлений через WebSocket
  useEffect(() => {
    if (!socket) return;

    // Обработка присоединения к комнате
    const unsubscribeПрисоединение = socket.on('присоединился-к-комнате', (данные: any) => {
      const { комната } = данные;
      setСостояние(prev => ({ ...prev, активная_комната: комната }));
      показатьУведомление(`Добро пожаловать в комнату \"${комната.название}\"!`);
    });

    // Обработка выхода из комнаты
    const unsubscribeВыход = socket.on('покинул-комнату', (данные: any) => {
      setСостояние(prev => ({ ...prev, активная_комната: null }));
    });

    // Обработка создания комнаты
    const unsubscribeСоздание = socket.on('комната-создана', (данные: any) => {
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
  if (состояние.загружается || !состояние.текущий_пользователь) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl">🎤</div>
          <div className="text-xl font-bold text-gray-800 dark:text-white">
            Голосовые комнаты
          </div>
          <div className="text-gray-600 dark:text-gray-300">
            Инициализация приложения...
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Показываем ошибку подключения
  if (!состояние.подключено_к_серверу && !загружается_сокет) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-pink-100 dark:from-red-900 dark:to-pink-900 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-6xl">⚠️</div>
          <div className="text-xl font-bold text-gray-800 dark:text-white">
            Нет подключения к серверу
          </div>
          <div className="text-gray-600 dark:text-gray-300">
            Проверьте интернет-соединение и попробуйте снова
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            🔄 Перезагрузить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Статус подключения */}
      <div className={`
        w-full py-2 px-4 text-center text-sm font-medium
        ${состояние.подключено_к_серверу 
          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
          : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
        }
      `}>
        {состояние.подключено_к_серверу ? '🟢 Подключено к серверу' : '🟡 Подключение...'}
      </div>

      {/* Основной контент */}
      {состояние.активная_комната ? (
        <SimpleVoiceRoom
          комната={состояние.активная_комната}
          текущий_пользователь={состояние.текущий_пользователь}
          socket={socket}
          на_покинуть_комнату={обработать_выход_из_комнаты}
        />
      ) : (
        <SimpleRoomsList
          комнаты={состояние.комнаты}
          пользователь={состояние.текущий_пользователь}
          на_присоединение={обработать_присоединение_к_комнате}
          на_создание_комнаты={обработать_создание_комнаты}
          загружается={загружается_сокет}
        />
      )}

      {/* Отображение ошибок */}
      {состояние.ошибка && (
        <div className="fixed bottom-4 left-4 right-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <span>❌ {состояние.ошибка}</span>
            <button
              onClick={() => setСостояние(prev => ({ ...prev, ошибка: null }))}
              className="ml-4 text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
