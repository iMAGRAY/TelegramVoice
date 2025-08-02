#!/bin/bash
# Скрипт автоматической настройки сервера для Telegram Voice Mini App
# Запустите на сервере: bash setup-server.sh

set -e

echo "🚀 Начинаем настройку сервера для Telegram Voice Mini App..."

# Переменные (замените на ваши значения)
DOMAIN="hesovoice.online"
TELEGRAM_BOT_TOKEN="8435039563:AAHitg2S2qy3BDm3-L3ns9DCA9_ynDNpwcE"
GITHUB_REPO="https://github.com/yourusername/TelegramVoice.git"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Функция для вывода сообщений
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Проверка, что скрипт запущен от root
if [[ $EUID -ne 0 ]]; then
   error "Этот скрипт должен быть запущен от root"
fi

# Обновление системы
log "Обновляем систему..."
apt update && apt upgrade -y

# Установка необходимых пакетов
log "Устанавливаем необходимые пакеты..."
apt install -y curl git nginx certbot python3-certbot-nginx build-essential pkg-config libssl-dev

# Установка Node.js 20
log "Устанавливаем Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Установка Rust
log "Устанавливаем Rust..."
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# Создание директории для проекта
log "Создаем директорию для проекта..."
mkdir -p /var/www
cd /var/www

# Клонирование репозитория
if [ -d "TelegramVoice" ]; then
    log "Обновляем существующий репозиторий..."
    cd TelegramVoice
    git pull origin main
else
    log "Клонируем репозиторий..."
    git clone $GITHUB_REPO
    cd TelegramVoice
fi

# Создание переменных окружения для Mini App
log "Настраиваем переменные окружения для Mini App..."
cat > /var/www/TelegramVoice/mini-app/.env.production << EOF
NEXT_PUBLIC_WEBSOCKET_URL=wss://${DOMAIN}/ws
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
EOF

# Создание переменных окружения для Signaling Server
log "Настраиваем переменные окружения для Signaling Server..."
cat > /var/www/TelegramVoice/signaling-server/.env << EOF
RUST_LOG=info
WEBSOCKET_PORT=8080
EOF

# Сборка Mini App
log "Собираем Mini App..."
cd /var/www/TelegramVoice/mini-app
npm install
npm run build

# Сборка Signaling Server
log "Собираем Signaling Server..."
cd /var/www/TelegramVoice/signaling-server
/root/.cargo/bin/cargo build --release

# Настройка Nginx
log "Настраиваем Nginx..."
cat > /etc/nginx/sites-available/telegramvoice << 'EOF'
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    # SSL будет настроен certbot
    
    # Заголовки безопасности
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src 'self' wss://${DOMAIN} https://telegram.org" always;

    # Логирование
    access_log /var/log/nginx/telegramvoice_access.log;
    error_log /var/log/nginx/telegramvoice_error.log;

    # Mini App статические файлы
    location / {
        root /var/www/TelegramVoice/mini-app/out;
        try_files $uri $uri.html $uri/ =404;
        
        # Кэширование статики
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # WebSocket прокси для сигналинг сервера
    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket таймауты
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
        
        # Отключаем буферизацию для WebSocket
        proxy_buffering off;
    }
}
EOF

# Замена переменных в конфиге Nginx
sed -i "s/\${DOMAIN}/${DOMAIN}/g" /etc/nginx/sites-available/telegramvoice

# Активация конфигурации Nginx
log "Активируем конфигурацию Nginx..."
ln -sf /etc/nginx/sites-available/telegramvoice /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Получение SSL сертификата
log "Получаем SSL сертификат..."
certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m admin@${DOMAIN}

# Создание systemd сервиса для Signaling Server
log "Создаем systemd сервис для Signaling Server..."
cat > /etc/systemd/system/telegram-voice-signaling.service << EOF
[Unit]
Description=Telegram Voice Signaling Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/TelegramVoice/signaling-server
Environment="RUST_LOG=info"
Environment="RUST_BACKTRACE=1"
ExecStart=/var/www/TelegramVoice/signaling-server/target/release/signaling-server
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Установка прав доступа
log "Устанавливаем права доступа..."
chown -R www-data:www-data /var/www/TelegramVoice
chmod +x /var/www/TelegramVoice/signaling-server/target/release/signaling-server

# Запуск сервисов
log "Запускаем сервисы..."
systemctl daemon-reload
systemctl enable telegram-voice-signaling
systemctl restart telegram-voice-signaling
systemctl status telegram-voice-signaling --no-pager

# Настройка firewall
log "Настраиваем firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8080/tcp
echo "y" | ufw enable

# Создание скрипта обновления
log "Создаем скрипт обновления..."
cat > /var/www/TelegramVoice/update.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Обновляем Telegram Voice Mini App..."

cd /var/www/TelegramVoice
git pull origin main

# Обновление Mini App
cd mini-app
npm install
npm run build

# Обновление Signaling Server
cd ../signaling-server
/root/.cargo/bin/cargo build --release

# Перезапуск сервисов
systemctl restart telegram-voice-signaling
systemctl reload nginx

echo "✅ Обновление завершено!"
EOF

chmod +x /var/www/TelegramVoice/update.sh

# Настройка автоматического обновления SSL
log "Настраиваем автоматическое обновление SSL..."
echo "0 2 * * * /usr/bin/certbot renew --quiet" | crontab -

# Создание скрипта мониторинга
log "Создаем скрипт мониторинга..."
cat > /var/www/TelegramVoice/monitor.sh << 'EOF'
#!/bin/bash

echo "📊 Статус сервисов Telegram Voice:"
echo "=================================="
echo ""
echo "🌐 Nginx:"
systemctl status nginx --no-pager | grep "Active:"
echo ""
echo "🦀 Signaling Server:"
systemctl status telegram-voice-signaling --no-pager | grep "Active:"
echo ""
echo "💾 Использование диска:"
df -h | grep -E "^/dev/"
echo ""
echo "🧠 Использование памяти:"
free -h
echo ""
echo "📈 Нагрузка системы:"
uptime
echo ""
echo "🔌 Активные WebSocket подключения:"
ss -tan | grep :8080 | grep ESTAB | wc -l
echo ""
echo "📝 Последние логи Signaling Server:"
journalctl -u telegram-voice-signaling -n 10 --no-pager
EOF

chmod +x /var/www/TelegramVoice/monitor.sh

# Вывод финальной информации
echo ""
echo "✅ ${GREEN}Настройка завершена успешно!${NC}"
echo ""
echo "📋 Информация о настройке:"
echo "=========================="
echo "🌐 Домен: https://${DOMAIN}"
echo "🔌 WebSocket URL: wss://${DOMAIN}/ws"
echo "📁 Путь к проекту: /var/www/TelegramVoice"
echo ""
echo "🛠️ Полезные команды:"
echo "==================="
echo "📊 Мониторинг: /var/www/TelegramVoice/monitor.sh"
echo "🔄 Обновление: /var/www/TelegramVoice/update.sh"
echo "📝 Логи Nginx: tail -f /var/log/nginx/telegramvoice_*.log"
echo "📝 Логи Signaling: journalctl -u telegram-voice-signaling -f"
echo ""
echo "🚀 Telegram Bot настройка:"
echo "========================="
echo "1. Откройте @BotFather"
echo "2. Используйте /setmenubutton"
echo "3. Выберите вашего бота"
echo "4. Установите URL: https://${DOMAIN}"
echo ""
echo "⚠️  Важно: Не забудьте обновить GITHUB_REPO в скрипте!"
echo ""