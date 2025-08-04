// Утилиты для проверки совместимости WebRTC и мобильных браузеров

export interface WebRTCCapabilities {
  supported: boolean;
  peerConnectionSupported: boolean;
  getUserMediaSupported: boolean;
  mediaStreamSupported: boolean;
  audioContextSupported: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface BrowserInfo {
  name: string;
  version: string;
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isTelegram: boolean;
}

// Определение браузера и платформы
export function getBrowserInfo(): BrowserInfo {
  const userAgent = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const isSafari = /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent);
  const isChrome = /Chrome/i.test(userAgent) && !/Edge/i.test(userAgent);
  const isFirefox = /Firefox/i.test(userAgent);
  const isTelegram = typeof window !== 'undefined' && window.Telegram?.WebApp;

  let name = 'Unknown';
  let version = 'Unknown';

  if (isChrome) {
    name = 'Chrome';
    const match = userAgent.match(/Chrome\/(\d+)/);
    version = match ? match[1] : 'Unknown';
  } else if (isSafari) {
    name = 'Safari';
    const match = userAgent.match(/Version\/(\d+)/);
    version = match ? match[1] : 'Unknown';
  } else if (isFirefox) {
    name = 'Firefox';
    const match = userAgent.match(/Firefox\/(\d+)/);
    version = match ? match[1] : 'Unknown';
  }

  if (isTelegram) {
    name = `${name} (Telegram)`;
  }

  return {
    name,
    version,
    isMobile,
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    isFirefox,
    isTelegram
  };
}

// Проверка возможностей WebRTC
export async function checkWebRTCCapabilities(): Promise<WebRTCCapabilities> {
  const capabilities: WebRTCCapabilities = {
    supported: false,
    peerConnectionSupported: false,
    getUserMediaSupported: false,
    mediaStreamSupported: false,
    audioContextSupported: false,
    errors: [],
    warnings: [],
    recommendations: []
  };

  const browserInfo = getBrowserInfo();

  // Проверка RTCPeerConnection
  try {
    const RTCPeerConnection = window.RTCPeerConnection || 
                            (window as any).webkitRTCPeerConnection || 
                            (window as any).mozRTCPeerConnection;
    
    if (RTCPeerConnection) {
      capabilities.peerConnectionSupported = true;
      
      // Тестовое создание соединения
      const testConnection = new RTCPeerConnection();
      testConnection.close();
    } else {
      capabilities.errors.push('RTCPeerConnection не поддерживается');
    }
  } catch (error) {
    capabilities.errors.push(`Ошибка RTCPeerConnection: ${error}`);
  }

  // Проверка getUserMedia
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      capabilities.getUserMediaSupported = true;
    } else if ((navigator as any).getUserMedia || 
               (navigator as any).webkitGetUserMedia || 
               (navigator as any).mozGetUserMedia) {
      capabilities.getUserMediaSupported = true;
      capabilities.warnings.push('Используется устаревший API getUserMedia');
    } else {
      capabilities.errors.push('getUserMedia не поддерживается');
    }
  } catch (error) {
    capabilities.errors.push(`Ошибка проверки getUserMedia: ${error}`);
  }

  // Проверка MediaStream
  try {
    if (window.MediaStream || (window as any).webkitMediaStream) {
      capabilities.mediaStreamSupported = true;
    } else {
      capabilities.errors.push('MediaStream не поддерживается');
    }
  } catch (error) {
    capabilities.errors.push(`Ошибка проверки MediaStream: ${error}`);
  }

  // Проверка AudioContext
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      capabilities.audioContextSupported = true;
    } else {
      capabilities.warnings.push('AudioContext не поддерживается - анализ речи недоступен');
    }
  } catch (error) {
    capabilities.warnings.push(`Ошибка проверки AudioContext: ${error}`);
  }

  // Общая оценка поддержки
  capabilities.supported = capabilities.peerConnectionSupported && 
                           capabilities.getUserMediaSupported && 
                           capabilities.mediaStreamSupported;

  // Специфичные рекомендации для разных браузеров
  if (browserInfo.isIOS && browserInfo.isSafari) {
    capabilities.recommendations.push('Safari iOS: Убедитесь что используется HTTPS');
    capabilities.recommendations.push('Safari iOS: Может требоваться взаимодействие пользователя для autoplay');
    
    if (parseInt(browserInfo.version) < 14) {
      capabilities.warnings.push('Safari iOS < 14: Ограниченная поддержка WebRTC');
    }
  }

  if (browserInfo.isAndroid && browserInfo.isChrome) {
    if (parseInt(browserInfo.version) < 70) {
      capabilities.warnings.push('Chrome Android < 70: Возможны проблемы с WebRTC');
    }
  }

  if (browserInfo.isTelegram) {
    capabilities.recommendations.push('Telegram: Используйте Telegram.WebApp.HapticFeedback для обратной связи');
    capabilities.recommendations.push('Telegram: Проверьте разрешения через Telegram API');
  }

  if (browserInfo.isMobile) {
    capabilities.recommendations.push('Мобильный браузер: Используйте playsInline для аудио элементов');
    capabilities.recommendations.push('Мобильный браузер: Оптимизируйте ICE серверы для мобильных сетей');
  }

  return capabilities;
}

