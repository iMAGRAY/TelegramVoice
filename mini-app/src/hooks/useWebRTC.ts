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

      // ИСПРАВЛЕНИЕ: Синхронизируем состояние микрофона с реальным состоянием треков
      const аудио_треки = поток.getAudioTracks();
      if (аудио_треки.length > 0) {
        // Включаем микрофон по умолчанию при получении доступа
        аудио_треки.forEach(трек => {
          трек.enabled = true;
        });
        setМикрофон_включен(true);
      }

      setЛокальный_поток(поток);
      локальный_поток_ref.current = поток;
      
      // КРИТИЧНО: Уведомляем сервер о включении микрофона
      if (socket && socket.переключить_микрофон) {
        console.log('[useWebRTC] Уведомляем сервер о включении микрофона после получения потока');
        socket.переключить_микрофон(true, комната_id);
      }
      
      return поток;
    } catch (error) {
      console.error('[useWebRTC] Ошибка получения доступа к микрофону:', error);
      
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
  }, []);

  // Создание нового peer соединения
  const создать_peer = useCallback((удаленный_пользователь_id: string, инициатор: boolean = false) => {
    try {
      const peer = new SimplePeer({
        initiator: инициатор,
        trickle: false,
        stream: локальный_поток_ref.current || undefined,
        config: ice_config
      });

      const подключение: WebRTCПодключение = {
        peer,
        поток: null,
        пользователь_id: удаленный_пользователь_id,
        подключен: false
      };

      // Обработка сигналов
      peer.on('signal', (сигнал) => {
        console.log(`[WebRTC] Отправка сигнала от ${пользователь_id} к ${удаленный_пользователь_id}`, { 
          инициатор, 
          тип_сигнала: сигнал.type 
        });
        
        // Используем метод отправки WebRTC сигнала - отправляем удаленному пользователю!
        socket?.отправить_webrtc_сигнал(сигнал, удаленный_пользователь_id, комната_id);
      });

      // Получение удаленного потока
      peer.on('stream', (удаленный_поток) => {
        подключение.поток = удаленный_поток;
        подключение.подключен = true;
        
        setПодключения(prev => new Map(prev.set(удаленный_пользователь_id, подключение)));
        подключения_ref.current.set(удаленный_пользователь_id, подключение);
        
        на_получение_потока?.(удаленный_поток, удаленный_пользователь_id);
      });

      // Обработка подключения
      peer.on('connect', () => {
        console.log(`WebRTC соединение установлено с ${удаленный_пользователь_id}`);
        подключение.подключен = true;
      });

      // Обработка закрытия
      peer.on('close', () => {
        console.log(`WebRTC соединение закрыто с ${удаленный_пользователь_id}`);
        удалить_peer(удаленный_пользователь_id);
      });

      // Обработка ошибок
      peer.on('error', (error) => {
        console.error(`WebRTC ошибка с ${удаленный_пользователь_id}:`, error);
        удалить_peer(удаленный_пользователь_id);
      });

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
  const обработать_сигнал = useCallback((сообщение: СообщениеВебСокета) => {
    const { тип, данные, от } = сообщение;
    
    if (!от) return;

    let подключение = подключения_ref.current.get(от);

    if (тип === 'offer') {
      if (!подключение) {
        создать_peer(от, false);
        подключение = подключения_ref.current.get(от);
      }
      
      if (подключение) {
        подключение.peer.signal(данные);
      }
    } else if (тип === 'answer' && подключение) {
      подключение.peer.signal(данные);
    } else if (тип === 'ice-candidate' && подключение) {
      подключение.peer.signal(данные);
    }
  }, [создать_peer]);

  // Подключение к новому пользователю
  const подключиться_к_пользователю = useCallback((пользователь_id: string) => {
    if (!подключения_ref.current.has(пользователь_id)) {
      создать_peer(пользователь_id, true);
    }
  }, [создать_peer]);

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
      
      console.log(`[useWebRTC] Микрофон переключен: ${текущее_состояние} -> ${новое_состояние}`);
      
      // Уведомить других участников
      if (socket && socket.переключить_микрофон) {
        socket.переключить_микрофон(новое_состояние, комната_id);
      }
      
      return новое_состояние;
    }
    
    console.warn('[useWebRTC] Нет локального потока для переключения микрофона');
    return false;
  }, [пользователь_id, комната_id, socket]);

  // Очистка ресурсов
  const очистить = useCallback(() => {
    // Закрыть все peer соединения
    подключения_ref.current.forEach((подключение) => {
      подключение.peer.destroy();
    });
    подключения_ref.current.clear();
    setПодключения(new Map());

    // Остановить локальный поток
    if (локальный_поток_ref.current) {
      локальный_поток_ref.current.getTracks().forEach(трек => трек.stop());
      локальный_поток_ref.current = null;
      setЛокальный_поток(null);
    }
  }, []);

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
          console.log(`[useWebRTC] Синхронизация состояния микрофона: UI=${микрофон_включен}, трек=${фактическое_состояние}`);
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

  // ИСПРАВЛЕНИЕ: Синхронизация состояния при изменении потока
  useEffect(() => {
    if (локальный_поток) {
      // Даем небольшую задержку для стабилизации состояния
      const timer = setTimeout(() => {
        синхронизировать_состояние_микрофона();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [локальный_поток, синхронизировать_состояние_микрофона]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
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