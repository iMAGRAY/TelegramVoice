#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🚀 Запуск полного dev окружения TelegramVoice...');
console.log('='.repeat(50));

// Запускаем WebSocket сервер
console.log('📡 Запуск WebSocket сервера...');
const wsServer = spawn('npm', ['run', 'dev'], {
  cwd: './websocket-server',
  shell: true,
  stdio: 'pipe'
});

wsServer.stdout.on('data', (data) => {
  console.log('[WebSocket]', data.toString().trim());
});

wsServer.stderr.on('data', (data) => {
  console.error('[WebSocket Error]', data.toString().trim());
});

// Ждем запуска WebSocket сервера, затем запускаем фронтенд
setTimeout(() => {
  console.log('\n🌐 Запуск Next.js фронтенда...');
  
  const frontendServer = spawn('npm', ['run', 'dev'], {
    cwd: './mini-app',
    shell: true,
    stdio: 'pipe'
  });

  frontendServer.stdout.on('data', (data) => {
    console.log('[Frontend]', data.toString().trim());
  });

  frontendServer.stderr.on('data', (data) => {
    console.error('[Frontend Error]', data.toString().trim());
  });

  frontendServer.on('close', (code) => {
    console.log(`Frontend остановлен с кодом: ${code}`);
    wsServer.kill();
  });

  // Обработка завершения
  process.on('SIGINT', () => {
    console.log('\n🛑 Остановка серверов...');
    frontendServer.kill();
    wsServer.kill();
    process.exit(0);
  });

}, 3000);

wsServer.on('close', (code) => {
  console.log(`WebSocket сервер остановлен с кодом: ${code}`);
});

console.log('\n💡 Инструкции:');
console.log('   • WebSocket сервер: ws://localhost:8080');
console.log('   • Frontend: http://localhost:3000');
console.log('   • Для остановки: Ctrl+C');
console.log('='.repeat(50));