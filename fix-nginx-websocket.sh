#!/bin/bash
# Исправление nginx для WebSocket

echo "🔧 ИСПРАВЛЕНИЕ NGINX ДЛЯ WEBSOCKET"
echo "=================================="
echo

# Проверяем, что другие пользователи могут подключиться напрямую к порту 8080
echo "1️⃣ Проверка прямого доступа к WebSocket серверу..."
echo "Попробуйте открыть в браузере: http://89.23.115.156:8080"
echo

# Открываем порт 8080 в firewall (если используется ufw)
if command -v ufw &> /dev/null; then
    echo "2️⃣ Открытие порта 8080 в firewall..."
    ufw allow 8080/tcp
    ufw reload
fi

# Проверяем iptables
echo "3️⃣ Проверка iptables..."
iptables -I INPUT -p tcp --dport 8080 -j ACCEPT
iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
iptables -I INPUT -p tcp --dport 80 -j ACCEPT
iptables -I INPUT -p tcp --dport 443 -j ACCEPT

# Сохраняем правила
if command -v netfilter-persistent &> /dev/null; then
    netfilter-persistent save
fi

echo
echo "✅ Порты открыты в firewall"
echo

# Тестируем прямое подключение
echo "4️⃣ Тест WebSocket сервера..."
echo "Проверка доступности:"
echo "- Прямой WebSocket: ws://89.23.115.156:8080"
echo "- Через nginx HTTP: ws://89.23.115.156/ws"
echo "- Через nginx HTTPS: wss://hesovoice.online/ws"
echo

# Проверяем, что сервер отвечает
timeout 2 bash -c "cat < /dev/tcp/localhost/8080" &>/dev/null && echo "✅ WebSocket сервер отвечает" || echo "❌ WebSocket сервер не отвечает"

echo
echo "📝 Рекомендации:"
echo "1. Попробуйте подключиться напрямую к ws://89.23.115.156:8080"
echo "2. Если работает - проблема в nginx прокси"
echo "3. Если не работает - проблема в самом WebSocket сервере или firewall"