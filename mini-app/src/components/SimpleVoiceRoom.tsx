'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Пользователь, Комната } from '@/types';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useMediaPermissions } from '@/hooks/useMediaPermissions';
import { Mic, MicOff, PhoneOff, Users, Volume2, Radio } from 'lucide-react';
import { ICEStatus } from './ICEStatus';
import { MediaPermissionModal } from './MediaPermissionModal';

interface VoiceRoomProps {
  комната: Комната;
  текущий_пользователь: Пользователь;
  socket: any;
  подписаться: (событие: string, обработчик: (...args: any[]) => void) => () => void;
  на_покинуть_комнату: () => void;
  на_открыть_настройки?: () => void;
}

export const SimpleVoiceRoom: React.FC<VoiceRoomProps> = ({
  комната,
  текущий_пользователь,
  socket,
  подписаться,
  на_покинуть_комнату,
  на_открыть_настройки
}) => {
  const [участники, setУчастники] = useState<Пользователь[]>([текущий_пользователь]);
  const [аудио_потоки, setАудио_потоки] = useState<Map<string, MediaStream>>(new Map());
  const [говорящие_пользователи, setГоворящие_пользователи] = useState<Set<string>>(new Set());
  const [показать_разрешения, setПоказать_разрешения] = useState(false);
  const [разрешения_проверены, setРазрешения_проверены] = useState(false);
  const аудио_refs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Обработчики для WebRTC
  const [удаленный_поток_обработчик, setУдаленный_поток_обработчик] = useState<((пользователь_id: string, поток: MediaStream) => void) | null>(null);
  const [отключение_обработчик, setОтключение_обработчик] = useState<((пользователь_id: string) => void) | null>(null);

  // Хук для работы с разрешениями
  const { статус_микрофона, поддерживается } = useMediaPermissions();

  // WebRTC хук
  const {
    локальный_поток,
    микрофон_включен,
    загружается,
    ошибка,
    переключить_микрофон,
    получить_микрофон,
    очистить,
    подключиться_к_пользователю,
    синхронизировать_состояние_микрофона
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

  // Проверка разрешений при входе в комнату
  useEffect(() => {
    const проверить_разрешения = async () => {
      if (!разрешения_проверены && поддерживается) {
        console.log('[SimpleVoiceRoom] Проверка разрешений микрофона, статус:', статус_микрофона);
        // Проверяем статус разрешений
        if (статус_микрофона === 'отклонено' || статус_микрофона === 'неизвестно') {
          console.log('[SimpleVoiceRoom] Показываем модальное окно разрешений');
          setПоказать_разрешения(true);
        } else if (статус_микрофона === 'разрешено') {
          console.log('[SimpleVoiceRoom] Разрешения уже получены, пропускаем модальное окно');
          setРазрешения_проверены(true);
        }
      }
    };

    проверить_разрешения();
  }, [статус_микрофона, поддерживается, разрешения_проверены]);

  // Обработчики модального окна разрешений
  const обработать_разрешение_получено = () => {
    console.log('[SimpleVoiceRoom] Разрешение получено, закрываем модальное окно');
    setПоказать_разрешения(false);
    setРазрешения_проверены(true);
    // Попытаемся получить микрофон после получения разрешения
    setTimeout(() => {
      console.log('[SimpleVoiceRoom] Пытаемся получить микрофон после разрешения');
      получить_микрофон().then(() => {
        console.log('[SimpleVoiceRoom] Микрофон получен успешно, синхронизируем состояние');
        // ИСПРАВЛЕНИЕ: Синхронизируем состояние после получения микрофона
        setTimeout(() => {
          синхронизировать_состояние_микрофона();
        }, 200);
      }).catch(error => {
        console.error('[SimpleVoiceRoom] Ошибка получения микрофона после разрешения:', error);
      });
    }, 100);
  };

  const обработать_разрешение_отклонено = () => {
    setПоказать_разрешения(false);
    setРазрешения_проверены(true);
    // Можно показать предупреждение о том, что микрофон недоступен
    console.log('Пользователь отклонил разрешения на микрофон');
  };

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
      console.log(`[SimpleVoiceRoom] Получен удаленный поток от ${пользователь_id}`);
      setАудио_потоки(prev => new Map(prev).set(пользователь_id, поток));
    });

    setОтключение_обработчик(() => (пользователь_id: string) => {
      console.log(`[SimpleVoiceRoom] Пользователь отключился: ${пользователь_id}`);
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
        console.log('[SimpleVoiceRoom] Обновление участников:', данные.участники);
        
        // ИСПРАВЛЕНИЕ: Обновляем состояние текущего пользователя с учетом локального состояния микрофона
        const обновленные_участники = данные.участники.map((участник: Пользователь) => {
          if (участник.id === текущий_пользователь.id) {
            // Для текущего пользователя используем локальное состояние микрофона
            return {
              ...участник,
              микрофон_включен: микрофон_включен
            };
          }
          return участник;
        });
        
        setУчастники(обновленные_участники);
        
        // Подключаемся к новым участникам
        данные.участники.forEach((участник: Пользователь) => {
          if (участник.id !== текущий_пользователь.id) {
            console.log(`[SimpleVoiceRoom] Подключение к пользователю ${участник.имя} (${участник.id})`);
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
  }, [socket, комната.id, текущий_пользователь.id, подключиться_к_пользователю, подписаться, микрофон_включен]);

  // Инициализация микрофона при входе в комнату - ТОЛЬКО если разрешения уже получены
  useEffect(() => {
    console.log('[SimpleVoiceRoom] Проверка инициализации микрофона:', {
      разрешения_проверены,
      статус_микрофона,
      поддерживается
    });
    
    // Не запрашиваем микрофон автоматически, если разрешения еще не проверены
    // или если статус не "разрешено" - пусть пользователь сначала даст разрешение через модальное окно
    if (разрешения_проверены && статус_микрофона === 'разрешено') {
      console.log('[SimpleVoiceRoom] Автоматически получаем микрофон - разрешения уже есть');
      получить_микрофон().then(() => {
        console.log('[SimpleVoiceRoom] Автоматическое получение микрофона успешно');
        // ИСПРАВЛЕНИЕ: Синхронизируем состояние после получения микрофона
        setTimeout(() => {
          синхронизировать_состояние_микрофона();
        }, 200);
      }).catch(error => {
        console.error('[SimpleVoiceRoom] Ошибка автоматического получения микрофона:', error);
      });
    } else {
      console.log('[SimpleVoiceRoom] Не получаем микрофон автоматически - нужны разрешения');
    }
    
    return () => {
      очистить();
      // Очищаем все аудио элементы
      аудио_refs.current.forEach(audio => {
        audio.srcObject = null;
      });
      аудио_refs.current.clear();
    };
  }, [разрешения_проверены, статус_микрофона, получить_микрофон, очистить, синхронизировать_состояние_микрофона]);

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
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-[var(--danger)] mb-4 text-lg font-semibold">Ошибка подключения</div>
          <div className="text-sm text-[var(--text-secondary)] mb-6">{ошибка}</div>
          <div className="space-y-3">
            <button
              onClick={() => setПоказать_разрешения(true)}
              className="w-full px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Проверить разрешения микрофона
            </button>
            <button
              onClick={на_покинуть_комнату}
              className="w-full px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
            >
              Вернуться назад
            </button>
          </div>
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
          <div className="flex items-center gap-2">
            {/* Индикатор статуса разрешений микрофона */}
            <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[var(--bg-secondary)]">
              <Mic className={`w-4 h-4 ${
                статус_микрофона === 'разрешено' 
                  ? 'text-[var(--success)]' 
                  : статус_микрофона === 'отклонено'
                  ? 'text-[var(--danger)]'
                  : 'text-[var(--text-tertiary)]'
              }`} />
              <span className={`text-xs ${
                статус_микрофона === 'разрешено' 
                  ? 'text-[var(--success)]' 
                  : статус_микрофона === 'отклонено'
                  ? 'text-[var(--danger)]'
                  : 'text-[var(--text-tertiary)]'
              }`}>
                {статус_микрофона === 'разрешено' ? 'Разрешено' : 
                 статус_микрофона === 'отклонено' ? 'Заблокировано' :
                 статус_микрофона === 'запрашивается' ? 'Запрос...' : 'Неизвестно'}
              </span>
            </div>

            {на_открыть_настройки && (
              <button
                onClick={на_открыть_настройки}
                className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                title="Настройки"
              >
                <svg className="w-5 h-5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
            <button
              onClick={на_покинуть_комнату}
              className="px-4 py-2 text-[var(--danger)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors flex items-center gap-2"
            >
              <PhoneOff className="w-4 h-4" />
              Покинуть
            </button>
          </div>
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
          <div className="flex items-center justify-between">
            {/* Статус соединения */}
            <div className="flex-1">
              <ICEStatus показать_подробности={false} />
            </div>
            
            {/* Кнопки управления */}
            <div className="flex items-center gap-4">
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
            
            {/* Пустое место справа для баланса */}
            <div className="flex-1"></div>
          </div>
        </div>
      </div>

      {/* Модальное окно запроса разрешений */}
      <MediaPermissionModal
        открыт={показать_разрешения}
        на_закрыть={() => setПоказать_разрешения(false)}
        на_разрешение_получено={обработать_разрешение_получено}
        на_разрешение_отклонено={обработать_разрешение_отклонено}
        требуется_микрофон={true}
        требуется_камера={false}
        заголовок="Доступ к микрофону"
        описание="Для участия в голосовом общении необходимо разрешить доступ к микрофону"
      />
    </div>
  );
};