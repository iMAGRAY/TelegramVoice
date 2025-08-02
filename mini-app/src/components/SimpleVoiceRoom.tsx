'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Пользователь, Комната } from '@/types';
import { useWebRTC } from '@/hooks/useWebRTC';
import { Mic, MicOff, PhoneOff, Users, Volume2, Radio } from 'lucide-react';

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

  // Обработчики для WebRTC
  const [удаленный_поток_обработчик, setУдаленный_поток_обработчик] = useState<((пользователь_id: string, поток: MediaStream) => void) | null>(null);
  const [отключение_обработчик, setОтключение_обработчик] = useState<((пользователь_id: string) => void) | null>(null);

  // WebRTC хук
  const {
    локальный_поток,
    микрофон_включен,
    загружается,
    ошибка,
    переключить_микрофон,
    получить_микрофон,
    очистить,
    подключиться_к_пользователю
  } = useWebRTC({
    пользователь_id: текущий_пользователь.id,
    комната_id: комната.id,
    socket,
    на_получение_потока: (поток, пользователь_id) => {
      удаленный_поток_обработчик?.(пользователь_id, поток);
    },
    на_отключение_пользователя: (пользователь_id) => {
      отключение_обработчик?.(пользователь_id);
    }
  });

  // Воспроизведение аудио от других участников
  useEffect(() => {
    аудио_потоки.forEach((поток, пользователь_id) => {
      if (пользователь_id === текущий_пользователь.id) return;

      let аудио = аудио_refs.current.get(пользователь_id);
      
      if (!аудио) {
        аудио = new Audio();
        аудио.autoplay = true;
        аудио_refs.current.set(пользователь_id, аудио);
      }

      if (аудио.srcObject !== поток) {
        аудио.srcObject = поток;
      }
    });

    // Удаляем аудио элементы для отключившихся пользователей
    аудио_refs.current.forEach((аудио, пользователь_id) => {
      if (!аудио_потоки.has(пользователь_id)) {
        аудио.srcObject = null;
        аудио_refs.current.delete(пользователь_id);
      }
    });
  }, [аудио_потоки, текущий_пользователь.id]);

  // Обработка удаленных потоков
  useEffect(() => {
    setУдаленный_поток_обработчик(() => (пользователь_id: string, поток: MediaStream) => {
      setАудио_потоки(prev => new Map(prev).set(пользователь_id, поток));
    });

    setОтключение_обработчик(() => (пользователь_id: string) => {
      setАудио_потоки(prev => {
        const новые_потоки = new Map(prev);
        новые_потоки.delete(пользователь_id);
        return новые_потоки;
      });
    });
  }, []);

  // Анализ аудио для индикации речи
  useEffect(() => {
    if (!локальный_поток) return;

    const audio_context = new AudioContext();
    const analyser = audio_context.createAnalyser();
    const microphone = audio_context.createMediaStreamSource(локальный_поток);
    const javascript_node = audio_context.createScriptProcessor(2048, 1, 1);

    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;

    microphone.connect(analyser);
    analyser.connect(javascript_node);
    javascript_node.connect(audio_context.destination);

    javascript_node.onaudioprocess = () => {
      const array = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(array);
      
      const average = array.reduce((a, b) => a + b) / array.length;
      const говорит = микрофон_включен && average > 30;

      if (говорит && !говорящие_пользователи.has(текущий_пользователь.id)) {
        socket?.send(JSON.stringify({
          тип: 'говорит',
          пользователь_id: текущий_пользователь.id,
          комната_id: комната.id,
          говорит: true
        }));
        setГоворящие_пользователи(prev => new Set(prev).add(текущий_пользователь.id));
      } else if (!говорит && говорящие_пользователи.has(текущий_пользователь.id)) {
        socket?.send(JSON.stringify({
          тип: 'говорит',
          пользователь_id: текущий_пользователь.id,
          комната_id: комната.id,
          говорит: false
        }));
        setГоворящие_пользователи(prev => {
          const новые = new Set(prev);
          новые.delete(текущий_пользователь.id);
          return новые;
        });
      }
    };

    return () => {
      javascript_node.disconnect();
      microphone.disconnect();
      analyser.disconnect();
      audio_context.close();
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

    // Обновление состояния микрофона
    const unsubscribe2 = подписаться('микрофон-переключен', (данные: any) => {
      if (данные.комната_id === комната.id && данные.пользователь_id !== текущий_пользователь.id) {
        setУчастники(prev => prev.map(у => 
          у.id === данные.пользователь_id 
            ? { ...у, микрофон_включен: данные.включен }
            : у
        ));
      }
    });

    // Обновление индикации речи
    const unsubscribe3 = подписаться('говорит', (данные: any) => {
      if (данные.комната_id === комната.id) {
        if (данные.говорит) {
          setГоворящие_пользователи(prev => new Set(prev).add(данные.пользователь_id));
        } else {
          setГоворящие_пользователи(prev => {
            const новые = new Set(prev);
            новые.delete(данные.пользователь_id);
            return новые;
          });
        }
      }
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
        audio.srcObject = null;
      });
      аудио_refs.current.clear();
    };
  }, []);

  if (загружается) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Подключение к комнате...</div>
      </div>
    );
  }

  if (ошибка) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[var(--danger)] mb-2">Ошибка подключения</div>
          <div className="text-sm text-[var(--text-secondary)]">{ошибка}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Заголовок комнаты */}
      <header className="border-b border-[var(--border-color)] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{комната.название}</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {участники.length} участник{участники.length > 1 ? 'ов' : ''}
            </p>
          </div>
          <button
            onClick={на_покинуть_комнату}
            className="px-4 py-2 text-[var(--danger)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors flex items-center gap-2"
          >
            <PhoneOff className="w-4 h-4" />
            Покинуть
          </button>
        </div>
      </header>

      {/* Список участников */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {участники.map(участник => (
            <div
              key={участник.id}
              className={`
                p-4 rounded-lg border transition-all duration-200
                ${говорящие_пользователи.has(участник.id) 
                  ? 'border-[var(--accent)] bg-[var(--bg-secondary)]' 
                  : 'border-[var(--border-color)] bg-[var(--bg-primary)]'
                }
              `}
            >
              <div className="flex flex-col items-center text-center">
                <div className={`
                  w-16 h-16 rounded-full flex items-center justify-center mb-3
                  ${говорящие_пользователи.has(участник.id)
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                  }
                `}>
                  {участник.имя.charAt(0).toUpperCase()}
                </div>
                <div className="font-medium text-[var(--text-primary)] mb-1">
                  {участник.имя}
                  {участник.id === текущий_пользователь.id && ' (Вы)'}
                </div>
                <div className="flex items-center gap-2">
                  {участник.микрофон_включен ? (
                    <Mic className="w-4 h-4 text-[var(--text-secondary)]" />
                  ) : (
                    <MicOff className="w-4 h-4 text-[var(--danger)]" />
                  )}
                  {говорящие_пользователи.has(участник.id) && (
                    <Volume2 className="w-4 h-4 text-[var(--accent)] animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Панель управления */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--bg-primary)] border-t border-[var(--border-color)]">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={переключить_микрофон}
              className={`
                p-3 rounded-full transition-all duration-200
                ${микрофон_включен 
                  ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]' 
                  : 'bg-[var(--danger)] text-white hover:opacity-90'
                }
              `}
              title={микрофон_включен ? 'Выключить микрофон' : 'Включить микрофон'}
            >
              {микрофон_включен ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <Radio className="w-4 h-4" />
              {микрофон_включен ? 'Микрофон включен' : 'Микрофон выключен'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};