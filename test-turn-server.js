// Скрипт для проверки работы TURN сервера
// Запускать в браузере после установки Coturn

async function testTurnServer(turnServer, username, password) {
  console.log('🧪 Тестирование TURN сервера:', turnServer);
  
  const config = {
    iceServers: [
      {
        urls: turnServer,
        username: username,
        credential: password
      }
    ],
    iceCandidatePoolSize: 0
  };
  
  try {
    const pc = new RTCPeerConnection(config);
    const candidates = [];
    
    // Собираем ICE кандидаты
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        candidates.push(event.candidate);
        console.log('📍 ICE кандидат:', event.candidate.type, event.candidate.address);
        
        // relay кандидат указывает на успешное подключение к TURN
        if (event.candidate.type === 'relay') {
          console.log('✅ TURN сервер работает! Получен relay кандидат.');
        }
      }
    };
    
    // Обработка изменения состояния ICE
    pc.oniceconnectionstatechange = () => {
      console.log('🔄 ICE состояние:', pc.iceConnectionState);
    };
    
    // Создаем канал данных для запуска ICE gathering
    pc.createDataChannel('test');
    
    // Создаем offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    // Ждем сбор кандидатов
    await new Promise(resolve => {
      pc.onicegatheringstatechange = () => {
        console.log('📊 ICE gathering состояние:', pc.iceGatheringState);
        if (pc.iceGatheringState === 'complete') {
          resolve();
        }
      };
      
      // Таймаут на случай проблем
      setTimeout(resolve, 10000);
    });
    
    // Анализ результатов
    const relayCandidate = candidates.find(c => c.type === 'relay');
    const srflxCandidate = candidates.find(c => c.type === 'srflx');
    
    console.log('\n📋 Результаты теста:');
    console.log('Всего кандидатов:', candidates.length);
    console.log('STUN работает:', srflxCandidate ? '✅ Да' : '❌ Нет');
    console.log('TURN работает:', relayCandidate ? '✅ Да' : '❌ Нет');
    
    if (relayCandidate) {
      console.log('\n🎉 Отлично! TURN сервер полностью функционален.');
      console.log('Relay адрес:', relayCandidate.address + ':' + relayCandidate.port);
    } else if (srflxCandidate) {
      console.log('\n⚠️ STUN работает, но TURN не доступен.');
      console.log('Проверьте учетные данные и настройки файрволла.');
    } else {
      console.log('\n❌ Ни STUN, ни TURN не работают.');
      console.log('Проверьте подключение к серверу и настройки.');
    }
    
    pc.close();
    
  } catch (error) {
    console.error('❌ Ошибка теста:', error);
  }
}

// Пример использования после установки Coturn:
// testTurnServer('turn:hesovoice.online:3478', 'telegramvoice', 'ВАШ_ПАРОЛЬ');

// Функция для полной диагностики
async function fullDiagnostics() {
  console.log('🔍 Полная диагностика WebRTC и ICE серверов\n');
  
  // Проверка поддержки WebRTC
  if (!window.RTCPeerConnection) {
    console.error('❌ WebRTC не поддерживается в этом браузере!');
    return;
  }
  
  console.log('✅ WebRTC поддерживается');
  
  // Проверка публичных STUN серверов
  console.log('\n📡 Проверка публичных STUN серверов:');
  const publicStunServers = [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302'
  ];
  
  for (const server of publicStunServers) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: server }]
    });
    
    let success = false;
    pc.onicecandidate = (e) => {
      if (e.candidate && e.candidate.type === 'srflx') {
        success = true;
        console.log(`✅ ${server} - работает`);
      }
    };
    
    pc.createDataChannel('test');
    await pc.createOffer().then(o => pc.setLocalDescription(o));
    
    await new Promise(r => setTimeout(r, 3000));
    if (!success) {
      console.log(`❌ ${server} - не доступен`);
    }
    
    pc.close();
  }
  
  // Определение типа NAT
  console.log('\n🌐 Определение типа NAT:');
  try {
    const candidates = [];
    const pc1 = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    pc1.onicecandidate = (e) => {
      if (e.candidate && e.candidate.type === 'srflx') {
        candidates.push(e.candidate.address);
      }
    };
    
    pc1.createDataChannel('test');
    await pc1.createOffer().then(o => pc1.setLocalDescription(o));
    await new Promise(r => setTimeout(r, 3000));
    pc1.close();
    
    if (candidates.length === 0) {
      console.log('❌ Не удалось определить - возможно симметричный NAT');
    } else {
      console.log('✅ Публичный IP через STUN:', candidates[0]);
      console.log('Тип NAT: вероятно Full Cone или Port Restricted');
    }
  } catch (error) {
    console.error('Ошибка определения NAT:', error);
  }
  
  console.log('\n✨ Диагностика завершена!');
}

// Автоматический запуск диагностики
console.log('Для запуска диагностики выполните: fullDiagnostics()');
console.log('Для проверки TURN сервера: testTurnServer("turn:HOST:PORT", "USERNAME", "PASSWORD")');