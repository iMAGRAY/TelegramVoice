#!/bin/bash
# Исправление SSL в nginx конфигурации

echo "🔒 НАСТРОЙКА SSL ДЛЯ WEBSOCKET"
echo "============================="
echo

# Создаем резервную копию
cp /etc/nginx/sites-available/telegramvoice /etc/nginx/sites-available/telegramvoice.bak

# Создаем исправленную конфигурацию
cat > /tmp/telegramvoice-ssl.conf << 'EOF'
# HTTPS server с WebSocket поддержкой
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name hesovoice.online;

    # SSL сертификаты
    ssl_certificate /etc/letsencrypt/live/hesovoice.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hesovoice.online/privkey.pem;
    
    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # CORS headers для WebSocket
    add_header Access-Control-Allow-Origin * always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
    add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;

    # Основное приложение
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket endpoint
    location /ws {
        proxy_pass http://localhost:8080/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 5s;
        
        # Отключаем буферизацию
        proxy_buffering off;
        
        # CORS для WebSocket
        proxy_set_header Origin "";
    }

    # Прямой доступ к порту 8080 (для отладки)
    location /ws-direct/ {
        return 301 http://$server_name:8080/;
    }
}

# HTTP server - редирект на HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name hesovoice.online;
    
    # Разрешаем доступ к .well-known для Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Всё остальное редиректим на HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Сервер для IP адреса (без SSL)
server {
    listen 80;
    listen [::]:80;
    server_name 89.23.115.156;
    
    # CORS headers
    add_header Access-Control-Allow-Origin * always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
    add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket для IP (незашифрованный)
    location /ws {
        proxy_pass http://localhost:8080/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
        proxy_buffering off;
    }
}
EOF

# Копируем новую конфигурацию
cp /tmp/telegramvoice-ssl.conf /etc/nginx/sites-available/telegramvoice

# Проверяем конфигурацию
echo "Проверка конфигурации nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Конфигурация корректна"
    
    # Перезагружаем nginx
    echo "Перезагрузка nginx..."
    systemctl reload nginx
    
    echo "✅ Nginx перезагружен"
else
    echo "❌ Ошибка в конфигурации!"
    # Восстанавливаем старую конфигурацию
    cp /etc/nginx/sites-available/telegramvoice.bak /etc/nginx/sites-available/telegramvoice
    exit 1
fi

echo
echo "📊 Проверка доступности:"
echo "- HTTPS: https://hesovoice.online"
echo "- WSS: wss://hesovoice.online/ws"
echo "- HTTP: http://89.23.115.156"
echo "- WS: ws://89.23.115.156/ws"
echo "- Прямой WS: ws://89.23.115.156:8080"