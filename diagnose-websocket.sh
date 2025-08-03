#!/bin/bash

echo "🔍 Диагностика WebSocket сервера"
echo "================================"

# Проверка PM2 процессов
echo "📋 PM2 статус:"
pm2 status

# Проверка портов
echo ""
echo "🔌 Проверка портов:"
echo "Порт 8080 (WebSocket):"
netstat -tlnp | grep ":8080" || echo "❌ Порт 8080 не найден"

echo ""
echo "Порт 3000 (Frontend):"
netstat -tlnp | grep ":3000" || echo "❌ Порт 3000 не найден"

# Проверка процессов signaling-server
echo ""
echo "🦀 Rust процессы:"
ps aux | grep signaling-server | grep -v grep || echo "❌ Rust процессы не найдены"

# Проверка логов PM2
echo ""
echo "📝 Логи signaling-server (последние 10 строк):"
pm2 logs signaling-server --lines 10 --nostream || echo "❌ Не удается получить логи"

# Тестирование локального подключения к WebSocket
echo ""
echo "🧪 Тест локального подключения:"
timeout 3 bash -c "cat < /dev/tcp/127.0.0.1/8080" >/dev/null 2>&1 && echo "✅ Локальное подключение к 8080 работает" || echo "❌ Локальное подключение к 8080 не работает"

# Проверка nginx конфигурации
echo ""
echo "⚙️ Nginx конфигурация WebSocket:"
nginx -t && echo "✅ Nginx конфигурация валидна" || echo "❌ Nginx конфигурация содержит ошибки"

# Проверка nginx логов
echo ""
echo "📋 Nginx error лог (последние 5 строк):"
tail -5 /var/log/nginx/error.log 2>/dev/null || echo "❌ Не удается прочитать nginx error лог"

echo ""
echo "🎯 Тест WebSocket handshake через nginx:"
curl -s -I --http1.1 \
  --header "Connection: Upgrade" \
  --header "Upgrade: websocket" \
  --header "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  --header "Sec-WebSocket-Version: 13" \
  http://localhost/ws | head -1 || echo "❌ WebSocket handshake не удался"

echo ""
echo "✅ Диагностика завершена"