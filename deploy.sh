#!/bin/bash

# Скрипт развертывания на продакшен сервере
# Выполнять ТОЛЬКО на сервере 89.23.115.156

# Устанавливаем права выполнения для самого себя
chmod +x "$0"

set -e

echo "🚀 Начинаем развертывание TelegramVoice..."

# 1. Обновление кода из Git
echo "📥 Получение последних изменений из Git..."
cd /root/TelegramVoice

# Сбрасываем все локальные изменения перед pull
echo "🔄 Сброс локальных изменений..."
git reset --hard HEAD
git clean -fd

git pull origin main

# 2. Установка зависимостей и сборка фронтенда
echo "🏗️  Сборка фронтенда..."
cd mini-app
npm install
npm run build

# 3. Сборка backend на Rust
echo "⚙️  Сборка backend..."
cd ../signaling-server
cargo build --release

# 4. Создание директорий для логов
echo "📁 Создание директорий..."
mkdir -p /root/TelegramVoice/logs

# 5. Перезапуск сервисов
echo "🔄 Перезапуск сервисов..."
cd /root/TelegramVoice
pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js

# 6. Ожидание запуска сервисов
echo "⏳ Ожидание запуска сервисов..."
sleep 5

# 7. Проверка статуса сервисов
echo "✅ Проверка статуса сервисов..."
pm2 status

# 8. Проверка работы сервисов
echo "🔍 Проверка работоспособности сервисов..."

# Проверка WebSocket сервера
echo "📡 Проверка WebSocket сервера (порт 8080)..."
if netstat -tlnp | grep :8080 > /dev/null; then
    echo "✅ WebSocket сервер работает на порту 8080"
else
    echo "❌ WebSocket сервер не отвечает на порту 8080"
    exit 1
fi

# Проверка Next.js приложения
echo "🌐 Проверка Next.js приложения (порт 3000)..."
if netstat -tlnp | grep :3000 > /dev/null; then
    echo "✅ Next.js приложение работает на порту 3000"
else
    echo "❌ Next.js приложение не отвечает на порту 3000"
    exit 1
fi

# Проверка HTTP ответа
echo "📋 Проверка HTTP ответа..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|404\|500"; then
    echo "✅ HTTP сервер отвечает"
else
    echo "❌ HTTP сервер не отвечает"
    exit 1
fi

# 9. Проверка логов на ошибки
echo "📝 Проверка логов на критические ошибки..."
if pm2 logs --nostream --lines 10 | grep -i "error\|fail\|crash" > /dev/null; then
    echo "⚠️  Обнаружены ошибки в логах:"
    pm2 logs --nostream --lines 5 | grep -i "error\|fail\|crash"
    echo "⚠️  Проверьте логи: pm2 logs"
else
    echo "✅ В логах нет критических ошибок"
fi

# 10. Настройка мониторинга (если еще не настроен)
echo "🔧 Проверка настройки мониторинга..."
if ! crontab -l 2>/dev/null | grep -q "TelegramVoice мониторинг"; then
    echo "📊 Настройка автоматического мониторинга..."
    chmod +x setup-monitoring.sh
    ./setup-monitoring.sh
else
    echo "✅ Автоматический мониторинг уже настроен"
fi

echo ""
echo "🎉 Развертывание успешно завершено!"
echo "🌐 Приложение доступно на http://localhost:3000"
echo "📡 WebSocket сервер на ws://localhost:8080"
echo ""
echo "📊 Команды мониторинга:"
echo "   ./monitor.sh          - детальный мониторинг"
echo "   ./notify-status.sh    - краткий статус"
echo "   pm2 monit            - интерактивный мониторинг PM2"
echo "   pm2 logs             - логи процессов"
echo "   tail -f logs/monitoring/status.log - живой мониторинг"
