#!/bin/bash
# Простейший запуск WebSocket сервера

echo "🚀 ПРОСТОЙ ЗАПУСК WEBSOCKET"
echo "=========================="

# 1. Убиваем все что на порту 8080
echo "Освобождаем порт 8080..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 1

# 2. Пробуем Rust сервер
if [ -f "/root/TelegramVoice/signaling-server/target/release/signaling-server" ]; then
    echo "Запускаем Rust signaling-server..."
    cd /root/TelegramVoice/signaling-server
    nohup ./target/release/signaling-server > /tmp/ws.log 2>&1 &
    echo $! > /tmp/ws.pid
    sleep 3
    
    if lsof -i:8080 >/dev/null 2>&1; then
        echo "✅ Rust сервер запущен!"
        exit 0
    else
        echo "❌ Rust сервер не запустился"
        cat /tmp/ws.log
    fi
fi

# 3. Запускаем Node.js резервный сервер
echo "Запускаем резервный Node.js сервер..."
cd /root/TelegramVoice

# Устанавливаем ws если нет
if [ ! -d "node_modules/ws" ]; then
    npm install ws
fi

# Запускаем
nohup node backup-ws-server.js > /tmp/backup-ws.log 2>&1 &
echo $! > /tmp/backup-ws.pid
sleep 3

if lsof -i:8080 >/dev/null 2>&1; then
    echo "✅ Резервный сервер запущен!"
else
    echo "❌ Резервный сервер тоже не запустился"
    cat /tmp/backup-ws.log
    exit 1
fi