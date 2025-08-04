#!/bin/bash
# Скрипт быстрого восстановления сервисов TelegramVoice

echo "🔧 Быстрое восстановление сервисов TelegramVoice..."

# Остановка конфликтующих процессов
echo "🛑 Остановка конфликтующих процессов..."
pkill -f signaling-server || true
pkill -f "target/release/signaling-server" || true

# Переименование Rust бинарника
if [ -f "signaling-server/target/release/signaling-server" ]; then
  mv signaling-server/target/release/signaling-server signaling-server/target/release/signaling-server.bak
  echo "✅ Rust сервер отключен"
fi

# Освобождение портов
echo "🔪 Освобождение портов..."
fuser -k 8080/tcp || true
fuser -k 3000/tcp || true

# Полная очистка PM2
echo "🧹 Очистка PM2..."
pm2 kill || true
sleep 2

# Установка http-server если не установлен
if ! command -v http-server &> /dev/null; then
  echo "📦 Устанавливаем http-server..."
  npm install -g http-server
fi

# Запуск сервисов
echo "🚀 Запуск сервисов..."
cd /root/TelegramVoice
pm2 start websocket-server/dist/index.js --name websocket-server --cwd websocket-server
pm2 start http-server --name frontend -- out -p 3000 --cwd mini-app

# Сохранение конфигурации
pm2 save

echo "✅ Сервисы восстановлены!"
pm2 status