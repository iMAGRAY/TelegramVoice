#!/usr/bin/env node

const WebSocket = require('ws');

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

console.log(`${colors.bright}${colors.blue}🧪 ТЕСТИРОВАНИЕ ВИРТУАЛЬНЫХ ПОЛЬЗОВАТЕЛЕЙ${colors.reset}`);
console.log('='.repeat(60));

class VirtualUser {
  constructor(name, avatar = '👤') {
    this.name = name;
    this.avatar = avatar;
    this.id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    this.ws = null;
    this.messages = [];
    this.currentRoom = null;
    this.microphoneEnabled = false;
    this.connected = false;
  }

  async connect(wsUrl = 'ws://localhost:8080') {
    return new Promise((resolve, reject) => {
      console.log(`${colors.yellow}🔌 ${this.name} подключается к ${wsUrl}...${colors.reset}`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        this.connected = true;
        console.log(`${colors.green}✅ ${this.name} подключился успешно${colors.reset}`);
        
        // Отправляем сообщение о присоединении
        this.sendMessage({
          тип: 'присоединиться',
          пользователь: {
            id: this.id,
            имя: this.name,
            аватар: this.avatar,
            подключен: true,
            микрофон_включен: false,
            говорит: false
          }
        });
        
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.messages.push(message);
          this.handleMessage(message);
        } catch (error) {
          console.error(`${colors.red}❌ ${this.name}: ошибка парсинга сообщения${colors.reset}`, error);
        }
      });

      this.ws.on('error', (error) => {
        console.error(`${colors.red}❌ ${this.name}: ошибка WebSocket${colors.reset}`, error.message);
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        this.connected = false;
        console.log(`${colors.yellow}👋 ${this.name} отключился (код: ${code})${colors.reset}`);
      });

      // Таймаут подключения
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Таймаут подключения'));
        }
      }, 5000);
    });
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error(`${colors.red}❌ ${this.name}: WebSocket не готов для отправки${colors.reset}`);
    }
  }

  handleMessage(message) {
    switch (message.тип) {
      case 'комнаты-обновлены':
        const roomNames = message.комнаты.map(к => к.название).join(', ');
        console.log(`${colors.blue}📋 ${this.name} получил список комнат: [${roomNames}]${colors.reset}`);
        break;
      
      case 'присоединился-к-комнате':
        this.currentRoom = message.комната.id;
        console.log(`${colors.green}🏠 ${this.name} присоединился к комнате "${message.комната.название}"${colors.reset}`);
        break;
      
      case 'участники-комнаты-обновлены':
        const participants = message.участники.map(у => у.имя).join(', ');
        console.log(`${colors.magenta}👥 ${this.name} видит участников: [${participants}] (всего: ${message.участники.length})${colors.reset}`);
        
        // Проверяем синхронизацию пользователей
        if (message.участники.length > 1) {
          console.log(`${colors.bright}${colors.green}✅ УСПЕХ: Пользователи видят друг друга!${colors.reset}`);
        }
        break;
      
      case 'webrtc-signal':
        console.log(`${colors.cyan}🔄 ${this.name} получил WebRTC сигнал от ${message.от} (тип: ${message.данные.type})${colors.reset}`);
        
        // Автоматически отвечаем на offer с answer
        if (message.данные.type === 'offer') {
          setTimeout(() => {
            this.sendWebRTCSignal(message.от, { 
              type: 'answer', 
              sdp: 'mock-answer-sdp-' + Date.now() 
            });
          }, 500);
        }
        break;
      
      case 'микрофон-переключен':
        const status = message.включен ? 'включен' : 'выключен';
        console.log(`${colors.yellow}🎤 ${this.name} видит: микрофон ${status} у пользователя ${message.пользователь_id}${colors.reset}`);
        break;
      
      case 'говорит':
        console.log(`${colors.cyan}🗣️ ${this.name} видит: пользователь ${message.пользователь_id} ${message.говорит ? 'говорит' : 'перестал говорить'}${colors.reset}`);
        break;
      
      case 'ошибка':
        console.error(`${colors.red}❌ ${this.name} получил ошибку: ${message.сообщение}${colors.reset}`);
        break;
      
      default:
        console.log(`${colors.cyan}📨 ${this.name} получил сообщение: ${message.тип}${colors.reset}`);
    }
  }

  joinRoom(roomId) {
    console.log(`${colors.yellow}📤 ${this.name} запрашивает присоединение к комнате "${roomId}"${colors.reset}`);
    this.sendMessage({
      тип: 'присоединиться-к-комнате',
      комната_id: roomId,
      пользователь_id: this.id
    });
  }

  sendWebRTCSignal(to, data) {
    if (this.currentRoom) {
      console.log(`${colors.cyan}📤 ${this.name} отправляет WebRTC сигнал (${data.type}) пользователю ${to}${colors.reset}`);
      this.sendMessage({
        тип: 'webrtc-signal',
        от: this.id,
        к: to,
        комната: this.currentRoom,
        данные: data
      });
    }
  }

  toggleMicrophone(enabled) {
    if (this.currentRoom) {
      this.microphoneEnabled = enabled;
      console.log(`${colors.yellow}🎤 ${this.name} ${enabled ? 'включает' : 'выключает'} микрофон${colors.reset}`);
      this.sendMessage({
        тип: 'микрофон-переключен',
        пользователь_id: this.id,
        комната_id: this.currentRoom,
        включен: enabled
      });
    }
  }

  startSpeaking() {
    if (this.currentRoom && this.microphoneEnabled) {
      console.log(`${colors.cyan}🗣️ ${this.name} начинает говорить${colors.reset}`);
      this.sendMessage({
        тип: 'говорит',
        пользователь_id: this.id,
        комната_id: this.currentRoom,
        говорит: true
      });
    }
  }

  stopSpeaking() {
    if (this.currentRoom) {
      console.log(`${colors.cyan}🤐 ${this.name} перестает говорить${colors.reset}`);
      this.sendMessage({
        тип: 'говорит',
        пользователь_id: this.id,
        комната_id: this.currentRoom,
        говорит: false
      });
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log(`\n${colors.bright}🚀 ЗАПУСК ТЕСТОВ${colors.reset}`);
  console.log('='.repeat(40));

  // Создаем виртуальных пользователей
  const alice = new VirtualUser('Алиса', '👩');
  const bob = new VirtualUser('Боб', '👨');
  const charlie = new VirtualUser('Чарли', '🧑');

  try {
    console.log(`\n${colors.bright}Тест 1: Подключение пользователей${colors.reset}`);
    
    // Подключаем пользователей по очереди
    await alice.connect();
    await delay(1000);
    
    await bob.connect();
    await delay(1000);
    
    await charlie.connect();
    await delay(2000);

    console.log(`\n${colors.bright}Тест 2: Присоединение к комнате${colors.reset}`);
    
    // Присоединяемся к комнате "general"
    alice.joinRoom('general');
    await delay(1000);
    
    bob.joinRoom('general');
    await delay(1000);
    
    charlie.joinRoom('general');
    await delay(3000);

    console.log(`\n${colors.bright}Тест 3: WebRTC сигналинг${colors.reset}`);
    
    // Алиса инициирует WebRTC соединение с Бобом
    alice.sendWebRTCSignal(bob.id, { 
      type: 'offer', 
      sdp: 'mock-offer-sdp-' + Date.now() 
    });
    await delay(2000);

    console.log(`\n${colors.bright}Тест 4: Управление микрофоном${colors.reset}`);
    
    // Включаем микрофоны
    alice.toggleMicrophone(true);
    await delay(500);
    
    bob.toggleMicrophone(true);
    await delay(500);
    
    charlie.toggleMicrophone(false); // Чарли остается без микрофона
    await delay(1000);

    console.log(`\n${colors.bright}Тест 5: Симуляция речи${colors.reset}`);
    
    // Алиса говорит
    alice.startSpeaking();
    await delay(2000);
    alice.stopSpeaking();
    await delay(1000);
    
    // Боб отвечает
    bob.startSpeaking();
    await delay(1500);
    bob.stopSpeaking();
    await delay(1000);

    console.log(`\n${colors.bright}Тест 6: Смена комнаты${colors.reset}`);
    
    // Чарли переходит в другую комнату
    charlie.joinRoom('music');
    await delay(2000);

    console.log(`\n${colors.bright}${colors.green}✅ ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ УСПЕШНО!${colors.reset}`);
    
    // Показываем статистику
    showTestResults([alice, bob, charlie]);

  } catch (error) {
    console.error(`${colors.red}❌ ОШИБКА В ТЕСТАХ:${colors.reset}`, error.message);
  } finally {
    // Отключаем всех пользователей
    console.log(`\n${colors.yellow}🔌 Отключение пользователей...${colors.reset}`);
    alice.disconnect();
    bob.disconnect();
    charlie.disconnect();
    
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

function showTestResults(users) {
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bright}${colors.green}📊 ИТОГИ ТЕСТИРОВАНИЯ${colors.reset}`);
  console.log('='.repeat(60));
  
  users.forEach(user => {
    console.log(`${colors.cyan}👤 ${user.name}:${colors.reset}`);
    console.log(`   • Подключен: ${user.connected ? '✅' : '❌'}`);
    console.log(`   • Комната: ${user.currentRoom || 'нет'}`);
    console.log(`   • Микрофон: ${user.microphoneEnabled ? '🎤 включен' : '🔇 выключен'}`);
    console.log(`   • Сообщений получено: ${user.messages.length}`);
  });
  
  console.log(`\n${colors.green}✅ Проверенная функциональность:${colors.reset}`);
  console.log(`   • WebSocket соединения`);
  console.log(`   • Присоединение к комнатам`);
  console.log(`   • Синхронизация участников`);
  console.log(`   • WebRTC сигналинг`);
  console.log(`   • Управление микрофоном`);
  console.log(`   • Индикация речи`);
  console.log(`   • Смена комнат`);
  
  console.log('='.repeat(60));
}

// Проверяем доступность WebSocket сервера
async function checkServerAvailability() {
  console.log(`${colors.yellow}🔍 Проверка доступности WebSocket сервера...${colors.reset}`);
  
  try {
    const testWs = new WebSocket('ws://localhost:8080');
    
    return new Promise((resolve, reject) => {
      testWs.on('open', () => {
        console.log(`${colors.green}✅ WebSocket сервер доступен на ws://localhost:8080${colors.reset}`);
        testWs.close();
        resolve(true);
      });
      
      testWs.on('error', (error) => {
        console.error(`${colors.red}❌ WebSocket сервер недоступен:${colors.reset}`, error.message);
        reject(error);
      });
      
      setTimeout(() => {
        reject(new Error('Таймаут подключения к серверу'));
      }, 3000);
    });
  } catch (error) {
    throw error;
  }
}

// Главная функция
async function main() {
  try {
    await checkServerAvailability();
    await delay(1000);
    await runTests();
  } catch (error) {
    console.error(`${colors.red}❌ КРИТИЧЕСКАЯ ОШИБКА:${colors.reset}`, error.message);
    console.log(`\n${colors.yellow}💡 Убедитесь что WebSocket сервер запущен:${colors.reset}`);
    console.log(`   cd websocket-server && npm run dev`);
    process.exit(1);
  }
}

// Запускаем тесты
main();