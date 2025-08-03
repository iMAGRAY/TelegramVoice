#!/bin/bash

# Скрипт автоматической настройки Nginx для WebSocket прокси
# Выполнять на продакшен сервере

set -e

echo "🔧 Настройка Nginx для WebSocket прокси..."

# Проверяем, что nginx установлен
if ! command -v nginx &> /dev/null; then
    echo "📦 Установка Nginx..."
    apt update
    apt install -y nginx
fi

# Копируем конфигурацию
echo "📝 Копирование конфигурации Nginx..."
cp nginx-websocket.conf /etc/nginx/sites-available/telegramvoice

# Создаем символическую ссылку
echo "🔗 Активация сайта..."
ln -sf /etc/nginx/sites-available/telegramvoice /etc/nginx/sites-enabled/

# Удаляем дефолтный сайт если существует
if [ -f /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
    echo "🗑️  Удален дефолтный сайт Nginx"
fi

# Проверяем конфигурацию
echo "✅ Проверка конфигурации Nginx..."
nginx -t

# Перезапускаем nginx
echo "🔄 Перезапуск Nginx..."
systemctl reload nginx
systemctl enable nginx

# Проверяем статус
echo "📊 Статус Nginx:"
systemctl status nginx --no-pager

# Настройка SSL сертификата (опционально)
if command -v certbot &> /dev/null; then
    echo "🔒 Настройка SSL сертификата..."
    echo "Запустите: certbot --nginx -d hesovoice.online"
else
    echo "⚠️  Certbot не установлен. Для HTTPS выполните:"
    echo "   apt install certbot python3-certbot-nginx"
    echo "   certbot --nginx -d hesovoice.online"
fi

# Проверка портов
echo "🔍 Проверка открытых портов..."
echo "HTTP (80):"
curl -s -o /dev/null -w "%{http_code}" http://localhost || echo "Порт 80 недоступен"

echo "Next.js (3000):"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "Порт 3000 недоступен"

echo "WebSocket (8080):"
timeout 5 bash -c "cat < /dev/tcp/localhost/8080" && echo "Порт 8080 открыт" || echo "Порт 8080 недоступен"

echo ""
echo "✅ Настройка Nginx завершена!"
echo "🌐 Приложение доступно на http://hesovoice.online"
echo "📡 WebSocket доступен на ws://hesovoice.online/ws"
echo ""
echo "🔒 Для настройки HTTPS выполните:"
echo "   certbot --nginx -d hesovoice.online"