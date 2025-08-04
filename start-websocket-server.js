#!/usr/bin/env node

const { spawn } = require('child_process');
const WebSocket = require('ws');

console.log('🚀 Запуск WebSocket сервера для тестирования...');

// Запускаем WebSocket сервер
const serverProcess = spawn('npm', ['run', 'dev'], {
  cwd: './websocket-server',
  shell: true,
  stdio: 'pipe'
});

let serverReady = false;

serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('[WebSocket Server]', output.trim());
  
  // Проверяем что сервер запустился
  if (output.includes('WebSocket сервер запущен на порту 8080')) {
    serverReady = true;
    console.log('✅ WebSocket сервер готов к тестированию!');
    
    // Ждем немного и запускаем тесты
    setTimeout(() => {
      console.log('\n🧪 Запуск тестов виртуальных пользователей...\n');
      
      const testProcess = spawn('node', ['test-virtual-users.js'], {
        stdio: 'inherit'
      });
      
      testProcess.on('close', (code) => {
        console.log(`\n🏁 Тесты завершены с кодом: ${code}`);
        
        // Останавливаем WebSocket сервер
        console.log('🛑 Остановка WebSocket сервера...');
        serverProcess.kill('SIGINT');
        
        setTimeout(() => {
          process.exit(code);
        }, 1000);
      });
      
    }, 2000);
  }
});

serverProcess.stderr.on('data', (data) => {
  console.error('[WebSocket Server Error]', data.toString().trim());
});

serverProcess.on('close', (code) => {
  console.log(`WebSocket сервер остановлен с кодом: ${code}`);
});

// Обработка завершения
process.on('SIGINT', () => {
  console.log('\n🛑 Получен сигнал остановки...');
  serverProcess.kill('SIGINT');
  process.exit(0);
});

// Таймаут на случай если сервер не запустится
setTimeout(() => {
  if (!serverReady) {
    console.error('❌ Таймаут запуска WebSocket сервера');
    serverProcess.kill('SIGINT');
    process.exit(1);
  }
}, 10000);