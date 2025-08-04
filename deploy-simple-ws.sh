#!/bin/bash
# Развертывание простого WebSocket сервера

echo "🚀 РАЗВЕРТЫВАНИЕ ПРОСТОГО WEBSOCKET СЕРВЕРА"
echo "==========================================="
echo

# 1. Останавливаем старый сервер
echo "1️⃣ Остановка старого WebSocket сервера..."
pkill -f signaling-serve || true
sleep 2

# Проверяем что старый процесс остановлен
if pgrep -f signaling-serve > /dev/null; then
    echo "⚠️ Принудительное завершение процесса..."
    pkill -9 -f signaling-serve || true
    sleep 1
fi

echo "✅ Старый сервер остановлен"

# 2. Копируем новый сервер
echo
echo "2️⃣ Копирование нового сервера..."
cd /root/TelegramVoice

# Если файл уже загружен через git pull, используем его
if [ -f "simple-ws-server.js" ]; then
    echo "✅ Файл simple-ws-server.js найден"
else
    echo "❌ Файл simple-ws-server.js не найден!"
    echo "Создайте его вручную или скопируйте из репозитория"
    exit 1
fi

# 3. Проверяем наличие ws модуля
echo
echo "3️⃣ Проверка зависимостей..."
if [ ! -d "node_modules/ws" ]; then
    echo "📦 Установка модуля ws..."
    npm install ws
fi

# 4. Запускаем новый сервер
echo
echo "4️⃣ Запуск нового WebSocket сервера..."
nohup node simple-ws-server.js > websocket-simple.log 2>&1 &
WS_PID=$!

sleep 3

# Проверяем что процесс запустился
if ! kill -0 $WS_PID 2>/dev/null; then
    echo "❌ WebSocket сервер не запустился!"
    echo "Последние строки лога:"
    tail -10 websocket-simple.log
    exit 1
fi

echo "✅ WebSocket сервер запущен (PID: $WS_PID)"

# 5. Проверка порта
echo
echo "5️⃣ Проверка порта 8080..."
sleep 2
if ss -tlnp | grep -q ":8080"; then
    echo "✅ Порт 8080 открыт"
else
    echo "❌ Порт 8080 не открыт!"
    exit 1
fi

# 6. Показываем логи
echo
echo "6️⃣ Последние строки логов:"
tail -5 websocket-simple.log

echo
echo "🎉 РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО!"
echo "=========================="
echo
echo "✅ Простой WebSocket сервер работает на порту 8080"
echo "✅ Логи: tail -f /root/TelegramVoice/websocket-simple.log"
echo
echo "Проверьте работу:"
echo "1. Откройте realtime-ws-test.html в браузере"
echo "2. Запустите автоматический тест"
echo "3. Убедитесь что пользователи видят друг друга"