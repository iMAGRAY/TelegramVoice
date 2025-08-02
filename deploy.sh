#!/bin/bash

# Скрипт развертывания на продакшен сервере
# Выполнять ТОЛЬКО на сервере 89.23.115.156

set -e

echo "🚀 Начинаем развертывание TelegramVoice..."

# 1. Обновление кода из Git
echo "📥 Получение последних изменений из Git..."
cd /root/TelegramVoice
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

# 6. Проверка статуса
echo "✅ Проверка статуса сервисов..."
pm2 status

echo "🎉 Развертывание завершено!"
echo "🌐 Приложение доступно на порту 3000"
echo "📡 WebSocket сервер на порту 8080"