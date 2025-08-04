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

// Проверка задержки до STUN сервера
async function измерить_задержку(url: string): Promise<number> {
  let pc: RTCPeerConnection | null = null;
  
  try {
    const start = performance.now();
    
    // Создаем временное соединение для измерения
    pc = new RTCPeerConnection({
      iceServers: [{ urls: url }],
    });
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout'));
      }, 2000); // Уменьшил timeout до 2 сек
      
      if (!pc) {
        clearTimeout(timeout);
        reject(new Error('PeerConnection не создан'));
        return;
      }
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          clearTimeout(timeout);
          resolve(null);
        }
      };
      
      pc.onicecandidateerror = () => {
        clearTimeout(timeout);
        reject(new Error('ICE candidate error'));
      };
      
      pc.createDataChannel('ping');
      pc.createOffer()
        .then(offer => pc?.setLocalDescription(offer))
        .catch(reject);
    });
    
    return performance.now() - start;
  } catch (error) {
    // Убираем логирование ошибок ICE для production
    return -1;
  } finally {
    // КРИТИЧНО: Всегда закрываем соединение
    if (pc) {
      try {
        pc.close();
      } catch (e) {
        console.warn('Ошибка при закрытии PeerConnection:', e);
      }
    }
  }
}

// Диагностика всех ICE серверов (с ограничением на количество)
export async function диагностировать_ice_серверы(): Promise<РезультатДиагностики> {
  const stun_результаты: ICEДиагностика[] = [];
  const turn_результаты: ICEДиагностика[] = [];
  const рекомендации: string[] = [];
  
  // КРИТИЧНО: Ограничиваем до 2 STUN серверов для предотвращения перегрузки
  for (const сервер of публичные_stun_серверы.slice(0, 2)) {
    try {
      const start = performance.now();
      const доступен = await проверить_ice_сервер(сервер);
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
  
  // КРИТИЧНО: Ограничиваем до 1 TURN сервера для предотвращения перегрузки  
  for (const сервер of публичные_turn_серверы.slice(0, 1)) {
    try {
      const start = performance.now();
      const доступен = await проверить_ice_сервер(сервер);
      const задержка = доступен ? performance.now() - start : undefined;
      
      turn_результаты.push({
        сервер,
        доступен,
        задержка,
      });
    } catch (error) {
      turn_результаты.push({
        сервер,
        доступен: false,
        ошибка: error instanceof Error ? error.message : 'Неизвестная ошибка',
      });
    }
  }
  
  // Анализ результатов
  const рабочие_stun = stun_результаты.filter(r => r.доступен).length;
  const рабочие_turn = turn_результаты.filter(r => r.доступен).length;
  
  // Формируем рекомендации
  if (рабочие_stun === 0) {
    рекомендации.push('⚠️ Ни один STUN сервер не доступен. Проверьте интернет-соединение.');
  } else if (рабочие_stun < 2) {
    рекомендации.push('⚠️ Доступно мало STUN серверов. Возможны проблемы с подключением.');
  }
  
  if (рабочие_turn === 0) {
    рекомендации.push('⚠️ TURN серверы недоступны. Могут быть проблемы при подключении через сложные NAT.');
  }
  
  // Проверяем задержки
  const средняя_задержка = stun_результаты
    .filter(r => r.доступен && r.задержка)
    .reduce((sum, r) => sum + r.задержка!, 0) / рабочие_stun;
    
  if (средняя_задержка > 1000) {
    рекомендации.push('⚠️ Высокая задержка до ICE серверов. Возможны задержки при установке соединения.');
  }
  
  // Определяем общее состояние
  let общее_состояние: 'отлично' | 'хорошо' | 'плохо';
  
  if (рабочие_stun >= 3 && рабочие_turn >= 1 && средняя_задержка < 500) {
    общее_состояние = 'отлично';
    рекомендации.push('✅ ICE конфигурация в отличном состоянии!');
  } else if (рабочие_stun >= 2 && средняя_задержка < 1000) {
    общее_состояние = 'хорошо';
    рекомендации.push('👍 ICE конфигурация работает нормально.');
  } else {
    общее_состояние = 'плохо';
    рекомендации.push('❌ Проблемы с ICE конфигурацией. Рекомендуется проверить сеть.');
  }
  
  return {
    stun_серверы: stun_результаты,
    turn_серверы: turn_результаты,
    рекомендации,
    общее_состояние,
  };
}

// Получить тип NAT
export async function определить_тип_nat(): Promise<string> {
  try {
    const pc1 = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    
    const pc2 = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun1.l.google.com:19302' }],
    });
    
    const candidates: RTCIceCandidate[] = [];
    
    pc1.onicecandidate = (e) => {
      if (e.candidate && e.candidate.type === 'srflx') {
        candidates.push(e.candidate);
      }
    };
    
    pc2.onicecandidate = (e) => {
      if (e.candidate && e.candidate.type === 'srflx') {
        candidates.push(e.candidate);
      }
    };
    
    // Создаем каналы данных для запуска ICE
    pc1.createDataChannel('test1');
    pc2.createDataChannel('test2');
    
    await Promise.all([
      pc1.createOffer().then(o => pc1.setLocalDescription(o)),
      pc2.createOffer().then(o => pc2.setLocalDescription(o)),
    ]);
    
    // Ждем кандидатов
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    pc1.close();
    pc2.close();
    
    // Анализируем кандидаты
    if (candidates.length === 0) {
      return 'Симметричный NAT (сложный для WebRTC)';
    }
    
    const addresses = candidates.map(c => c.address);
    const uniqueAddresses = new Set(addresses);
    
    if (uniqueAddresses.size === 1) {
      return 'Full Cone NAT (лучший для WebRTC)';
    } else if (uniqueAddresses.size === 2) {
      return 'Port Restricted NAT (хороший для WebRTC)';
    } else {
      return 'Симметричный NAT (может требовать TURN)';
    }
  } catch (error) {
    return 'Не удалось определить тип NAT';
  }
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