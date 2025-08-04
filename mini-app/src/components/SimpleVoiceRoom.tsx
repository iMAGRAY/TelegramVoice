'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Пользователь, Комната } from '@/types';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useMediaPermissions } from '@/hooks/useMediaPermissions';
import { useVoiceAnalyzer } from '@/hooks/useVoiceAnalyzer';
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
  console.log(`[SimpleVoiceRoom] 🎬 КОМПОНЕНТ МОНТИРУЕТСЯ для комнаты:`, комната.название);
  const [участники, setУчастники] = useState<Пользователь[]>([текущий_пользователь]);
  const [аудио_потоки, setАудио_потоки] = useState<Map<string, MediaStream>>(new Map());
  const [говорящие_пользователи, setГоворящие_пользователи] = useState<Set<string>>(new Set());
  const [показать_разрешения, setПоказать_разрешения] = useState(false);
  const [разрешения_проверены, setРазрешения_проверены] = useState(false);
  const [требуется_взаимодействие, setТребуется_взаимодействие] = useState(false);
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
    удалить_peer,
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

  // ИСПРАВЛЕНИЕ: Простое подключение БЕЗ бесконечных циклов
  const безопасно_подключиться_к_пользователю = useCallback((пользователь_id: string) => {
    console.log(`[SimpleVoiceRoom] 🔍 ДИАГНОСТИКА подключения к ${пользователь_id}:`, {
      есть_локальный_поток: !!локальный_поток,
      треки_в_потоке: локальный_поток?.getTracks().length || 0,
      треки_детали: локальный_поток?.getTracks().map(t => ({
        вид: t.kind,
        включен: t.enabled,
        готовность: t.readyState,
        id: t.id
      })),
      состояние_потока: локальный_поток?.active
    });
    
    if (!локальный_поток) {
      console.warn(`[SimpleVoiceRoom] ⚠️ ПРОПУСКАЕМ подключение к ${пользователь_id} - нет локального потока`);
      return;
    }
    
    console.log(`[SimpleVoiceRoom] ✅ Подключение к пользователю ${пользователь_id} с локальным потоком`);
    подключиться_к_пользователю(пользователь_id);
  }, [локальный_поток, подключиться_к_пользователю]);

  // Проверка разрешений при входе в комнату - ТОЛЬКО ОДИН РАЗ при изменении статуса
  useEffect(() => {
    if (!разрешения_проверены && поддерживается) {
      // Проверяем статус разрешений
      if (статус_микрофона === 'отклонено' || статус_микрофона === 'неизвестно') {
        // Показываем модальное окно разрешений
        setПоказать_разрешения(true);
      } else if (статус_микрофона === 'разрешено') {
        // Разрешения уже получены
        setРазрешения_проверены(true);
        // КРИТИЧНО: Сразу получаем микрофон если разрешения есть
        console.log('[SimpleVoiceRoom] 🎤 Разрешения уже есть, получаем микрофон');
        получить_микрофон().then((поток) => {
          console.log('[SimpleVoiceRoom] ✅ Микрофон получен после проверки разрешений:', {
            треки: поток?.getTracks().length || 0,
            активен: поток?.active,
            id: поток?.id
          });
          // ИСПРАВЛЕНИЕ: НЕ ВЫЗЫВАЕМ АВТОМАТИЧЕСКУЮ СИНХРОНИЗАЦИЮ
          console.log('[SimpleVoiceRoom] ✅ Микрофон готов к использованию');
        }).catch(error => {
          console.error('[SimpleVoiceRoom] ❌ Ошибка получения микрофона:', error);
        });
      }
    }
  }, [статус_микрофона, поддерживается, разрешения_проверены, получить_микрофон, синхронизировать_состояние_микрофона]); // Добавляем зависимости

  // Обработчики модального окна разрешений
  const обработать_разрешение_получено = () => {
    // Разрешение получено
    setПоказать_разрешения(false);
    setРазрешения_проверены(true);
    
    // КРИТИЧНО: Не создаем микрофон если он уже есть
    if (локальный_поток) {
      // Микрофон уже получен
      console.log('[SimpleVoiceRoom] ℹ️ Микрофон уже получен, пропускаем');
      return;
    }
    
    // Попытаемся получить микрофон после получения разрешения
    setTimeout(() => {
      // Получаем микрофон после разрешения
      получить_микрофон().then((поток) => {
        console.log('[SimpleVoiceRoom] ✅ Микрофон получен в обработчике разрешения:', {
          треки: поток?.getTracks().length || 0,
          активен: поток?.active,
          id: поток?.id
        });
        // ИСПРАВЛЕНИЕ: НЕ ВЫЗЫВАЕМ АВТОМАТИЧЕСКУЮ СИНХРОНИЗАЦИЮ
        console.log('[SimpleVoiceRoom] ✅ Микрофон готов к использованию');
      }).catch(error => {
        console.error('[SimpleVoiceRoom] ❌ Ошибка получения микрофона в обработчике разрешения:', error);
      });
    }, 100);
  };

  const обработать_разрешение_отклонено = () => {
    setПоказать_разрешения(false);
    setРазрешения_проверены(true);
    // Можно показать предупреждение о том, что микрофон недоступен
    // Пользователь отклонил разрешения
  };

  // Функция для воспроизведения всех аудио после взаимодействия
  const воспроизвести_все_аудио = () => {
    console.log('[Audio] Попытка воспроизведения всех аудио потоков');
    аудио_refs.current.forEach((аудио, пользователь_id) => {
      if (аудио.paused && аудио.srcObject) {
        аудио.play().then(() => {
          console.log(`[Audio] Успешно воспроизведен поток для ${пользователь_id}`);
        }).catch(error => {
          console.error(`[Audio] Ошибка воспроизведения для ${пользователь_id}:`, error);
        });
      }
    });
    setТребуется_взаимодействие(false);
  };

  // Воспроизведение аудио от других участников
  useEffect(() => {
    аудио_потоки.forEach((поток, пользователь_id) => {
      if (пользователь_id === текущий_пользователь.id) return;

      let аудио = аудио_refs.current.get(пользователь_id);
      
      if (!аудио) {
        аудио = new Audio();
        аудио.autoplay = true;
        аудио.volume = 1.0; // Убедимся что громкость максимальная
        аудио_refs.current.set(пользователь_id, аудио);
        
        // Обработка ошибок воспроизведения
        аудио.addEventListener('error', (e) => {
          console.error(`[Audio] Ошибка воспроизведения для пользователя ${пользователь_id}:`, e);
        });
      }

      if (аудио.srcObject !== поток) {
        console.log(`[Audio] Установка потока для пользователя ${пользователь_id}`, {
          треки: поток.getTracks().map(t => ({
            вид: t.kind,
            включен: t.enabled,
            readyState: t.readyState,
            muted: t.muted,
            id: t.id
          })),
          активен: поток.active
        });
        аудио.srcObject = поток;
        
        // КРИТИЧНО: Проверяем состояние аудио элемента
        console.log(`[Audio] Состояние аудио элемента:`, {
          paused: аудио.paused,
          muted: аудио.muted,
          volume: аудио.volume,
          srcObject: !!аудио.srcObject,
          readyState: аудио.readyState
        });
        
        // Добавляем обработчики событий для отладки
        аудио.addEventListener('loadedmetadata', () => {
          console.log(`[Audio] Метаданные загружены для ${пользователь_id}`);
        });
        
        аудио.addEventListener('canplay', () => {
          console.log(`[Audio] Аудио готово к воспроизведению для ${пользователь_id}`);
        });
        
        аудио.addEventListener('playing', () => {
          console.log(`[Audio] 🔊 Аудио играет для ${пользователь_id}`);
        });
        
        аудио.addEventListener('pause', () => {
          console.log(`[Audio] ⏸️ Аудио на паузе для ${пользователь_id}`);
        });
        
        // Попытка воспроизведения с обработкой ошибок
        аудио.play().then(() => {
          console.log(`[Audio] ✅ play() успешно вызван для ${пользователь_id}`);
        }).catch(error => {
          console.error(`[Audio] ❌ Ошибка воспроизведения для ${пользователь_id}:`, error);
          // Попробуем воспроизвести после взаимодействия пользователя
          console.log('[Audio] Требуется взаимодействие пользователя для воспроизведения');
          setТребуется_взаимодействие(true);
          
          // Добавляем обработчик для повторной попытки при клике
          const попытка_воспроизведения = () => {
            аудио.play().then(() => {
              console.log(`[Audio] ✅ Аудио воспроизводится после взаимодействия для ${пользователь_id}`);
              document.removeEventListener('click', попытка_воспроизведения);
              document.removeEventListener('touchstart', попытка_воспроизведения);
              setТребуется_взаимодействие(false);
            }).catch((err) => {
              console.error(`[Audio] ❌ Повторная ошибка воспроизведения:`, err);
            });
          };
          
          document.addEventListener('click', попытка_воспроизведения, { once: true });
          document.addEventListener('touchstart', попытка_воспроизведения, { once: true });
        });
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
      // Получен удаленный поток
      console.log(`[SimpleVoiceRoom] Получен удаленный поток от ${пользователь_id}`, {
        треки: поток.getTracks().map(t => ({
          вид: t.kind,
          включен: t.enabled,
          id: t.id,
          muted: t.muted,
          readyState: t.readyState
        }))
      });
      setАудио_потоки(prev => new Map(prev).set(пользователь_id, поток));
    });

    setОтключение_обработчик(() => (пользователь_id: string) => {
      // Пользователь отключился
      console.log(`[SimpleVoiceRoom] Пользователь ${пользователь_id} отключился`);
      setАудио_потоки(prev => {
        const новые_потоки = new Map(prev);
        новые_потоки.delete(пользователь_id);
        return новые_потоки;
      });
    });
  }, []);

  // Современный анализ аудио для индикации речи (AudioWorklet)
  useVoiceAnalyzer({
    поток: локальный_поток,
    микрофон_включен,
    на_изменение_речи: (говорит: boolean) => {
      if (говорит && !говорящие_пользователи.has(текущий_пользователь.id)) {
        socket?.уведомить_о_речи?.(true, комната.id);
        setГоворящие_пользователи(prev => new Set(prev).add(текущий_пользователь.id));
      } else if (!говорит && говорящие_пользователи.has(текущий_пользователь.id)) {
        socket?.уведомить_о_речи?.(false, комната.id);
        setГоворящие_пользователи(prev => {
          const новые = new Set(prev);
          новые.delete(текущий_пользователь.id);
          return новые;
        });
      }
    },
    порог_речи: 30
  });

  // Подписки на события WebSocket
  useEffect(() => {
    if (!socket) return;

    // Обновление участников комнаты
    const unsubscribe1 = подписаться('участники-комнаты-обновлены', (данные: any) => {
      if (данные.комната_id === комната.id) {
        // Обновление участников
        
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
        
        // ИСПРАВЛЕНИЕ: Подключаемся к новым участникам ТОЛЬКО если есть локальный поток
        if (локальный_поток) {
          данные.участники.forEach((участник: Пользователь) => {
            if (участник.id !== текущий_пользователь.id) {
              console.log(`[SimpleVoiceRoom] Подключение к участнику ${участник.id}`);
              безопасно_подключиться_к_пользователю(участник.id);
            }
          });
        } else {
          console.log(`[SimpleVoiceRoom] 🔄 Отложено подключение к участникам - ждем локальный поток`);
        }
      }
    });

    // КРИТИЧНО: Обработка присоединения нового пользователя
    const unsubscribe2 = подписаться('присоединился-к-комнате', (данные: any) => {
      if (данные.комната?.id === комната.id && данные.пользователь?.id !== текущий_пользователь.id) {
        console.log(`[SimpleVoiceRoom] Новый пользователь присоединился: ${данные.пользователь.имя}`);
        
        // Добавляем нового пользователя в список
        setУчастники(prev => {
          const существует = prev.some(у => у.id === данные.пользователь.id);
          if (!существует) {
            return [...prev, данные.пользователь];
          }
          return prev;
        });
        
        // Инициируем WebRTC соединение с новым пользователем
        setTimeout(() => {
          console.log(`[SimpleVoiceRoom] Подключаемся к новому пользователю ${данные.пользователь.id}`);
          безопасно_подключиться_к_пользователю(данные.пользователь.id);
        }, 1000); // Небольшая задержка для стабилизации
      }
    });

    // Обработка отключения пользователя
    const unsubscribe3 = подписаться('покинул-комнату', (данные: any) => {
      if (данные.комната_id === комната.id) {
        console.log(`[SimpleVoiceRoom] Пользователь покинул комнату: ${данные.пользователь_id}`);
        
        // Удаляем пользователя из списка
        setУчастники(prev => prev.filter(у => у.id !== данные.пользователь_id));
        
        // Удаляем WebRTC соединение
        удалить_peer(данные.пользователь_id);
      }
    });

    // Обновление состояния микрофона
    const unsubscribe4 = подписаться('микрофон-переключен', (данные: any) => {
      if (данные.комната_id === комната.id && данные.пользователь_id !== текущий_пользователь.id) {
        setУчастники(prev => prev.map(у => 
          у.id === данные.пользователь_id 
            ? { ...у, микрофон_включен: данные.включен }
            : у
        ));
      }
    });

    // Обновление индикации речи
    const unsubscribe5 = подписаться('говорит', (данные: any) => {
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
      unsubscribe4();
      unsubscribe5();
    };
  }, [socket, комната.id, текущий_пользователь.id, безопасно_подключиться_к_пользователю, подписаться, микрофон_включен, удалить_peer]);

  // ИСПРАВЛЕНИЕ: Отдельная инициализация микрофона БЕЗ запроса участников
  useEffect(() => {
    // Проверка инициализации микрофона
    console.log('[SimpleVoiceRoom] Проверка инициализации микрофона', {
      есть_локальный_поток: !!локальный_поток,
      разрешения_проверены,
      статус_микрофона
    });
    
    // КРИТИЧНО: Не создаем микрофон если он уже есть
    if (локальный_поток) {
      console.log('[SimpleVoiceRoom] Микрофон уже получен');
      return;
    }
    
    // Получаем микрофон ТОЛЬКО один раз при монтировании
    if (!разрешения_проверены) {
      console.log('[SimpleVoiceRoom] 🚀 ИНИЦИАЛИЗАЦИЯ МИКРОФОНА');
      получить_микрофон().then((поток) => {
        console.log('[SimpleVoiceRoom] ✅ Микрофон получен успешно:', {
          треки: поток?.getTracks().length || 0,
          активен: поток?.active,
          id: поток?.id
        });
        
        setРазрешения_проверены(true); // Отмечаем что разрешения получены
      }).catch(error => {
        console.error('[SimpleVoiceRoom] ❌ Ошибка получения микрофона:', error);
        console.log('[SimpleVoiceRoom] 📱 Показываем модальное окно для получения разрешений');
        setПоказать_разрешения(true); // Показываем модальное окно только при ошибке
      });
    }
    
    return () => {
      console.log(`[SimpleVoiceRoom] 🧹 РАЗМОНТИРОВАНИЕ SimpleVoiceRoom - вызываем очистку useWebRTC`);
      console.trace(`[SimpleVoiceRoom] 📍 СТЕК ВЫЗОВА РАЗМОНТИРОВАНИЯ:`);
      очистить();
      // Очищаем все аудио элементы
      аудио_refs.current.forEach(audio => {
        audio.srcObject = null;
      });
      аудио_refs.current.clear();
      console.log(`[SimpleVoiceRoom] ✅ Размонтирование SimpleVoiceRoom завершено`);
    };
  }, []); // Только при монтировании
  
  // ИСПРАВЛЕНИЕ: Отдельный эффект для запроса участников ПОСЛЕ получения микрофона
  useEffect(() => {
    if (локальный_поток && socket && socket.получить_пользователей_комнаты) {
      console.log('[SimpleVoiceRoom] 🎯 МИКРОФОН ГОТОВ - запрашиваем список участников комнаты');
      socket.получить_пользователей_комнаты(комната.id);
    }
  }, [локальный_поток, socket, комната.id]);
  
  // ИСПРАВЛЕНИЕ: Автоматическое подключение к существующим участникам при готовности микрофона
  useEffect(() => {
    if (локальный_поток && участники.length > 1) {
      console.log('[SimpleVoiceRoom] 🔗 АВТОПОДКЛЮЧЕНИЕ к существующим участникам');
      участники.forEach((участник: Пользователь) => {
        if (участник.id !== текущий_пользователь.id) {
          console.log(`[SimpleVoiceRoom] Автоподключение к участнику ${участник.id}`);
          безопасно_подключиться_к_пользователю(участник.id);
        }
      });
    }
  }, [локальный_поток, участники, текущий_пользователь.id, безопасно_подключиться_к_пользователю]);

  // Отслеживаем изменения локального потока
  useEffect(() => {
    console.log(`[SimpleVoiceRoom] 🔄 Изменение локального потока:`, {
      есть_поток: !!локальный_поток,
      треки: локальный_поток?.getTracks().length || 0,
      активен: локальный_поток?.active,
      детали_треков: локальный_поток?.getTracks().map(t => ({
        вид: t.kind,
        включен: t.enabled,
        готовность: t.readyState,
        id: t.id
      }))
    });
  }, [локальный_поток]);

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

      {/* Уведомление о необходимости взаимодействия */}
      {требуется_взаимодействие && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-[var(--warning)] text-white px-6 py-3 rounded-lg shadow-lg z-50">
          <div className="flex items-center gap-3">
            <span>🔊 Нажмите для включения звука</span>
            <button
              onClick={воспроизвести_все_аудио}
              className="px-4 py-1 bg-white text-[var(--warning)] rounded hover:bg-gray-100 transition-colors"
            >
              Включить звук
            </button>
          </div>
        </div>
      )}

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