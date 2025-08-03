#!/bin/bash
# Форсированный запуск WebSocket с предварительной очисткой

echo "🔥 ФОРСИРОВАННЫЙ ЗАПУСК WEBSOCKET"
echo "================================="
echo

# Функция жесткой очистки порта
force_kill_port() {
    local port=$1
    echo "🔪 Убиваем ВСЕ на порту $port..."
    
    # Метод 1: lsof
    if command -v lsof &> /dev/null; then
        lsof -ti:$port | while read pid; do
            echo "  Убиваем PID $pid (lsof)"
            kill -9 $pid 2>/dev/null || true
        done
    fi
    
    # Метод 2: ss + awk
    if command -v ss &> /dev/null; then
        ss -lptn "sport = :$port" 2>/dev/null | grep -oP 'pid=\K\d+' | while read pid; do
            echo "  Убиваем PID $pid (ss)"
            kill -9 $pid 2>/dev/null || true
        done
    fi
    
    # Метод 3: fuser
    if command -v fuser &> /dev/null; then
        fuser -k $port/tcp 2>/dev/null || true
    fi
    
    # Метод 4: поиск по имени процесса
    pkill -9 -f ":$port" 2>/dev/null || true
    pkill -9 -f "port=$port" 2>/dev/null || true
    pkill -9 -f "PORT=$port" 2>/dev/null || true
    
    sleep 2
}

# 1. Останавливаем PM2
echo "1️⃣ Останавливаем PM2..."
pm2 kill 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# 2. Останавливаем systemd сервисы
echo "2️⃣ Останавливаем systemd сервисы..."
systemctl stop telegramvoice-ws 2>/dev/null || true
systemctl stop telegramvoice-backup-ws 2>/dev/null || true
systemctl disable telegramvoice-ws 2>/dev/null || true
systemctl disable telegramvoice-backup-ws 2>/dev/null || true

# 3. Убиваем все WebSocket процессы
echo "3️⃣ Убиваем все WebSocket процессы..."
pkill -9 -f signaling-server 2>/dev/null || true
pkill -9 -f backup-ws-server 2>/dev/null || true
pkill -9 -f "ws-server" 2>/dev/null || true
pkill -9 -f "websocket" 2>/dev/null || true

# 4. Форсированная очистка порта 8080
echo "4️⃣ Форсированная очистка порта 8080..."
force_kill_port 8080

# 5. Проверка что порт свободен
echo "5️⃣ Проверка порта 8080..."
if lsof -i:8080 >/dev/null 2>&1; then
    echo "❌ ОШИБКА: Порт 8080 ВСЕ ЕЩЕ ЗАНЯТ!"
    echo "Процессы на порту:"
    lsof -i:8080
    echo
    echo "Последняя попытка..."
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    sleep 3
fi

# 6. Запуск WebSocket сервера
echo "6️⃣ Запуск WebSocket сервера..."
cd /root/TelegramVoice

# Проверяем наличие Rust сервера
if [ -f "signaling-server/target/release/signaling-server" ]; then
    echo "Запускаем Rust signaling-server..."
    cd signaling-server
    
    # Запуск через nohup с явным указанием переменных окружения
    export RUST_LOG=info
    export RUST_BACKTRACE=1
    nohup ./target/release/signaling-server > /root/TelegramVoice/logs/force-rust.log 2>&1 &
    RUST_PID=$!
    echo $RUST_PID > /tmp/force-ws.pid
    
    echo "Ждем запуска (5 секунд)..."
    sleep 5
    
    # Проверка
    if kill -0 $RUST_PID 2>/dev/null && lsof -i:8080 >/dev/null 2>&1; then
        echo "✅ Rust сервер запущен! PID: $RUST_PID"
        echo "Логи: tail -f /root/TelegramVoice/logs/force-rust.log"
        exit 0
    else
        echo "❌ Rust сервер не запустился"
        echo "Последние строки лога:"
        tail -20 /root/TelegramVoice/logs/force-rust.log
    fi
fi

# 7. Запасной вариант - Node.js
echo "7️⃣ Запускаем резервный Node.js сервер..."
cd /root/TelegramVoice

# Установка зависимостей
[ ! -d "node_modules/ws" ] && npm install ws

# Запуск
export PORT=8080
nohup node backup-ws-server.js > /root/TelegramVoice/logs/force-nodejs.log 2>&1 &
NODE_PID=$!
echo $NODE_PID > /tmp/force-backup-ws.pid

echo "Ждем запуска (3 секунды)..."
sleep 3

# Финальная проверка
if kill -0 $NODE_PID 2>/dev/null && lsof -i:8080 >/dev/null 2>&1; then
    echo "✅ Node.js сервер запущен! PID: $NODE_PID"
    echo "Логи: tail -f /root/TelegramVoice/logs/force-nodejs.log"
else
    echo "❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось запустить ни один сервер!"
    echo "Последние строки Node.js лога:"
    tail -20 /root/TelegramVoice/logs/force-nodejs.log
    exit 1
fi