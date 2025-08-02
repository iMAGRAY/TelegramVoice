# Инструкции по развертыванию Telegram Voice Mini App

## Требования к серверу
- Ubuntu 20.04+ или Debian 11+
- Минимум 2GB RAM
- Открытые порты: 80, 443, 8080
- Установленный Docker и Docker Compose

## Шаг 1: Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка необходимых пакетов
sudo apt install -y curl git nginx certbot python3-certbot-nginx

# Установка Docker (если не установлен)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## Шаг 2: Клонирование проекта

```bash
cd /var/www
sudo git clone https://github.com/yourusername/TelegramVoice.git
cd TelegramVoice
```

## Шаг 3: Настройка переменных окружения

### Для Mini App (создайте файл /var/www/TelegramVoice/mini-app/.env.production):
```env
NEXT_PUBLIC_WEBSOCKET_URL=wss://yourdomain.com/ws
TELEGRAM_BOT_TOKEN=ваш_токен_бота
```

### Для Signaling Server (создайте файл /var/www/TelegramVoice/signaling-server/.env):
```env
RUST_LOG=info
WEBSOCKET_PORT=8080
```

## Шаг 4: Настройка Nginx

Создайте файл `/etc/nginx/sites-available/telegramvoice`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL будет настроен автоматически через certbot
    
    # Заголовки безопасности
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src 'self' wss://yourdomain.com https://telegram.org" always;

    # Mini App
    location / {
        root /var/www/TelegramVoice/mini-app/out;
        try_files $uri $uri.html $uri/ =404;
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
    }
}
```

Активируйте конфигурацию:
```bash
sudo ln -s /etc/nginx/sites-available/telegramvoice /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Шаг 5: Получение SSL сертификата

```bash
sudo certbot --nginx -d yourdomain.com
```

## Шаг 6: Сборка и запуск приложений

### Сборка Mini App:
```bash
cd /var/www/TelegramVoice/mini-app
npm install
npm run build
```

### Сборка Signaling Server:
```bash
cd /var/www/TelegramVoice/signaling-server
cargo build --release
```

## Шаг 7: Создание systemd сервиса для Signaling Server

Создайте файл `/etc/systemd/system/telegram-voice-signaling.service`:

```ini
[Unit]
Description=Telegram Voice Signaling Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/TelegramVoice/signaling-server
Environment="RUST_LOG=info"
ExecStart=/var/www/TelegramVoice/signaling-server/target/release/signaling-server
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Запустите сервис:
```bash
sudo systemctl daemon-reload
sudo systemctl enable telegram-voice-signaling
sudo systemctl start telegram-voice-signaling
sudo systemctl status telegram-voice-signaling
```

## Шаг 8: Настройка Telegram Bot

1. Откройте @BotFather в Telegram
2. Используйте команду `/setmenubutton`
3. Выберите вашего бота
4. Выберите "Configure menu button"
5. Введите название: "Голосовой чат"
6. Введите URL: `https://yourdomain.com`

## Шаг 9: Мониторинг и логи

### Просмотр логов Nginx:
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Просмотр логов Signaling Server:
```bash
sudo journalctl -u telegram-voice-signaling -f
```

## Шаг 10: Обновление приложения

Создайте скрипт `/var/www/TelegramVoice/deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Начинаем обновление..."

# Переход в директорию проекта
cd /var/www/TelegramVoice

# Получение последних изменений
echo "📥 Получаем обновления из репозитория..."
git pull origin main

# Обновление Mini App
echo "🔧 Обновляем Mini App..."
cd mini-app
npm install
npm run build

# Обновление Signaling Server
echo "🦀 Обновляем Signaling Server..."
cd ../signaling-server
cargo build --release

# Перезапуск сервисов
echo "🔄 Перезапускаем сервисы..."
sudo systemctl restart telegram-voice-signaling
sudo systemctl reload nginx

echo "✅ Обновление завершено!"
```

Сделайте скрипт исполняемым:
```bash
chmod +x /var/www/TelegramVoice/deploy.sh
```

## Устранение неполадок

### Проблема: WebSocket не подключается
1. Проверьте, что порт 8080 открыт в firewall
2. Проверьте логи signaling server
3. Убедитесь, что URL в .env.production правильный

### Проблема: Mini App не загружается
1. Проверьте права доступа к файлам
2. Проверьте логи Nginx
3. Убедитесь, что сборка прошла успешно

### Проблема: SSL сертификат
1. Проверьте, что домен правильно настроен
2. Убедитесь, что порты 80 и 443 открыты
3. Проверьте срок действия сертификата

## Безопасность

1. Настройте firewall:
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8080/tcp
sudo ufw enable
```

2. Регулярно обновляйте систему:
```bash
sudo apt update && sudo apt upgrade -y
```

3. Настройте автоматическое обновление SSL сертификата:
```bash
sudo certbot renew --dry-run
```

## Мониторинг производительности

Установите htop для мониторинга ресурсов:
```bash
sudo apt install htop
htop
```

Проверка использования диска:
```bash
df -h
```

Проверка памяти:
```bash
free -h
```