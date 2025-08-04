import { useEffect, useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';
import { v4 as uuidv4 } from 'uuid';
import { WebRTCПодключение, СообщениеВебСокета } from '@/types';
import { получить_ice_конфигурацию, ice_конфигурации } from '@/config/iceServers';

interface UseWebRTCProps {
  пользователь_id: string;
  комната_id: string;
  socket: any;
  на_получение_потока?: (поток: MediaStream, пользователь_id: string) => void;
  на_отключение_пользователя?: (пользователь_id: string) => void;
}

export const useWebRTC = ({
  пользователь_id,
  комната_id,
  socket,
  на_получение_потока,
  на_отключение_пользователя
}: UseWebRTCProps) => {
  const [подключения, setПодключения] = useState<Map<string, WebRTCПодключение>>(new Map());
  const [локальный_поток, setЛокальный_поток] = useState<MediaStream | null>(null);
  const [микрофон_включен, setМикрофон_включен] = useState(true);
  const [загружается, setЗагружается] = useState(false);
  const [ошибка, setОшибка] = useState<string | null>(null);

  const локальный_поток_ref = useRef<MediaStream | null>(null);
  const подключения_ref = useRef<Map<string, WebRTCПодключение>>(new Map());

  // Получаем конфигурацию ICE серверов
  // Используем полную конфигурацию с TURN серверами для лучшей связности
  const ice_config = получить_ice_конфигурацию(true);

  // Получение доступа к микрофону
  const получить_микрофон = useCallback(async () => {
    try {
      console.log(`[useWebRTC] 🎤 Начинаем получение доступа к микрофону...`);
      setЗагружается(true);
      setОшибка(null);

      const поток = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false
      });

      console.log(`[useWebRTC] ✅ Микрофон получен успешно:`, {
        треки: поток.getTracks().length,
        активен: поток.active,
        детали_треков: поток.getTracks().map(t => ({
          вид: t.kind,
          включен: t.enabled,
          готовность: t.readyState,
          id: t.id
        }))
      });

      // ИСПРАВЛЕНИЕ: Синхронизируем состояние микрофона с реальным состоянием треков
      const аудио_треки = поток.getAudioTracks();
      if (аудио_треки.length > 0) {
        // Включаем микрофон по умолчанию при получении доступа
        аудио_треки.forEach(трек => {
          трек.enabled = true;
        });
        setМикрофон_включен(true);
        console.log(`[useWebRTC] 🔊 Микрофон включен по умолчанию`);
      }

      setЛокальный_поток(поток);
      локальный_поток_ref.current = поток;
      console.log(`[useWebRTC] 📝 Локальный поток сохранен в состояние и ref`);
      
      // КРИТИЧНО: Уведомляем сервер о включении микрофона
      if (socket && socket.переключить_микрофон) {
        console.log(`[useWebRTC] 📡 Уведомляем сервер о включении микрофона`);
        socket.переключить_микрофон(true, комната_id);
      }
      
      return поток;
    } catch (error) {
      // Ошибка получения доступа к микрофону
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setОшибка('Доступ к микрофону запрещен. Проверьте разрешения браузера.');
        } else if (error.name === 'NotFoundError') {
          setОшибка('Микрофон не найден. Подключите микрофон и обновите страницу.');
        } else if (error.name === 'AbortError') {
          setОшибка('Запрос доступа к микрофону был прерван.');
        } else if (error.name === 'NotReadableError') {
          setОшибка('Микрофон используется другим приложением.');
        } else {
          setОшибка(`Ошибка микрофона: ${error.message}`);
        }
      } else {
        setОшибка('Не удалось получить доступ к микрофону');
      }
      
      throw error;
    } finally {
      setЗагружается(false);
    }
  }, [комната_id, socket]);

  // Создание нового peer соединения
  const создать_peer = useCallback((удаленный_пользователь_id: string, инициатор: boolean = false) => {
    try {
      console.log(`[WebRTC] Создание peer соединения для ${удаленный_пользователь_id}`, {
        инициатор,
        есть_локальный_поток: !!локальный_поток_ref.current,
        аудио_треки: локальный_поток_ref.current?.getAudioTracks().length || 0,
        треки_включены: локальный_поток_ref.current?.getAudioTracks().map(t => ({ id: t.id, enabled: t.enabled }))
      });
      
      // КРИТИЧНО: Проверяем наличие локального потока
      if (!локальный_поток_ref.current) {
        console.error('[WebRTC] ОШИБКА: Попытка создать peer соединение без локального потока!');
        return null;
      }
      
      // КРИТИЧНО: Проверяем что локальный поток активен
      const локальные_треки = локальный_поток_ref.current.getAudioTracks();
      console.log(`[WebRTC] Создание peer с ${локальные_треки.length} аудио треками`);
      локальные_треки.forEach((трек, индекс) => {
        console.log(`[WebRTC] Локальный трек ${индекс}: enabled=${трек.enabled}, muted=${трек.muted}, readyState=${трек.readyState}`);
      });
      
      const peer = new SimplePeer({
        initiator: инициатор,
        trickle: true, // КРИТИЧНО: включаем trickle ICE для быстрого соединения
        stream: локальный_поток_ref.current,
        config: ice_config,
        // Дополнительные настройки для улучшения качества связи
        offerOptions: {
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        },
        answerOptions: {
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        }
      });

      const подключение: WebRTCПодключение = {
        peer,
        поток: null,
        пользователь_id: удаленный_пользователь_id,
        подключен: false
      };

      // Обработка сигналов
      peer.on('signal', (сигнал) => {
        console.log(`[WebRTC] Отправка сигнала типа '${сигнал.type}' пользователю ${удаленный_пользователь_id}`);
        
        // Используем метод отправки WebRTC сигнала - отправляем удаленному пользователю!
        socket?.отправить_webrtc_сигнал(сигнал, удаленный_пользователь_id, комната_id);
      });

      // Получение удаленного потока
      peer.on('stream', (удаленный_поток) => {
        console.log(`[WebRTC] Получен удаленный поток от ${удаленный_пользователь_id}`, {
          треки: удаленный_поток.getTracks().map(t => ({ 
            вид: t.kind, 
            включен: t.enabled,
            id: t.id,
            muted: t.muted,
            readyState: t.readyState
          }))
        });
        
        // КРИТИЧНО: Проверяем наличие аудио треков
        const аудио_треки = удаленный_поток.getAudioTracks();
        if (аудио_треки.length === 0) {
          console.error(`[WebRTC] ⚠️ ВНИМАНИЕ: Получен поток без аудио треков от ${удаленный_пользователь_id}`);
        } else {
          console.log(`[WebRTC] ✅ Аудио треки получены: ${аудио_треки.length} шт.`);
        }
        
        подключение.поток = удаленный_поток;
        подключение.подключен = true;
        
        setПодключения(prev => new Map(prev.set(удаленный_пользователь_id, подключение)));
        подключения_ref.current.set(удаленный_пользователь_id, подключение);
        
        на_получение_потока?.(удаленный_поток, удаленный_пользователь_id);
      });

      // Обработка подключения
      peer.on('connect', () => {
        console.log(`[WebRTC] ✅ Соединение установлено с ${удаленный_пользователь_id}`);
        подключение.подключен = true;
        
        // КРИТИЧНО: Проверяем состояние потока после подключения
        const pc = (peer as any)._pc as RTCPeerConnection;
        if (pc) {
          console.log('[WebRTC] Состояние соединения:', {
            connectionState: pc.connectionState,
            iceConnectionState: pc.iceConnectionState,
            iceGatheringState: pc.iceGatheringState,
            signalingState: pc.signalingState,
            localStreams: pc.getSenders().map(s => ({
              track: s.track?.kind,
              enabled: s.track?.enabled,
              readyState: s.track?.readyState
            })),
            remoteStreams: pc.getReceivers().map(r => ({
              track: r.track?.kind,
              enabled: r.track?.enabled,
              readyState: r.track?.readyState
            }))
          });
        }
      });

      // Обработка закрытия
      peer.on('close', () => {
        // WebRTC соединение закрыто
        удалить_peer(удаленный_пользователь_id);
      });

      // Обработка ошибок
      peer.on('error', (error) => {
        console.error(`[WebRTC] Ошибка соединения с ${удаленный_пользователь_id}:`, error);
        удалить_peer(удаленный_пользователь_id);
      });
      
      // КРИТИЧНО: Мониторинг ICE состояния
      const pc = (peer as any)._pc as RTCPeerConnection;
      if (pc) {
        pc.addEventListener('iceconnectionstatechange', () => {
          console.log(`[WebRTC] ICE состояние с ${удаленный_пользователь_id}: ${pc.iceConnectionState}`);
          
          if (pc.iceConnectionState === 'failed') {
            console.error(`[WebRTC] ⚠️ ICE соединение не удалось с ${удаленный_пользователь_id}`);
          }
        });
        
        pc.addEventListener('icegatheringstatechange', () => {
          console.log(`[WebRTC] ICE gathering состояние с ${удаленный_пользователь_id}: ${pc.iceGatheringState}`);
        });
        
        pc.addEventListener('connectionstatechange', () => {
          console.log(`[WebRTC] Общее состояние соединения с ${удаленный_пользователь_id}: ${pc.connectionState}`);
        });
      }

      подключения_ref.current.set(удаленный_пользователь_id, подключение);
      setПодключения(prev => new Map(prev.set(удаленный_пользователь_id, подключение)));

      return peer;
    } catch (error) {
      console.error('Ошибка создания peer соединения:', error);
      setОшибка('Ошибка создания соединения');
      return null;
    }
  }, [комната_id, socket, на_получение_потока]);

  // Удаление peer соединения
  const удалить_peer = useCallback((пользователь_id: string) => {
    const подключение = подключения_ref.current.get(пользователь_id);
    
    if (подключение) {
      подключение.peer.destroy();
      подключения_ref.current.delete(пользователь_id);
      setПодключения(prev => {
        const новые = new Map(prev);
        новые.delete(пользователь_id);
        return новые;
      });
      
      на_отключение_пользователя?.(пользователь_id);
    }
  }, [на_отключение_пользователя]);

  // Обработка входящих сигналов WebRTC
  const обработать_сигнал = useCallback((сообщение: any) => {
    console.log('[WebRTC] Получен сигнал:', сообщение);
    
    // Сервер отправляет сообщение с полями: тип: 'webrtc-signal', от, к, комната, данные
    const { от, данные } = сообщение;
    
    if (!от || !данные) return;

    let подключение = подключения_ref.current.get(от);

    // SimplePeer использует данные с полем type для определения типа сигнала
    const тип_сигнала = данные.type || данные.candidate?.type;
    
    console.log(`[WebRTC] Получен сигнал типа '${тип_сигнала}' от ${от}`);
    
    if (тип_сигнала === 'offer') {
      // ИСПРАВЛЕНИЕ: Проверяем наличие локального потока БЕЗ рекурсивного вызова
      if (!локальный_поток_ref.current) {
        console.error(`[WebRTC] ❌ ОТКЛОНЁН offer от ${от} - нет локального потока (микрофон не получен)`);
        // НЕ создаем бесконечный цикл - просто отклоняем offer
        return;
      }
      
      if (!подключение) {
        console.log(`[WebRTC] Создание peer соединения для ответа пользователю ${от}`);
        const peer = создать_peer(от, false);
        if (!peer) {
          console.error(`[WebRTC] Не удалось создать peer для ${от}`);
          return;
        }
        подключение = подключения_ref.current.get(от);
      }
      
      if (подключение) {
        console.log(`[WebRTC] Передача offer сигнала peer соединению с ${от}`);
        подключение.peer.signal(данные);
      }
    } else if (подключение) {
      // Обрабатываем answer и candidate (trickle ICE)
      console.log(`[WebRTC] Обработка сигнала ${тип_сигнала} от ${от}`);
      подключение.peer.signal(данные);
    } else if (!подключение && тип_сигнала !== 'offer') {
      console.warn(`[WebRTC] Получен сигнал ${тип_сигнала} от ${от}, но соединение еще не создано - пропускаем`);
    }
  }, [создать_peer]);

  // Подключение к новому пользователю
  const подключиться_к_пользователю = useCallback((пользователь_id: string) => {
    console.log(`[useWebRTC] 🔗 Попытка подключения к пользователю ${пользователь_id}`);
    
    // КРИТИЧНО: Проверяем наличие локального потока перед подключением
    console.log(`[useWebRTC] 🔍 ДИАГНОСТИКА состояния перед подключением:`, {
      есть_локальный_поток_ref: !!локальный_поток_ref.current,
      есть_локальный_поток_state: !!локальный_поток,
      треки_в_ref: локальный_поток_ref.current?.getTracks().length || 0,
      треки_в_state: локальный_поток?.getTracks().length || 0,
      активность_ref: локальный_поток_ref.current?.active,
      активность_state: локальный_поток?.active,
      существующее_подключение: подключения_ref.current.has(пользователь_id)
    });
    
    if (!локальный_поток_ref.current) {
      console.error(`[WebRTC] ❌ КРИТИЧЕСКАЯ ОШИБКА: Попытка подключиться к ${пользователь_id} без локального потока - отклонено`);
      return;
    }
    
    if (!подключения_ref.current.has(пользователь_id)) {
      console.log(`[useWebRTC] 🚀 Создаем новое peer соединение с ${пользователь_id}`);
      создать_peer(пользователь_id, true);
    } else {
      console.log(`[useWebRTC] ℹ️ Подключение к ${пользователь_id} уже существует`);
    }
  }, [создать_peer, локальный_поток]);

  // Переключение микрофона
  const переключить_микрофон = useCallback(() => {
    if (локальный_поток_ref.current) {
      const аудио_треки = локальный_поток_ref.current.getAudioTracks();
      
      // ИСПРАВЛЕНИЕ: Сначала получаем текущее состояние, потом переключаем
      const текущее_состояние = аудио_треки[0]?.enabled ?? false;
      const новое_состояние = !текущее_состояние;
      
      аудио_треки.forEach(трек => {
        трек.enabled = новое_состояние;
      });
      
      setМикрофон_включен(новое_состояние);
      
      // Микрофон переключен
      
      // Уведомить других участников
      if (socket && socket.переключить_микрофон) {
        socket.переключить_микрофон(новое_состояние, комната_id);
      }
      
      return новое_состояние;
    }
    
    // Нет локального потока
    return false;
  }, [пользователь_id, комната_id, socket]);

  // Очистка ресурсов
  const очистить = useCallback(() => {
    console.log(`[useWebRTC] 🧹 ОЧИСТКА РЕСУРСОВ НАЧАТА`);
    console.log(`[useWebRTC] 📊 Состояние перед очисткой:`, {
      количество_подключений: подключения_ref.current.size,
      есть_локальный_поток_ref: !!локальный_поток_ref.current,
      есть_локальный_поток_state: !!локальный_поток,
      треки_в_потоке: локальный_поток_ref.current?.getTracks().length || 0
    });
    
    // Выводим стек вызова чтобы понять откуда идет очистка
    console.trace(`[useWebRTC] 📍 СТЕК ВЫЗОВА ОЧИСТКИ:`);
    
    // Закрыть все peer соединения
    подключения_ref.current.forEach((подключение) => {
      console.log(`[useWebRTC] 🔌 Закрываем peer соединение с ${подключение.пользователь_id}`);
      подключение.peer.destroy();
    });
    подключения_ref.current.clear();
    setПодключения(new Map());
    console.log(`[useWebRTC] ✅ Все peer соединения закрыты`);

    // Остановить локальный поток
    if (локальный_поток_ref.current) {
      console.log(`[useWebRTC] 🎤 ОСТАНАВЛИВАЕМ ЛОКАЛЬНЫЙ ПОТОК`);
      локальный_поток_ref.current.getTracks().forEach((трек, индекс) => {
        console.log(`[useWebRTC] 🛑 Останавливаем трек ${индекс}: ${трек.kind} (${трек.id})`);
        трек.stop();
      });
      локальный_поток_ref.current = null;
      setЛокальный_поток(null);
      console.log(`[useWebRTC] ❌ ЛОКАЛЬНЫЙ ПОТОК ОЧИЩЕН`);
    } else {
      console.log(`[useWebRTC] ℹ️ Локальный поток уже отсутствует`);
    }
    
    console.log(`[useWebRTC] 🏁 ОЧИСТКА РЕСУРСОВ ЗАВЕРШЕНА`);
  }, [локальный_поток]);

  // Получить активные соединения
  const получить_активные_соединения = useCallback(() => {
    return Array.from(подключения_ref.current.values()).filter(conn => conn.подключен);
  }, []);

  // ИСПРАВЛЕНИЕ: Функция для синхронизации состояния микрофона с треками
  const синхронизировать_состояние_микрофона = useCallback(() => {
    if (локальный_поток_ref.current) {
      const аудио_треки = локальный_поток_ref.current.getAudioTracks();
      if (аудио_треки.length > 0) {
        const фактическое_состояние = аудио_треки[0].enabled;
        if (фактическое_состояние !== микрофон_включен) {
          // Синхронизация состояния микрофона
          setМикрофон_включен(фактическое_состояние);
          
          // Уведомить других участников о реальном состоянии
          if (socket && socket.переключить_микрофон) {
            socket.переключить_микрофон(фактическое_состояние, комната_id);
          }
        }
      }
    }
  }, [микрофон_включен, комната_id, socket]);

  useEffect(() => {
    if (socket && socket.подписаться) {
      const unsubscribe = socket.подписаться('webrtc-signal', обработать_сигнал);
      
      return () => {
        unsubscribe();
      };
    }
  }, [socket, обработать_сигнал]);

  // ИСПРАВЛЕНИЕ: Отслеживание изменений локального потока БЕЗ автоматической синхронизации
  useEffect(() => {
    console.log(`[useWebRTC] 🔄 Изменение локального потока:`, {
      есть_поток: !!локальный_поток,
      треки: локальный_поток?.getTracks().length || 0,
      активен: локальный_поток?.active,
      ref_синхронизирован: локальный_поток_ref.current === локальный_поток
    });
    
    if (!локальный_поток) {
      console.warn(`[useWebRTC] ⚠️ Локальный поток стал null/undefined!`);
    }
    
    // КРИТИЧНО: НЕ ВЫЗЫВАЕМ АВТОМАТИЧЕСКУЮ СИНХРОНИЗАЦИЮ - это причина цикла!
    // Синхронизация будет вызываться вручную из компонентов когда нужно
  }, [локальный_поток]);

  // Очистка при размонтировании
  useEffect(() => {
    console.log(`[useWebRTC] 🎬 useWebRTC хук МОНТИРУЕТСЯ`);
    
    return () => {
      console.log(`[useWebRTC] 🎬 useWebRTC хук РАЗМОНТИРУЕТСЯ - вызываем очистку`);
      очистить();
    };
  }, [очистить]);

  return {
    подключения: Array.from(подключения.values()),
    локальный_поток,
    микрофон_включен,
    загружается,
    ошибка,
    получить_микрофон,
    подключиться_к_пользователю,
    переключить_микрофон,
    удалить_peer,
    очистить,
    получить_активные_соединения,
    синхронизировать_состояние_микрофона
  };
};