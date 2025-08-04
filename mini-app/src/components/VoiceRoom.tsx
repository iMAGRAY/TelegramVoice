'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Пользователь, Комната } from '@/types';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';

interface VoiceRoomProps {
  комната: Комната;
  текущий_пользователь: Пользователь;
  socket: any;
  на_покинуть_комнату: () => void;
}

interface АудиоПользователь extends Пользователь {
  громкость: number;
  аудио_элемент?: HTMLAudioElement;
}

export const VoiceRoom: React.FC<VoiceRoomProps> = ({
  комната,
  текущий_пользователь,
  socket,
  на_покинуть_комнату
}) => {
  const [участники, setУчастники] = useState<АудиоПользователь[]>([]);
  const [говорящие, setГоворящие] = useState<Set<string>>(new Set());
  const [громкость_входа, setГромкость_входа] = useState(50);
  const [показать_настройки, setПоказать_настройки] = useState(false);
  
  const аудио_элементы_ref = useRef<Map<string, HTMLAudioElement>>(new Map());
  const анализатор_звука_ref = useRef<AnalyserNode | null>(null);
  const аудио_контекст_ref = useRef<AudioContext | null>(null);
  
  const { вибрация, показатьПодтверждение } = useTelegramWebApp();

  const {
    подключения,
    локальный_поток,
    микрофон_включен,
    загружается,
    ошибка,
    получить_микрофон,
    подключиться_к_пользователю,
    переключить_микрофон,
    удалить_peer,
    очистить,
    синхронизировать_состояние_микрофона
  } = useWebRTC({
    пользователь_id: текущий_пользователь.id,
    комната_id: комната.id,
    socket,
    на_получение_потока: обработать_новый_поток,
    на_отключение_пользователя: обработать_отключение_пользователя
  });

  // Обработка получения нового аудио потока
  function обработать_новый_поток(поток: MediaStream, пользователь_id: string) {
    const аудио = new Audio();
    аудио.srcObject = поток;
    аудио.autoplay = true;
    аудио.volume = громкость_входа / 100;
    
    аудио_элементы_ref.current.set(пользователь_id, аудио);
    
    // Обновляем участника с аудио элементом
    setУчастники(prev => prev.map(участник => 
      участник.id === пользователь_id 
        ? { ...участник, аудио_элемент: аудио }
        : участник
    ));

    // Анализ громкости для индикации речи
    настроить_анализ_громкости(поток, пользователь_id);
  }

  // Настройка анализа громкости для определения говорящего
  const настроить_анализ_громкости = useCallback((поток: MediaStream, пользователь_id: string) => {
    try {
      if (!аудио_контекст_ref.current) {
        аудио_контекст_ref.current = new AudioContext();
      }

      const источник = аудио_контекст_ref.current.createMediaStreamSource(поток);
      const анализатор = аудио_контекст_ref.current.createAnalyser();
      
      анализатор.fftSize = 256;
      источник.connect(анализатор);
      
      const буфер = new Uint8Array(анализатор.frequencyBinCount);
      
      const проверить_громкость = () => {
        анализатор.getByteFrequencyData(буфер);
        const средняя_громкость = буфер.reduce((sum, value) => sum + value, 0) / буфер.length;
        
        const говорит = средняя_громкость > 20; // Порог для определения речи
        
        setГоворящие(prev => {
          const новые = new Set(prev);
          if (говорит) {
            новые.add(пользователь_id);
          } else {
            новые.delete(пользователь_id);
          }
          return новые;
        });

        // Обновляем громкость пользователя
        setУчастники(prev => prev.map(участник =>
          участник.id === пользователь_id
            ? { ...участник, громкость: средняя_громкость }
            : участник
        ));

        requestAnimationFrame(проверить_громкость);
      };
      
      проверить_громкость();
    } catch (error) {
      console.error('Ошибка настройки анализа громкости:', error);
    }
  }, []);

  // Обработка отключения пользователя
  function обработать_отключение_пользователя(пользователь_id: string) {
    const аудио = аудио_элементы_ref.current.get(пользователь_id);
    if (аудио) {
      аудио.pause();
      аудио.srcObject = null;
      аудио_элементы_ref.current.delete(пользователь_id);
    }
    
    setУчастники(prev => prev.filter(участник => участник.id !== пользователь_id));
    setГоворящие(prev => {
      const новые = new Set(prev);
      новые.delete(пользователь_id);
      return новые;
    });
  }

  // Инициализация микрофона при входе в комнату
  useEffect(() => {
    получить_микрофон().then(() => {
      // ИСПРАВЛЕНИЕ: Синхронизируем состояние после получения микрофона
      setTimeout(() => {
        синхронизировать_состояние_микрофона();
      }, 200);
    }).catch(error => {
      console.error('Не удалось получить доступ к микрофону:', error);
    });

    // Настройка анализа собственного микрофона
    if (локальный_поток) {
      настроить_анализ_громкости(локальный_поток, текущий_пользователь.id);
    }
  }, [получить_микрофон, локальный_поток, настроить_анализ_громкости, текущий_пользователь.id, синхронизировать_состояние_микрофона]);

  // Обработка обновления участников комнаты
  useEffect(() => {
    if (socket) {
      const обработать_обновление_участников = (новые_участники: Пользователь[]) => {
        setУчастники(prev => {
          const участники_карта = new Map(prev.map(u => [u.id, u]));
          
          return новые_участники.map(участник => ({
            ...участник,
            громкость: участники_карта.get(участник.id)?.громкость || 0,
            аудио_элемент: участники_карта.get(участник.id)?.аудио_элемент
          }));
        });

        // Подключаемся к новым пользователям
        новые_участники.forEach(участник => {
          if (участник.id !== текущий_пользователь.id && участник.подключен) {
            подключиться_к_пользователю(участник.id);
          }
        });
      };

      socket.on('участники-комнаты-обновлены', обработать_обновление_участников);
      
      return () => {
        socket.off('участники-комнаты-обновлены', обработать_обновление_участников);
      };
    }
  }, [socket, текущий_пользователь.id, подключиться_к_пользователю]);

  // Обработка переключения микрофона
  const обработать_переключение_микрофона = useCallback(() => {
    const новое_состояние = переключить_микрофон();
    вибрация();
    
    if (socket) {
      socket.emit('микрофон-переключен', {
        пользователь_id: текущий_пользователь.id,
        комната_id: комната.id,
        включен: новое_состояние
      });
    }
  }, [переключить_микрофон, вибрация, socket, текущий_пользователь.id, комната.id]);

  // Обработка выхода из комнаты
  const обработать_выход = useCallback(async () => {
    const подтвердить = await показатьПодтверждение('Вы уверены, что хотите покинуть голосовую комнату?');
    
    if (подтвердить) {
      очистить();
      на_покинуть_комнату();
    }
  }, [показатьПодтверждение, очистить, на_покинуть_комнату]);

  // Изменение громкости всех пользователей
  const изменить_громкость = useCallback((новая_громкость: number) => {
    setГромкость_входа(новая_громкость);
    
    аудио_элементы_ref.current.forEach(аудио => {
      аудио.volume = новая_громкость / 100;
    });
  }, []);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      аудио_элементы_ref.current.forEach(аудио => {
        аудио.pause();
        аудио.srcObject = null;
      });
      аудио_элементы_ref.current.clear();
      
      if (аудио_контекст_ref.current) {
        аудио_контекст_ref.current.close();
      }
    };
  }, []);

  if (ошибка) {
    return (
      <div className=\"flex flex-col items-center justify-center h-full p-4 text-center\">
        <div className=\"text-red-500 mb-4\">❌ {ошибка}</div>
        <button 
          onClick={на_покинуть_комнату}
          className=\"bg-gray-500 text-white px-6 py-2 rounded-lg\"
        >
          Вернуться назад
        </button>
      </div>
    );
  }

  return (
    <div className=\"flex flex-col h-full bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800\">
      {/* Заголовок комнаты */}
      <div className=\"bg-white dark:bg-gray-800 shadow-md p-4 border-b\">
        <div className=\"flex items-center justify-between\">
          <div>
            <h1 className=\"text-xl font-bold text-gray-800 dark:text-white\">{комната.название}</h1>
            <p className=\"text-sm text-gray-600 dark:text-gray-300\">
              {участники.length} / {комната.максимум_участников} участников
            </p>
          </div>
          <div className=\"flex gap-2\">
            <button
              onClick={() => setПоказать_настройки(!показать_настройки)}
              className=\"p-2 bg-gray-100 dark:bg-gray-700 rounded-lg\"
            >
              ⚙️
            </button>
            <button
              onClick={обработать_выход}
              className=\"p-2 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-lg\"
            >
              ❌
            </button>
          </div>
        </div>
      </div>

      {/* Настройки звука */}
      {показать_настройки && (
        <div className=\"bg-yellow-50 dark:bg-gray-700 p-4 border-b\">
          <div className=\"mb-2\">
            <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1\">
              Громкость входящего звука: {громкость_входа}%
            </label>
            <input
              type=\"range\"
              min=\"0\"
              max=\"100\"
              value={громкость_входа}
              onChange={(e) => изменить_громкость(Number(e.target.value))}
              className=\"w-full\"
            />
          </div>
        </div>
      )}

      {/* Список участников */}
      <div className=\"flex-1 overflow-y-auto p-4\">
        {загружается ? (
          <div className=\"flex items-center justify-center h-32\">
            <div className=\"text-gray-600 dark:text-gray-300\">Подключение к голосовой комнате...</div>
          </div>
        ) : (
          <div className=\"grid grid-cols-2 gap-4\">
            {участники.map(участник => (
              <div
                key={участник.id}
                className={`
                  relative p-4 rounded-xl transition-all duration-200
                  ${говорящие.has(участник.id) 
                    ? 'bg-green-100 dark:bg-green-900 ring-2 ring-green-400' 
                    : 'bg-white dark:bg-gray-800'
                  }
                  ${участник.id === текущий_пользователь.id ? 'border-2 border-blue-400' : ''}
                  shadow-md
                `}
              >
                <div className=\"text-center\">
                  <div className=\"text-2xl mb-2\">
                    {участник.аватар || '👤'}
                  </div>
                  <div className=\"font-medium text-gray-800 dark:text-white text-sm\">
                    {участник.имя}
                    {участник.id === текущий_пользователь.id && ' (Вы)'}
                  </div>
                  
                  {/* Индикатор микрофона */}
                  <div className=\"mt-2 flex justify-center\">
                    <span className={`text-lg ${участник.микрофон_включен ? 'text-green-500' : 'text-red-500'}`}>
                      {участник.микрофон_включен ? '🎤' : '🔇'}
                    </span>
                  </div>
                  
                  {/* Индикатор громкости */}
                  {говорящие.has(участник.id) && (
                    <div className=\"mt-1\">
                      <div className=\"text-xs text-green-600 dark:text-green-400\">
                        🔊 Говорит
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Панель управления */}
      <div className=\"bg-white dark:bg-gray-800 p-4 border-t\">
        <div className=\"flex justify-center\">
          <button
            onClick={обработать_переключение_микрофона}
            disabled={загружается}
            className={`
              w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all duration-200
              ${микрофон_включен 
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white'
              }
              ${загружается ? 'opacity-50 cursor-not-allowed' : 'shadow-lg hover:shadow-xl'}
            `}
          >
            {загружается ? '⏳' : (микрофон_включен ? '🎤' : '🔇')}
          </button>
        </div>
        
        <div className=\"mt-2 text-center text-xs text-gray-600 dark:text-gray-400\">
          Нажмите для {микрофон_включен ? 'выключения' : 'включения'} микрофона
        </div>
      </div>
    </div>
  );
};