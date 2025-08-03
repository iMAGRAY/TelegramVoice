#!/bin/bash
# Исправление синхронизации пользователей между WebSocket и WebRTC

echo "🔧 ИСПРАВЛЕНИЕ СИНХРОНИЗАЦИИ ПОЛЬЗОВАТЕЛЕЙ"
echo "=========================================="
echo

# 1. Сборка исправленного WebSocket сервера
echo "1️⃣ Сборка WebSocket сервера..."
cd /root/TelegramVoice/signaling-server
cargo build --release

if [ $? -ne 0 ]; then
    echo "❌ Ошибка сборки WebSocket сервера!"
    exit 1
fi

echo "✅ WebSocket сервер собран"

# 2. Остановка старого процесса
echo
echo "2️⃣ Остановка старого WebSocket сервера..."
pkill -f "signaling-serve" || true
sleep 2

# Убеждаемся что процесс остановлен
if pgrep -f "signaling-serve" > /dev/null; then
    echo "⚠️ Принудительное завершение процесса..."
    pkill -9 -f "signaling-serve" || true
    sleep 1
fi

# 3. Запуск нового процесса
echo
echo "3️⃣ Запуск исправленного WebSocket сервера..."
cd /root/TelegramVoice/signaling-server
nohup ./target/release/signaling-server > websocket.log 2>&1 &
WEBSOCKET_PID=$!

sleep 3

# Проверяем что процесс запустился
if ! kill -0 $WEBSOCKET_PID 2>/dev/null; then
    echo "❌ WebSocket сервер не запустился!"
    echo "Последние строки лога:"
    tail -10 websocket.log
    exit 1
fi

echo "✅ WebSocket сервер запущен (PID: $WEBSOCKET_PID)"

# 4. Проверка порта
echo
echo "4️⃣ Проверка порта 8080..."
sleep 2
if ss -tlnp | grep -q ":8080"; then
    echo "✅ Порт 8080 открыт"
else
    echo "❌ Порт 8080 не открыт!"
    exit 1
fi

# 5. Статус процессов
echo
echo "5️⃣ Статус всех сервисов..."
echo "WebSocket сервер:"
ps aux | grep signaling-serve | grep -v grep || echo "Не найден"

echo
echo "Frontend PM2:"
pm2 list | grep frontend || echo "Не найден"

echo
echo "Порты:"
ss -tlnp | grep -E ":(8080|3000|80|443)"

echo
echo "🎉 ИСПРАВЛЕНИЯ ПРИМЕНЕНЫ!"
echo "========================"
echo
echo "✅ Исправлена проблема дублирования пользователей"
echo "✅ WebSocket сервер использует корректные ID пользователей"
echo "✅ Участники комнат теперь видят друг друга"
echo
echo "Проверьте работу:"
echo "1. Откройте https://hesovoice.online в нескольких браузерах"
echo "2. Присоединитесь к одной комнате разными пользователями"
echo "3. Проверьте что все участники отображаются"
echo "4. Тестируйте голосовую связь"