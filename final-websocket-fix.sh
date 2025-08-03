#!/bin/bash
# Финальное исправление WebSocket для работы с другими пользователями

echo "🚀 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ WEBSOCKET"
echo "=================================="
echo

# 1. Открываем порты в firewall
echo "1️⃣ Открытие портов в firewall..."
iptables -I INPUT -p tcp --dport 8080 -j ACCEPT
iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
iptables -I INPUT -p tcp --dport 80 -j ACCEPT
iptables -I INPUT -p tcp --dport 443 -j ACCEPT

# Сохраняем правила
if command -v iptables-save &> /dev/null; then
    iptables-save > /etc/iptables/rules.v4
fi

# 2. Проверяем и исправляем переменные окружения
echo "2️⃣ Проверка переменных окружения..."
cd /root/TelegramVoice/mini-app

# Создаем правильный .env.production если его нет
if [ ! -f .env.production ]; then
    cat > .env.production << 'EOF'
# Production WebSocket URLs
NEXT_PUBLIC_WEBSOCKET_URL=ws://89.23.115.156:8080
# Альтернативные варианты:
# NEXT_PUBLIC_WEBSOCKET_URL=ws://89.23.115.156/ws
# NEXT_PUBLIC_WEBSOCKET_URL=wss://hesovoice.online/ws
EOF
fi

# 3. Перезапускаем WebSocket с правильными настройками
echo "3️⃣ Перезапуск WebSocket сервера..."
cd /root/TelegramVoice

# Убиваем старый процесс
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 2

# Запускаем с явным указанием bind адреса
cd signaling-server
export RUST_LOG=info
export RUST_BACKTRACE=1
nohup ./target/release/signaling-server > /root/TelegramVoice/logs/ws-final.log 2>&1 &
WS_PID=$!
echo $WS_PID > /tmp/ws.pid

sleep 3

# 4. Перестраиваем фронтенд с новыми переменными
echo "4️⃣ Пересборка фронтенда..."
cd /root/TelegramVoice/mini-app
npm run build

# Перезапускаем фронтенд
pm2 delete frontend 2>/dev/null || true
pm2 start ecosystem.config.js --only frontend

# 5. Проверка доступности
echo
echo "5️⃣ Проверка доступности:"
echo "============================="

# Проверяем локально
echo -n "Локальный доступ (localhost:8080): "
timeout 2 bash -c "cat < /dev/tcp/localhost/8080" &>/dev/null && echo "✅ OK" || echo "❌ FAIL"

# Проверяем внешний доступ
echo -n "Внешний доступ (89.23.115.156:8080): "
timeout 2 bash -c "cat < /dev/tcp/89.23.115.156/8080" &>/dev/null && echo "✅ OK" || echo "❌ FAIL"

echo
echo "📊 Статус сервисов:"
pm2 list
echo
echo "Процессы на портах:"
lsof -i:8080
lsof -i:3000

echo
echo "🌐 URL для тестирования:"
echo "- Прямой WebSocket: ws://89.23.115.156:8080"
echo "- Фронтенд: http://89.23.115.156:3000"
echo "- HTTPS фронтенд: https://hesovoice.online"
echo
echo "📝 Для тестирования откройте test-websocket.html в браузере"
echo "   и попробуйте подключиться к ws://89.23.115.156:8080"