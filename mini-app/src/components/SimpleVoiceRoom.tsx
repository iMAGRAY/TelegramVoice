'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Пользователь, Комната } from '@/types';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useMediaPermissions } from '@/hooks/useMediaPermissions';
import { useVoiceAnalyzer } from '@/hooks/useVoiceAnalyzer';
import { Mic, MicOff, PhoneOff, Users, Volume2, Radio, AlertTriangle } from 'lucide-react';
import { ICEStatus } from './ICEStatus';
import { MediaPermissionModal } from './MediaPermissionModal';
import { MicrophoneError } from './MicrophoneError';
import { checkWebRTCCapabilities, getBrowserInfo, getRecommendedSettings } from '@/utils/webrtcCompat';

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
  const [webrtc_диагностика, setWebrtc_диагностика] = useState<{
    совместимость_проверена: boolean;
    поддерживается: boolean;
    предупреждения: string[];
    рекомендации: string[];
  }>({
    совместимость_проверена: false,
    поддерживается: true,
    предупреждения: [],
    рекомендации: []
  });
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
    // Проверяем наличие локального потока перед подключением
    console.log(`[SimpleVoiceRoom] ❔ Подключение к ${пользователь_id}: микрофон ${локальный_поток ? 'есть' : 'ОТСУТСТВУЕТ'}`);
    
    if (!локальный_поток) {
      console.error(`[SimpleVoiceRoom] ❌ ОТКЛОНЕНО подключение к ${пользователь_id} - микрофон не получен`);
      return;
    }
    
    console.log(`[SimpleVoiceRoom] ✅ Подключение к пользователю ${пользователь_id} с локальным потоком`);
    подключиться_к_пользователю(пользователь_id);
  }, [локальный_поток, подключиться_к_пользователю]);

  // ИСПРАВЛЕНИЕ: Обработка прав доступа - без лишних зависимостей
  useEffect(() => {
    if (!разрешения_проверены && поддерживается) {
      if (статус_микрофона === 'отклонено' || статус_микрофона === 'неизвестно') {
        setПоказать_разрешения(true);
      } else if (статус_микрофона === 'разрешено') {
        setРазрешения_проверены(true);
        console.log('[SimpleVoiceRoom] 🎤 Разрешения уже есть');
      }
    }
  }, [статус_микрофона, поддерживается, разрешения_проверены]);

  // ИСПРАВЛЕНИЕ: Мемоизированные обработчики разрешений
  const обработать_разрешение_получено = useCallback(() => {
    setПоказать_разрешения(false);
    setРазрешения_проверены(true);
    
    if (!локальный_поток) {
      setTimeout(() => {
        получить_микрофон().catch(error => {
          console.error('[SimpleVoiceRoom] Ошибка получения микрофона:', error);
        });
      }, 100);
    }
  }, [локальный_поток, получить_микрофон]);

  const обработать_разрешение_отклонено = useCallback(() => {
    setПоказать_разрешения(false);
    setРазрешения_проверены(true);
  }, []);

  // УЛУЧШЕННАЯ функция для воспроизведения всех аудио после взаимодействия
  const воспроизвести_все_аудио = async () => {
    console.log('[Audio] Попытка воспроизведения всех аудио потоков после взаимодействия пользователя');
    
    const promises: Promise<void>[] = [];
    
    аудио_refs.current.forEach((аудио, пользователь_id) => {
      if (аудио.srcObject) {
        console.log(`[Audio] Состояние аудио для ${пользователь_id}:`, {
          paused: аудио.paused,
          muted: аудио.muted,
          volume: аудио.volume,
          readyState: аудио.readyState,
          networkState: аудио.networkState,
          currentTime: аудио.currentTime,
          hasStreamSource: !!аудио.srcObject
        });
        
        const playPromise = аудио.play().then(() => {
          console.log(`[Audio] ✅ Успешно воспроизведен поток для ${пользователь_id}`);
        }).catch(error => {
          console.error(`[Audio] ❌ Ошибка воспроизведения для ${пользователь_id}:`, error);
          
          // Дополнительная диагностика
          console.error(`[Audio] Диагностика ошибки для ${пользователь_id}:`, {
            errorName: error.name,
            errorMessage: error.message,
            audioState: {
              paused: аудио.paused,
              muted: аудио.muted,
              readyState: аудио.readyState,
              networkState: аудио.networkState,
              src: аудио.src,
              srcObject: !!аудио.srcObject
            }
          });
        });
        
        promises.push(playPromise);
      } else {
        console.warn(`[Audio] Нет srcObject для ${пользователь_id}, пропускаем`);
      }
    });
    
    try {
      await Promise.allSettled(promises);
      setТребуется_взаимодействие(false);
      console.log('[Audio] Завершена попытка воспроизведения всех аудио потоков');
    } catch (error) {
      console.error('[Audio] Ошибка при воспроизведении аудио потоков:', error);
    }
  };

  // Воспроизведение аудио от других участников
  useEffect(() => {
    аудио_потоки.forEach((поток, пользователь_id) => {
      if (пользователь_id === текущий_пользователь.id) return;

      let аудио = аудио_refs.current.get(пользователь_id);
      
      if (!аудио) {
        console.log(`[Audio] Создание нового audio элемента для ${пользователь_id}`);
        аудио = new Audio();
        
        // Настройки для лучшей совместимости
        аудио.autoplay = true;
        аудио.playsInline = true; // Важно для iOS Safari
        аудио.volume = 1.0;
        аудио.muted = false;
        аудио.controls = false;
        
        // Дополнительные атрибуты для мобильных браузеров
        (аудио as any).webkitPlaysInline = true; // Старые версии iOS
        (аудио as any).playsinline = true; // React/JSX стиль
        
        аудио_refs.current.set(пользователь_id, аудио);
        
        // РАСШИРЕННАЯ обработка событий аудио
        аудио.addEventListener('error', (e) => {
          console.error(`[Audio] Ошибка элемента аудио для ${пользователь_id}:`, {
            error: e,
            currentSrc: аудио.currentSrc,
            networkState: аудио.networkState,
            readyState: аудио.readyState,
            srcObject: !!аудио.srcObject
          });
        });
        
        аудио.addEventListener('abort', () => {
          console.log(`[Audio] Загрузка аудио прервана для ${пользователь_id}`);
        });
        
        аудио.addEventListener('stalled', () => {
          console.warn(`[Audio] Загрузка аудио застряла для ${пользователь_id}`);
        });
        
        аудио.addEventListener('suspend', () => {
          console.log(`[Audio] Загрузка аудио приостановлена для ${пользователь_id}`);
        });
        
        аудио.addEventListener('waiting', () => {
          console.log(`[Audio] Аудио ожидает данные для ${пользователь_id}`);
        });
        
        аудио.addEventListener('emptied', () => {
          console.log(`[Audio] Аудио элемент очищен для ${пользователь_id}`);
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
        
        // УЛУЧШЕННАЯ обработка воспроизведения аудио с учетом всех браузеров
        const попытаться_воспроизвести = async () => {
          try {
            // Сначала проверяем что srcObject корректно установлен
            if (!аудио.srcObject) {
              console.warn(`[Audio] Нет srcObject для ${пользователь_id}, пропускаем воспроизведение`);
              return;
            }
            
            // Ожидаем загрузку метаданных
            if (аудио.readyState < 2) {
              await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout waiting for metadata')), 5000);
                аудио.addEventListener('loadedmetadata', () => {
                  clearTimeout(timeout);
                  resolve(null);
                }, { once: true });
              });
            }
            
            await аудио.play();
            console.log(`[Audio] ✅ Аудио успешно воспроизводится для ${пользователь_id}`);
            setТребуется_взаимодействие(false);
          } catch (error: any) {
            console.error(`[Audio] ❌ Ошибка воспроизведения для ${пользователь_id}:`, error);
            
            // Проверяем тип ошибки autoplay
            if (error.name === 'NotAllowedError' || error.message.includes('autoplay')) {
              console.log('[Audio] Политика autoplay блокирует воспроизведение, требуется взаимодействие');
              setТребуется_взаимодействие(true);
              
              // Обработчик для повторной попытки после взаимодействия
              const обработчик_взаимодействия = async (event: Event) => {
                console.log(`[Audio] Получено взаимодействие (${event.type}), повторная попытка воспроизведения`);
                try {
                  await аудио.play();
                  console.log(`[Audio] ✅ Аудио воспроизводится после взаимодействия для ${пользователь_id}`);
                  setТребуется_взаимодействие(false);
                  
                  // Удаляем обработчики
                  document.removeEventListener('click', обработчик_взаимодействия);
                  document.removeEventListener('touchstart', обработчик_взаимодействия);
                  document.removeEventListener('keydown', обработчик_взаимодействия);
                } catch (retryError) {
                  console.error(`[Audio] ❌ Повторная ошибка воспроизведения:`, retryError);
                }
              };
              
              // Добавляем обработчики для разных типов взаимодействия
              document.addEventListener('click', обработчик_взаимодействия, { once: true });
              document.addEventListener('touchstart', обработчик_взаимодействия, { once: true });
              document.addEventListener('keydown', обработчик_взаимодействия, { once: true });
            } else {
              console.error(`[Audio] Неизвестная ошибка воспроизведения:`, error);
            }
          }
        };
        
        попытаться_воспроизвести();
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

  // Проверка совместимости WebRTC при монтировании
  useEffect(() => {
    const проверить_совместимость = async () => {
      console.log('[SimpleVoiceRoom] 🔍 Проверка совместимости WebRTC...');
      
      try {
        const capabilities = await checkWebRTCCapabilities();
        const browserInfo = getBrowserInfo();
        const recommendedSettings = getRecommendedSettings(browserInfo);
        
        console.log('[SimpleVoiceRoom] Результаты диагностики WebRTC:', {
          browser: browserInfo,
          capabilities,
          recommendedSettings
        });
        
        setWebrtc_диагностика({
          совместимость_проверена: true,
          поддерживается: capabilities.supported,
          предупреждения: [...capabilities.errors, ...capabilities.warnings],
          рекомендации: capabilities.recommendations
        });
        
        if (!capabilities.supported) {
          console.error('[SimpleVoiceRoom] ❌ WebRTC не поддерживается в данном браузере');
          setОшибка('WebRTC не поддерживается в вашем браузере. Попробуйте обновить браузер или использовать Chrome/Firefox.');
          return;
        }
        
        if (capabilities.warnings.length > 0) {
          console.warn('[SimpleVoiceRoom] ⚠️ Предупреждения WebRTC:', capabilities.warnings);
        }
        
      } catch (error) {
        console.error('[SimpleVoiceRoom] ❌ Ошибка проверки совместимости:', error);
        setWebrtc_диагностика(prev => ({
          ...prev,
          совместимость_проверена: true,
          предупреждения: ['Не удалось проверить совместимость WebRTC']
        }));
      }
    };
    
    проверить_совместимость();
  }, []);

  // ИСПРАВЛЕНИЕ: Однократная инициализация микрофона без лишних зависимостей
  useEffect(() => {
    let отменено = false;
    
    const инициализировать_микрофон = async () => {
      if (!webrtc_диагностика.поддерживается || локальный_поток || разрешения_проверены) {
        return;
      }
      
      console.log('[SimpleVoiceRoom] 🚀 ИНИЦИАЛИЗАЦИЯ МИКРОФОНА');
      
      try {
        const поток = await получить_микрофон();
        
        if (!отменено) {
          console.log('[SimpleVoiceRoom] ✅ Микрофон получен успешно');
          setРазрешения_проверены(true);
        }
      } catch (error) {
        if (!отменено) {
          console.error('[SimpleVoiceRoom] ❌ Ошибка получения микрофона:', error);
          setПоказать_разрешения(true);
        }
      }
    };
    
    if (webrtc_диагностика.совместимость_проверена) {
      инициализировать_микрофон();
    }
    
    return () => {
      отменено = true;
      console.log(`[SimpleVoiceRoom] 🧹 РАЗМОНТИРОВАНИЕ SimpleVoiceRoom`);
      очистить();
      аудио_refs.current.forEach(audio => {
        audio.srcObject = null;
      });
      аудио_refs.current.clear();
    };
  }, []); // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Пустой массив зависимостей!
  
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
      <MicrophoneError
        ошибка={ошибка}
        на_повторить={() => {
          setОшибка(null);
          получить_микрофон().catch(error => {
            console.error('[SimpleVoiceRoom] Повторная ошибка микрофона:', error);
          });
        }}
        на_показать_разрешения={() => setПоказать_разрешения(true)}
        на_покинуть={на_покинуть_комнату}
      />
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
            {/* Индикатор предупреждений WebRTC */}
            {webrtc_диагностика.предупреждения.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--warning)] bg-opacity-20" title={webrtc_диагностика.предупреждения.join('; ')}>
                <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
                <span className="text-xs text-[var(--warning)]">
                  {webrtc_диагностика.предупреждения.length} предупреждение{webrtc_диагностика.предупреждения.length > 1 ? 'я' : ''}
                </span>
              </div>
            )}

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
              <ICEStatus 
                показать_подробности={false} 
                websocket_подключен={socket?.readyState === WebSocket.OPEN}
                socket={socket}
              />
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