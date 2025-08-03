#!/bin/bash
# Обновление WebSocket URL на прямое подключение

echo "🔄 ОБНОВЛЕНИЕ WEBSOCKET URL"
echo "==========================="
echo

cd /root/TelegramVoice/mini-app

# Обновляем .env.production
echo "NEXT_PUBLIC_WEBSOCKET_URL=ws://89.23.115.156:8080" > .env.production

echo "✅ Обновлен .env.production"
cat .env.production

# Пересобираем приложение
echo
echo "🔨 Пересборка приложения..."
npm run build

# Перезапускаем фронтенд
echo
echo "🔄 Перезапуск фронтенда..."
pm2 restart frontend

echo
echo "✅ Готово! WebSocket теперь доступен по адресу: ws://89.23.115.156:8080"
echo
echo "Проверьте работу приложения: http://89.23.115.156:3000"