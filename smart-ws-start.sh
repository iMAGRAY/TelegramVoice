#!/bin/bash
# Умный запуск WebSocket - проверяет, не работает ли уже сервер

echo "🧠 УМНЫЙ ЗАПУСК WEBSOCKET"
echo "========================"
echo

# Функция проверки работающего сервера
check_server_running() {
    # Проверяем порт
    if lsof -i:8080 >/dev/null 2>&1; then
        echo "✅ WebSocket сервер УЖЕ работает на порту 8080!"
        echo "Процесс:"
        lsof -i:8080
        
        # Проверяем, отвечает ли сервер
        if timeout 2 bash -c "cat < /dev/tcp/localhost/8080" &>/dev/null; then
            echo "✅ Сервер отвечает на запросы"
            return 0
        else
            echo "⚠️ Порт занят, но сервер не отвечает"
            return 1
        fi
    fi
    return 1
}

# ГЛАВНАЯ ЛОГИКА
echo "1️⃣ Проверка текущего состояния..."

# Если сервер уже работает корректно - выходим с успехом
if check_server_running; then
    echo
    echo "🎯 WebSocket сервер уже работает корректно!"
    echo "Нет необходимости в перезапуске."
    
    # Обновляем PID файл если нужно
    WS_PID=$(lsof -ti:8080 | head -1)
    if [ ! -z "$WS_PID" ]; then
        echo $WS_PID > /tmp/ws.pid
        echo "PID файл обновлен: $WS_PID"
    fi
    
    exit 0
fi

echo
echo "2️⃣ Сервер не работает или не отвечает. Запускаем..."

# Очистка порта
echo "Очистка порта 8080..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
fuser -k 8080/tcp 2>/dev/null || true
sleep 2

# Проверка Rust сервера
if [ -f "/root/TelegramVoice/signaling-server/target/release/signaling-server" ]; then
    echo "3️⃣ Запуск Rust сервера..."
    cd /root/TelegramVoice/signaling-server
    
    # Создаем директорию для логов
    mkdir -p /root/TelegramVoice/logs
    
    # Запуск
    export RUST_LOG=info
    nohup ./target/release/signaling-server > /root/TelegramVoice/logs/smart-rust.log 2>&1 &
    WS_PID=$!
    echo $WS_PID > /tmp/ws.pid
    
    echo "Ждем запуска (3 секунды)..."
    sleep 3
    
    if check_server_running; then
        echo "✅ Rust сервер успешно запущен!"
        exit 0
    else
        echo "❌ Rust сервер не запустился"
        kill -9 $WS_PID 2>/dev/null || true
    fi
fi

# Резервный Node.js сервер
echo "4️⃣ Запуск резервного Node.js сервера..."
cd /root/TelegramVoice

# Установка зависимостей
[ ! -d "node_modules/ws" ] && npm install ws

# Запуск
export PORT=8080
nohup node backup-ws-server.js > /root/TelegramVoice/logs/smart-nodejs.log 2>&1 &
WS_PID=$!
echo $WS_PID > /tmp/backup-ws.pid

sleep 3

if check_server_running; then
    echo "✅ Node.js сервер успешно запущен!"
    exit 0
else
    echo "❌ ОШИБКА: Не удалось запустить WebSocket сервер!"
    exit 1
fi