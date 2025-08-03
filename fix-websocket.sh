#!/bin/bash
# Скрипт исправления проблемы с WebSocket сервером

set -e

echo "🔧 Исправление проблемы с WebSocket сервером..."
echo

# 1. Останавливаем старые процессы
echo "🛑 Останавливаем старые процессы..."
pm2 delete all 2>/dev/null || true

# 2. Убиваем зависшие процессы на портах
echo "🔫 Освобождаем порты..."
# Убиваем процессы на порту 8080
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
# Убиваем процессы на порту 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# 3. Проверяем наличие бинарного файла
echo "📦 Проверка бинарного файла signaling-server..."
if [ ! -f "/root/TelegramVoice/signaling-server/target/release/signaling-server" ]; then
    echo "❌ Бинарный файл не найден, собираем..."
    cd /root/TelegramVoice/signaling-server
    cargo build --release
else
    echo "✅ Бинарный файл найден"
fi

# 4. Проверяем права выполнения
echo "🔐 Проверка прав выполнения..."
chmod +x /root/TelegramVoice/signaling-server/target/release/signaling-server

# 5. Проверяем наличие статических файлов
echo "📄 Проверка статических файлов..."
if [ ! -d "/root/TelegramVoice/mini-app/out" ]; then
    echo "❌ Статические файлы не найдены, собираем..."
    cd /root/TelegramVoice/mini-app
    npm install
    npm run build
else
    echo "✅ Статические файлы найдены"
fi

# 6. Проверяем установку serve
echo "🔨 Проверка установки serve..."
if ! command -v serve &> /dev/null; then
    echo "❌ serve не установлен, устанавливаем..."
    npm install -g serve
else
    echo "✅ serve установлен"
fi

# 7. Запускаем процессы через PM2
echo "🚀 Запуск процессов через PM2..."
cd /root/TelegramVoice
pm2 start ecosystem.config.js

# 8. Ждем запуска
echo "⏳ Ожидание запуска (10 секунд)..."
sleep 10

# 9. Проверяем статус
echo "📊 Проверка статуса процессов..."
pm2 status

# 10. Проверяем порты
echo "🌐 Проверка портов..."
if lsof -i:8080 >/dev/null 2>&1; then
    echo "✅ Порт 8080 (WebSocket) активен"
    lsof -i:8080 | grep LISTEN
else
    echo "❌ Порт 8080 (WebSocket) недоступен"
    echo "📋 Логи signaling-server:"
    pm2 logs signaling-server --lines 30 --nostream
fi

if lsof -i:3000 >/dev/null 2>&1; then
    echo "✅ Порт 3000 (HTTP) активен"
else
    echo "❌ Порт 3000 (HTTP) недоступен"
    echo "📋 Логи frontend:"
    pm2 logs frontend --lines 30 --nostream
fi

# 11. Тест WebSocket
echo
echo "🧪 Тест WebSocket соединения..."
if timeout 5 bash -c "cat < /dev/tcp/localhost/8080" &>/dev/null; then
    echo "✅ WebSocket сервер отвечает"
else
    echo "❌ WebSocket сервер не отвечает"
    
    # Дополнительная диагностика
    echo
    echo "🔍 Дополнительная диагностика..."
    echo "Процессы signaling-server:"
    ps aux | grep signaling-server | grep -v grep || echo "Процесс не найден"
    
    echo
    echo "Сетевые соединения:"
    netstat -tlnp | grep 8080 || echo "Порт 8080 не слушается"
    
    echo
    echo "Последние ошибки в логах:"
    journalctl -u pm2-root -n 50 | grep -i error || echo "Нет ошибок в journalctl"
fi

echo
echo "🏁 Скрипт завершен. Проверьте вывод выше для диагностики проблем."