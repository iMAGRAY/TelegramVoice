#!/bin/bash

# Скрипт для локальной разработки
# Запускает все необходимые сервисы в dev режиме

set -e

echo "🔧 Запуск локальной разработки TelegramVoice..."

# Проверка зависимостей
echo "📦 Проверка зависимостей..."

# Установка зависимостей фронтенда
echo "📥 Установка зависимостей фронтенда..."
cd mini-app
npm install

# Проверка Rust
echo "🦀 Проверка Rust проекта..."
cd ../signaling-server
cargo check

# Возврат в корневую директорию
cd ..

echo "✅ Готово к разработке!"
echo ""
echo "Для запуска сервисов используйте:"
echo "  Frontend: cd mini-app && npm run dev"
echo "  Backend:  cd signaling-server && cargo run"
echo ""
echo "📝 Workflow разработки:"
echo "  1. Разработка локально"
echo "  2. git add . && git commit -m 'описание'"
echo "  3. git push origin main"
echo "  4. На сервере: ./deploy.sh"