// Получение рекомендованных настроек для текущего браузера
export function getRecommendedSettings(browserInfo: BrowserInfo) {
  const settings = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 44100,
      channelCount: 1
    },
    peer: {
      bundlePolicy: 'max-bundle' as RTCBundlePolicy,
      rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
      iceCandidatePoolSize: 10
    },
    htmlAudio: {
      autoplay: true,
      playsInline: true,
      controls: false,
      muted: false
    }
  };

  // Настройки для iOS Safari
  if (browserInfo.isIOS && browserInfo.isSafari) {
    settings.audio.sampleRate = 48000; // Лучше для iOS
    settings.htmlAudio.playsInline = true; // Критично для iOS
    settings.peer.iceCandidatePoolSize = 5; // Меньше для экономии батареи
  }

  // Настройки для Android Chrome
  if (browserInfo.isAndroid && browserInfo.isChrome) {
    settings.audio.echoCancellation = true; // Важно для Android
    settings.audio.noiseSuppression = true;
  }

  // Настройки для Firefox
  if (browserInfo.isFirefox) {
    settings.peer.bundlePolicy = 'balanced' as RTCBundlePolicy;
  }

  // Настройки для Telegram
  if (browserInfo.isTelegram) {
    // Telegram может иметь дополнительные ограничения
    settings.audio.autoGainControl = false; // Может конфликтовать с Telegram
  }

  return settings;
}

// Диагностика проблем WebRTC
export async function diagnoseWebRTCIssues(): Promise<{
  issues: string[];
  solutions: string[];
}> {
  const issues: string[] = [];
  const solutions: string[] = [];

  const capabilities = await checkWebRTCCapabilities();
  const browserInfo = getBrowserInfo();

  if (!capabilities.supported) {
    issues.push('WebRTC не поддерживается в данном браузере');
    solutions.push('Обновите браузер до последней версии');
    solutions.push('Используйте Chrome, Firefox или Safari');
  }

  if (!capabilities.getUserMediaSupported) {
    issues.push('Доступ к микрофону не поддерживается');
    solutions.push('Проверьте что сайт открыт по HTTPS');
    solutions.push('Проверьте разрешения браузера для микрофона');
  }

  if (browserInfo.isMobile && !capabilities.audioContextSupported) {
    issues.push('AudioContext недоступен на мобильном устройстве');
    solutions.push('Анализ речи будет недоступен');
  }

  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    issues.push('Сайт не использует HTTPS');
    solutions.push('WebRTC требует HTTPS для работы');
  }

  // Проверка доступности STUN/TURN серверов
  try {
    const connection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    connection.createDataChannel('test');
    await connection.createOffer();
    connection.close();
  } catch (error) {
    issues.push('Проблемы с ICE серверами');
    solutions.push('Проверьте подключение к интернету');
    solutions.push('Возможно заблокированы STUN/TURN серверы');
  }

  return { issues, solutions };
}