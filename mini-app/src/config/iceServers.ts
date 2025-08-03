// Конфигурация ICE серверов для WebRTC
// STUN серверы помогают определить публичный IP адрес
// TURN серверы используются как релей, когда прямое соединение невозможно

export interface ICEServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// Публичные STUN серверы
export const публичные_stun_серверы: ICEServer[] = [
  // Google STUN серверы
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  
  // Mozilla STUN сервер
  { urls: 'stun:stun.services.mozilla.com' },
  
  // Cloudflare STUN сервер
  { urls: 'stun:stun.cloudflare.com:3478' },
  
  // OpenRelay STUN серверы
  { urls: 'stun:openrelay.metered.ca:80' },
  
  // Twilio STUN серверы (бесплатные)
  { urls: 'stun:global.stun.twilio.com:3478' },
];

// Бесплатные TURN серверы от OpenRelay
// Для продакшена рекомендуется использовать свои TURN серверы
export const публичные_turn_серверы: ICEServer[] = [
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

// Получить конфигурацию ICE серверов
export function получить_ice_конфигурацию(использовать_turn: boolean = true): RTCConfiguration {
  const iceServers: ICEServer[] = [...публичные_stun_серверы];
  
  // Добавляем TURN серверы только если это необходимо
  if (использовать_turn) {
    iceServers.push(...публичные_turn_серверы);
  }
  
  // Добавляем пользовательские серверы из переменных окружения, если они есть
  if (process.env.NEXT_PUBLIC_CUSTOM_STUN_SERVER) {
    iceServers.push({ urls: process.env.NEXT_PUBLIC_CUSTOM_STUN_SERVER });
  }
  
  if (process.env.NEXT_PUBLIC_CUSTOM_TURN_SERVER) {
    const turnConfig: ICEServer = {
      urls: process.env.NEXT_PUBLIC_CUSTOM_TURN_SERVER,
    };
    
    if (process.env.NEXT_PUBLIC_TURN_USERNAME) {
      turnConfig.username = process.env.NEXT_PUBLIC_TURN_USERNAME;
    }
    
    if (process.env.NEXT_PUBLIC_TURN_CREDENTIAL) {
      turnConfig.credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
    }
    
    iceServers.push(turnConfig);
  }
  
  return {
    iceServers,
    iceCandidatePoolSize: 10, // Увеличиваем пул кандидатов для лучшей связности
    bundlePolicy: 'max-bundle', // Оптимизация для мобильных устройств
    rtcpMuxPolicy: 'require', // Уменьшает количество портов
  };
}

// Проверка доступности STUN/TURN серверов
export async function проверить_ice_сервер(server: ICEServer): Promise<boolean> {
  try {
    const pc = new RTCPeerConnection({
      iceServers: [server],
      iceCandidatePoolSize: 0,
    });
    
    let успех = false;
    
    // Ждем ICE кандидатов
    return new Promise((resolve) => {
      const таймаут = setTimeout(() => {
        pc.close();
        resolve(false);
      }, 5000); // 5 секунд таймаут
      
      pc.onicecandidate = (event) => {
        if (event.candidate && !успех) {
          успех = true;
          clearTimeout(таймаут);
          pc.close();
          resolve(true);
        }
      };
      
      // Создаем фиктивное предложение для запуска ICE gathering
      pc.createDataChannel('test');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
    });
  } catch (error) {
    console.error('Ошибка проверки ICE сервера:', error);
    return false;
  }
}

// Автоматический выбор лучших ICE серверов
export async function выбрать_лучшие_ice_серверы(): Promise<ICEServer[]> {
  const все_серверы = [...публичные_stun_серверы, ...публичные_turn_серверы];
  const рабочие_серверы: ICEServer[] = [];
  
  // Проверяем серверы параллельно
  const результаты = await Promise.allSettled(
    все_серверы.map(async (сервер) => {
      const доступен = await проверить_ice_сервер(сервер);
      return { сервер, доступен };
    })
  );
  
  // Фильтруем только рабочие серверы
  результаты.forEach((результат) => {
    if (результат.status === 'fulfilled' && результат.value.доступен) {
      рабочие_серверы.push(результат.value.сервер);
    }
  });
  
  // Если нет рабочих серверов, возвращаем минимальный набор
  if (рабочие_серверы.length === 0) {
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
  
  return рабочие_серверы;
}

// Конфигурация для разных сценариев
export const ice_конфигурации = {
  // Минимальная конфигурация (только Google STUN)
  минимальная: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ],
  },
  
  // Стандартная конфигурация (несколько STUN серверов)
  стандартная: {
    iceServers: публичные_stun_серверы.slice(0, 5),
  },
  
  // Полная конфигурация (STUN + TURN)
  полная: получить_ice_конфигурацию(true),
  
  // Мобильная конфигурация (оптимизирована для мобильных сетей)
  мобильная: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      ...публичные_turn_серверы,
    ],
    bundlePolicy: 'max-bundle' as RTCBundlePolicy,
    rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
    iceTransportPolicy: 'all' as RTCIceTransportPolicy,
  },
};