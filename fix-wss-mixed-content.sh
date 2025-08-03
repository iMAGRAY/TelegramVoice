#!/bin/bash
# Исправление Mixed Content ошибки - настройка WSS

echo "🔒 ИСПРАВЛЕНИЕ WSS ДЛЯ HTTPS"
echo "==========================="
echo

# 1. Исправляем nginx конфигурацию для WSS
echo "1️⃣ Исправление nginx конфигурации..."

# Резервная копия
cp /etc/nginx/sites-available/telegramvoice /etc/nginx/sites-available/telegramvoice-$(date +%Y%m%d-%H%M%S).bak

# Создаем исправленную конфигурацию
cat > /etc/nginx/sites-available/telegramvoice << 'EOF'
# HTTP redirect to HTTPS
server {
    listen 80;
    server_name hesovoice.online;
    return 301 https://$server_name$request_uri;
}

# HTTP server for IP address (без SSL)
server {
    listen 80;
    server_name 89.23.115.156;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # HTTP WebSocket для IP (для тестирования)
    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
        proxy_buffering off;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name hesovoice.online;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/hesovoice.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hesovoice.online/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WSS WebSocket endpoint
    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 10s;
        proxy_buffering off;
        
        # Headers for WebSocket
        proxy_set_header X-NginX-Proxy true;
        proxy_redirect off;
    }
}
EOF

# 2. Проверяем и перезагружаем nginx
echo "2️⃣ Проверка и перезагрузка nginx..."
nginx -t
if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo "✅ Nginx перезагружен"
else
    echo "❌ Ошибка в конфигурации nginx!"
    exit 1
fi

# 3. Обновляем переменные окружения для HTTPS
echo "3️⃣ Обновление переменных окружения..."
cd /root/TelegramVoice/mini-app

# Создаем конфигурацию которая автоматически определяет протокол
cat > .env.production << 'EOF'
# WebSocket URL - автоматическое определение протокола
NEXT_PUBLIC_WEBSOCKET_URL=wss://hesovoice.online/ws
EOF

echo "✅ Обновлен .env.production:"
cat .env.production

# 4. Пересобираем приложение
echo
echo "4️⃣ Пересборка приложения..."
npm run build

# 5. Перезапускаем фронтенд
echo
echo "5️⃣ Перезапуск фронтенда..."
pm2 restart frontend

echo
echo "🎉 ГОТОВО!"
echo "========="
echo
echo "Теперь HTTPS сайт будет использовать WSS:"
echo "- HTTP: http://89.23.115.156:3000 (ws://89.23.115.156:8080)"
echo "- HTTPS: https://hesovoice.online (wss://hesovoice.online/ws)"
echo
echo "Проверьте работу: https://hesovoice.online"