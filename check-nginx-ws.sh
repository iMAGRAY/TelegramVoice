#!/bin/bash
# Проверка и настройка nginx для WebSocket

echo "🔍 ПРОВЕРКА NGINX ДЛЯ WEBSOCKET"
echo "==============================="
echo

# 1. Проверка nginx
echo "1️⃣ Проверка установки nginx:"
if command -v nginx &> /dev/null; then
    echo "✅ nginx установлен"
    nginx -v
else
    echo "❌ nginx НЕ установлен!"
    echo "Установите: apt install nginx"
    exit 1
fi

# 2. Проверка конфигурации
echo
echo "2️⃣ Проверка конфигурации nginx:"
NGINX_CONF="/etc/nginx/sites-available/telegramvoice"

if [ -f "$NGINX_CONF" ]; then
    echo "✅ Конфигурация найдена"
    echo
    echo "WebSocket настройки:"
    grep -A 10 "location /ws" "$NGINX_CONF" || echo "❌ WebSocket location не найден!"
else
    echo "❌ Конфигурация НЕ найдена!"
    echo "Создаем..."
    
    cat > "$NGINX_CONF" << 'EOF'
server {
    listen 80;
    server_name hesovoice.online;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_connect_timeout 60s;
        
        # Disable buffering
        proxy_buffering off;
        proxy_cache off;
    }
}

server {
    listen 443 ssl;
    server_name hesovoice.online;

    # SSL certificates (добавьте свои сертификаты)
    # ssl_certificate /etc/letsencrypt/live/hesovoice.online/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/hesovoice.online/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_connect_timeout 60s;
        proxy_buffering off;
        proxy_cache off;
    }
}
EOF
    
    # Активируем конфигурацию
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
fi

# 3. Проверка синтаксиса
echo
echo "3️⃣ Проверка синтаксиса nginx:"
nginx -t

# 4. Перезапуск nginx
echo
echo "4️⃣ Перезапуск nginx:"
systemctl restart nginx
systemctl status nginx --no-pager | head -10

# 5. Проверка портов
echo
echo "5️⃣ Проверка прослушивания портов:"
echo "nginx на 80:"
lsof -i:80 | grep nginx || echo "❌ nginx не слушает порт 80"
echo
echo "nginx на 443:"
lsof -i:443 | grep nginx || echo "❌ nginx не слушает порт 443"

# 6. Тест WebSocket через nginx
echo
echo "6️⃣ Тест WebSocket через nginx:"

# Локальный тест
echo "Локальный тест /ws:"
RESPONSE=$(curl -s -I -N \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" \
    http://localhost/ws 2>&1 | head -5)

if echo "$RESPONSE" | grep -q "502"; then
    echo "❌ Получен 502 Bad Gateway - WebSocket сервер не доступен на localhost:8080"
elif echo "$RESPONSE" | grep -q "101"; then
    echo "✅ WebSocket Upgrade работает через nginx"
else
    echo "⚠️ Неожиданный ответ:"
    echo "$RESPONSE"
fi

# 7. Проверка логов nginx
echo
echo "7️⃣ Последние ошибки nginx:"
tail -10 /var/log/nginx/error.log | grep -v "SSL_do_handshake" || echo "Нет недавних ошибок"

echo
echo "✅ Проверка завершена"
echo
echo "ВАЖНО: Убедитесь что:"
echo "1. WebSocket сервер работает на localhost:8080"
echo "2. В production используется wss://hesovoice.online/ws"
echo "3. SSL сертификаты настроены для HTTPS/WSS"