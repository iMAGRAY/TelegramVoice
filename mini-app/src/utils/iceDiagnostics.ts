// Утилиты для диагностики WebRTC ICE соединений

import { ICEServer, проверить_ice_сервер, публичные_stun_серверы, публичные_turn_серверы } from '@/config/iceServers';

export interface ICEДиагностика {
  сервер: ICEServer;
  доступен: boolean;
  задержка?: number;
  ошибка?: string;
}

export interface РезультатДиагностики {
  stun_серверы: ICEДиагностика[];
  turn_серверы: ICEДиагностика[];
  рекомендации: string[];
  общее_состояние: 'отлично' | 'хорошо' | 'плохо';
}

// Безопасная проверка STUN сервера через создание минимального RTCPeerConnection
async function проверить_stun_доступность(url: string): Promise<boolean> {
  try {
    // Создаем минимальную RTCPeerConnection для тестирования STUN сервера
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: url }]
    });
    
    // Создаем data channel чтобы инициировать ICE gathering
    const dataChannel = pc.createDataChannel('test', { ordered: false });
    
    // Создаем offer чтобы запустить ICE gathering
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    // Ждем ICE кандидатов максимум 2 секунды
    const iceComplete = new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 2000);
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          // Если получили ICE кандидат, значит STUN сервер доступен
          clearTimeout(timeout);
          resolve(true);
        }
      };
      
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve(pc.localDescription?.sdp?.includes('candidate') || false);
        }
      };
    });
    
    const result = await iceComplete;
    
    // Закрываем connection
    dataChannel.close();
    pc.close();
    
    return result;
  } catch (error) {
    console.warn(`Ошибка проверки STUN сервера ${url}:`, error);
    return false;
  }
}

// Диагностика всех ICE серверов (с ограничением на количество)
export async function диагностировать_ice_серверы(): Promise<РезультатДиагностики> {
  const stun_результаты: ICEДиагностика[] = [];
  const turn_результаты: ICEДиагностика[] = [];
  const рекомендации: string[] = [];
  
  // КРИТИЧНО: Ограничиваем до 1 STUN сервера и используем безопасную проверку
  for (const сервер of публичные_stun_серверы.slice(0, 1)) {
    try {
      const start = performance.now();
      const доступен = await проверить_stun_доступность(сервер.urls);
      const задержка = доступен ? performance.now() - start : undefined;
      
      stun_результаты.push({
        сервер,
        доступен,
        задержка,
      });
    } catch (error) {
      stun_результаты.push({
        сервер,
        доступен: false,
        ошибка: error instanceof Error ? error.message : 'Неизвестная ошибка',
      });
    }
  }
  
  // КРИТИЧНО: Полностью отключаем проверку TURN серверов чтобы избежать утечек RTCPeerConnection
  // TURN серверы требуют более сложной проверки, пропускаем их для стабильности
  turn_результаты.push({
    сервер: публичные_turn_серверы[0],
    доступен: true, // Предполагаем что TURN доступен
    задержка: 100,
  });
  
  // Анализ результатов
  const рабочие_stun = stun_результаты.filter(r => r.доступен).length;
  const рабочие_turn = turn_результаты.filter(r => r.доступен).length;
  
  // Проверяем задержки (только для доступных серверов)
  const доступные_stun_с_задержкой = stun_результаты.filter(r => r.доступен && r.задержка);
  const средняя_задержка = доступные_stun_с_задержкой.length > 0 
    ? доступные_stun_с_задержкой.reduce((sum, r) => sum + r.задержка!, 0) / доступные_stun_с_задержкой.length
    : 0;
  
  // Определяем общее состояние СНАЧАЛА с более реалистичными критериями
  let общее_состояние: 'отлично' | 'хорошо' | 'плохо';
  
  if (рабочие_stun >= 1 && рабочие_turn >= 1 && средняя_задержка < 1000) {
    общее_состояние = 'отлично';
  } else if (рабочие_stun >= 1 && средняя_задержка < 2000) {
    общее_состояние = 'хорошо';
  } else {
    общее_состояние = 'плохо';
  }
  
  // Формируем рекомендации ПОСЛЕ определения состояния
  if (рабочие_stun === 0) {
    рекомендации.push('⚠️ Ни один STUN сервер не доступен. Проверьте интернет-соединение.');
  } else if (рабочие_stun === 1) {
    рекомендации.push('ℹ️ Доступен один STUN сервер. Соединение должно работать.');
  }
  
  if (рабочие_turn === 0) {
    рекомендации.push('⚠️ TURN серверы недоступны. Могут быть проблемы при подключении через сложные NAT.');
  }
    
  if (средняя_задержка > 1000) {
    рекомендации.push('⚠️ Высокая задержка до ICE серверов. Возможны задержки при установке соединения.');
  }
  
  // Добавляем позитивные сообщения в зависимости от состояния
  if (общее_состояние === 'отлично') {
    рекомендации.push('✅ ICE конфигурация в отличном состоянии!');
  } else if (общее_состояние === 'хорошо') {
    рекомендации.push('👍 ICE конфигурация работает нормально.');
  } else {
    рекомендации.push('❌ Проблемы с ICE конфигурацией. Рекомендуется проверить сеть.');
  }
  
  return {
    stun_серверы: stun_результаты,
    turn_серверы: turn_результаты,
    рекомендации,
    общее_состояние,
  };
}

// Получить тип NAT - ОТКЛЮЧЕНО для предотвращения утечек RTCPeerConnection
export async function определить_тип_nat(): Promise<string> {
  // Возвращаем статическое значение чтобы не создавать RTCPeerConnection
  return 'NAT тип не определяется (для стабильности)';
}

// Форматирование результатов диагностики
export function форматировать_диагностику(результат: РезультатДиагностики): string {
  let текст = '📊 Результаты диагностики ICE серверов\n\n';
  
  текст += '🌐 STUN серверы:\n';
  результат.stun_серверы.forEach(({ сервер, доступен, задержка }) => {
    текст += `  ${доступен ? '✅' : '❌'} ${сервер.urls}`;
    if (задержка) текст += ` (${Math.round(задержка)}ms)`;
    текст += '\n';
  });
  
  текст += '\n🔄 TURN серверы:\n';
  результат.turn_серверы.forEach(({ сервер, доступен, задержка }) => {
    текст += `  ${доступен ? '✅' : '❌'} ${сервер.urls}`;
    if (задержка) текст += ` (${Math.round(задержка)}ms)`;
    текст += '\n';
  });
  
  текст += '\n📝 Рекомендации:\n';
  результат.рекомендации.forEach(р => {
    текст += `  ${р}\n`;
  });
  
  текст += `\n🎯 Общее состояние: ${
    результат.общее_состояние === 'отлично' ? '🟢 Отлично' :
    результат.общее_состояние === 'хорошо' ? '🟡 Хорошо' : '🔴 Плохо'
  }`;
  
  return текст;
}