import { useEffect, useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';
import { v4 as uuidv4 } from 'uuid';
import { WebRTCПодключение, СообщениеВебСокета } from '@/types';

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

  // Конфигурация ICE серверов
  const ice_config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

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

      setЛокальный_поток(поток);
      локальный_поток_ref.current = поток;
      
      return поток;
    } catch (error) {
      console.error('Ошибка получения доступа к микрофону:', error);
      setОшибка('Не удалось получить доступ к микрофону');
      throw error;
    } finally {
      setЗагружается(false);
    }
  }, []);

  // Создание нового peer соединения
  const создать_peer = useCallback((пользователь_id: string, инициатор: boolean = false) => {
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
        пользователь_id,
        подключен: false
      };

      // Обработка сигналов
      peer.on('signal', (сигнал) => {
        const сообщение: СообщениеВебСокета = {
          тип: инициатор ? 'offer' : 'answer',
          данные: сигнал,
          от: пользователь_id,
          к: пользователь_id,
          комната: комната_id,
          время: Date.now()
        };
        
        socket?.emit('webrtc-signal', сообщение);
      });

      // Получение удаленного потока
      peer.on('stream', (удаленный_поток) => {
        подключение.поток = удаленный_поток;
        подключение.подключен = true;
        
        setПодключения(prev => new Map(prev.set(пользователь_id, подключение)));
        подключения_ref.current.set(пользователь_id, подключение);
        
        на_получение_потока?.(удаленный_поток, пользователь_id);
      });

      // Обработка подключения
      peer.on('connect', () => {
        console.log(`WebRTC соединение установлено с ${пользователь_id}`);
        подключение.подключен = true;
      });

      // Обработка закрытия
      peer.on('close', () => {
        console.log(`WebRTC соединение закрыто с ${пользователь_id}`);
        удалить_peer(пользователь_id);
      });

      // Обработка ошибок
      peer.on('error', (error) => {
        console.error(`WebRTC ошибка с ${пользователь_id}:`, error);
        удалить_peer(пользователь_id);
      });

      подключения_ref.current.set(пользователь_id, подключение);
      setПодключения(prev => new Map(prev.set(пользователь_id, подключение)));

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
      аудио_треки.forEach(трек => {
        трек.enabled = !трек.enabled;
      });
      
      const новое_состояние = аудио_треки[0]?.enabled ?? false;
      setМикрофон_включен(новое_состояние);
      
      // Уведомить других участников
      if (socket) {
        socket.emit('микрофон-переключен', {
          пользователь_id,
          комната_id,
          включен: новое_состояние
        });
      }
      
      return новое_состояние;
    }
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

  useEffect(() => {
    if (socket) {
      socket.on('webrtc-signal', обработать_сигнал);
      
      return () => {
        socket.off('webrtc-signal', обработать_сигнал);
      };
    }
  }, [socket, обработать_сигнал]);

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
    получить_активные_соединения
  };
};