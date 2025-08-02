'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Пользователь, Комната } from '@/types';
import { useWebRTC } from '@/hooks/useWebRTC';

interface VoiceRoomProps {
  комната: Комната;
  текущий_пользователь: Пользователь;
  socket: any;
  подписаться: (событие: string, обработчик: (...args: any[]) => void) => () => void;
  на_покинуть_комнату: () => void;
}

export const SimpleVoiceRoom: React.FC<VoiceRoomProps> = ({
  комната,
  текущий_пользователь,
  socket,
  подписаться,
  на_покинуть_комнату
}) => {
  const [участники, setУчастники] = useState<Пользователь[]>([текущий_пользователь]);
  const [аудио_потоки, setАудио_потоки] = useState<Map<string, MediaStream>>(new Map());
  const [говорящие_пользователи, setГоворящие_пользователи] = useState<Set<string>>(new Set());
  const аудио_refs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // WebRTC хук
  const {
    локальный_поток,
    микрофон_включен,
    загружается,
    ошибка,
    получить_микрофон,
    подключиться_к_пользователю,
    переключить_микрофон,
    очистить
  } = useWebRTC({
    пользователь_id: текущий_пользователь.id,
    комната_id: комната.id,
    socket,
    на_получение_потока: (поток: MediaStream, пользователь_id: string) => {
      setАудио_потоки(prev => new Map(prev.set(пользователь_id, поток)));
      
      // Создаем аудио элемент для воспроизведения
      const audio = new Audio();
      audio.srcObject = поток;
      audio.autoplay = true;
      audio.volume = 0.8;
      аудио_refs.current.set(пользователь_id, audio);
    },
    на_отключение_пользователя: (пользователь_id: string) => {
      setАудио_потоки(prev => {
        const новые = new Map(prev);
        новые.delete(пользователь_id);
        return новые;
      });
      
      // Удаляем аудио элемент
      const audio = аудио_refs.current.get(пользователь_id);
      if (audio) {
        audio.pause();
        audio.srcObject = null;
        аудио_refs.current.delete(пользователь_id);
      }
    }
  });

  // Обработчик переключения микрофона
  const обработать_переключение_микрофона = async () => {
    try {
      if (!локальный_поток) {
        await получить_микрофон();
      } else {
        переключить_микрофон();
      }
    } catch (error) {
      console.error('Ошибка переключения микрофона:', error);
    }
  };

  // Определение активности речи
  useEffect(() => {
    if (!локальный_поток) return;

    const аудио_контекст = new AudioContext();
    const источник = аудио_контекст.createMediaStreamSource(локальный_поток);
    const анализатор = аудио_контекст.createAnalyser();
    
    анализатор.fftSize = 256;
    источник.connect(анализатор);
    
    const данные = new Uint8Array(анализатор.frequencyBinCount);
    let говорит = false;
    
    const проверить_речь = () => {
      анализатор.getByteFrequencyData(данные);
      const громкость = данные.reduce((a, b) => a + b) / данные.length;
      const новое_состояние = громкость > 50 && микрофон_включен;
      
      if (новое_состояние !== говорит) {
        говорит = новое_состояние;
        
        // Обновляем локальное состояние
        setГоворящие_пользователи(prev => {
          const новые = new Set(prev);
          if (говорит) {
            новые.add(текущий_пользователь.id);
          } else {
            новые.delete(текущий_пользователь.id);
          }
          return новые;
        });
        
        // Уведомляем сервер
        if (socket && socket.уведомить_о_речи) {
          socket.уведомить_о_речи(говорит, комната.id);
        }
      }
      
      requestAnimationFrame(проверить_речь);
    };
    
    проверить_речь();
    
    return () => {
      аудио_контекст.close();
    };
  }, [локальный_поток, микрофон_включен, socket, текущий_пользователь.id, комната.id]);

  // Подписки на события WebSocket
  useEffect(() => {
    if (!socket) return;

    // Обновление участников комнаты
    const unsubscribe1 = подписаться('участники-комнаты-обновлены', (данные: any) => {
      if (данные.комната_id === комната.id) {
        setУчастники(данные.участники);
        
        // Подключаемся к новым участникам
        данные.участники.forEach((участник: Пользователь) => {
          if (участник.id !== текущий_пользователь.id) {
            подключиться_к_пользователю(участник.id);
          }
        });
      }
    });

    // Переключение микрофона других участников
    const unsubscribe2 = подписаться('микрофон-переключен', (данные: any) => {
      setУчастники(prev => prev.map(участник => 
        участник.id === данные.пользователь_id 
          ? { ...участник, микрофон_включен: данные.включен }
          : участник
      ));
    });

    // Индикация речи других участников
    const unsubscribe3 = подписаться('говорит', (данные: any) => {
      setГоворящие_пользователи(prev => {
        const новые = new Set(prev);
        if (данные.говорит) {
          новые.add(данные.пользователь_id);
        } else {
          новые.delete(данные.пользователь_id);
        }
        return новые;
      });
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
    };
  }, [socket, комната.id, текущий_пользователь.id, подключиться_к_пользователю, подписаться]);

  // Инициализация микрофона при входе в комнату
  useEffect(() => {
    получить_микрофон().catch(console.error);
    
    return () => {
      очистить();
      // Очищаем все аудио элементы
      аудио_refs.current.forEach(audio => {
        audio.pause();
        audio.srcObject = null;
      });
      аудио_refs.current.clear();
    };
  }, [получить_микрофон, очистить]);

  // Показать ошибку загрузки
  if (ошибка) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <div className="text-xl font-bold text-red-600 mb-2">Ошибка доступа к микрофону</div>
          <div className="text-gray-600 mb-4">{ошибка}</div>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Обновить страницу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Заголовок комнаты */}
      <div className="bg-white dark:bg-gray-800 shadow-md p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">{комната.название}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {участники.length} / {комната.максимум_участников} участников
            </p>
            {загружается && (
              <p className="text-xs text-blue-500">Подключение к голосовому чату...</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={на_покинуть_комнату}
              className="p-2 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
            >
              ❌
            </button>
          </div>
        </div>
      </div>

      {/* Участники комнаты */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {участники.map(участник => {
            const говорит = говорящие_пользователи.has(участник.id);
            const имеет_аудио = аудио_потоки.has(участник.id);
            
            return (
              <div
                key={участник.id}
                className={`relative p-4 rounded-xl bg-white dark:bg-gray-800 shadow-md transition-all duration-200 ${
                  говорит ? 'ring-2 ring-green-400 shadow-lg' : ''
                }`}
              >
                <div className="text-center">
                  {/* Аватар с индикацией речи */}
                  <div className={`text-3xl mb-2 transition-transform duration-200 ${
                    говорит ? 'scale-110' : ''
                  }`}>
                    {участник.аватар || '👤'}
                  </div>
                  
                  {/* Имя пользователя */}
                  <div className="font-medium text-gray-800 dark:text-white text-sm mb-2">
                    {участник.имя}
                    {участник.id === текущий_пользователь.id && ' (Вы)'}
                  </div>
                  
                  {/* Статус микрофона и подключения */}
                  <div className="flex justify-center items-center gap-2">
                    <span className={`text-lg ${участник.микрофон_включен ? 'text-green-500' : 'text-red-500'}`}>
                      {участник.микрофон_включен ? '🎤' : '🔇'}
                    </span>
                    
                    {участник.id !== текущий_пользователь.id && (
                      <span className={`text-xs ${имеет_аудио ? 'text-green-600' : 'text-gray-400'}`}>
                        {имеет_аудио ? '🔊' : '📶'}
                      </span>
                    )}
                    
                    {говорит && (
                      <span className="text-xs text-green-500 animate-pulse">
                        🗣️
                      </span>
                    )}
                  </div>
                  
                  {/* Индикатор качества соединения */}
                  {участник.id !== текущий_пользователь.id && (
                    <div className="mt-1 text-xs text-gray-500">
                      {имеет_аудио ? 'Подключен' : 'Подключается...'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Сообщение если только один участник */}
        {участники.length === 1 && (
          <div className="text-center mt-8 text-gray-500">
            <div className="text-4xl mb-2">👥</div>
            <div className="text-lg mb-1">Вы один в комнате</div>
            <div className="text-sm">Поделитесь ссылкой, чтобы пригласить друзей!</div>
          </div>
        )}
      </div>

      {/* Управление микрофоном */}
      <div className="bg-white dark:bg-gray-800 p-4 border-t">
        <div className="flex justify-center items-center gap-4">
          {/* Основная кнопка микрофона */}
          <button
            onClick={обработать_переключение_микрофона}
            disabled={загружается}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all duration-200 ${
              загружается 
                ? 'bg-gray-400 cursor-not-allowed' 
                : микрофон_включен 
                  ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl' 
                  : 'bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl'
            }`}
          >
            {загружается ? '⏳' : микрофон_включен ? '🎤' : '🔇'}
          </button>
        </div>
        
        {/* Описание и статус */}
        <div className="mt-2 text-center">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {загружается 
              ? 'Подключение к микрофону...' 
              : `Нажмите для ${микрофон_включен ? 'выключения' : 'включения'} микрофона`
            }
          </div>
          
          {локальный_поток && (
            <div className="text-xs text-green-600 mt-1">
              ✅ Микрофон подключен
            </div>
          )}
        </div>
        
        {/* Дополнительная информация */}
        <div className="mt-3 text-center text-xs text-gray-500">
          <div>WebRTC соединений: {аудио_потоки.size}</div>
          {говорящие_пользователи.size > 0 && (
            <div className="text-green-600">
              Говорят: {говорящие_пользователи.size} чел.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};