#!/bin/bash
# Скрипт проверки состояния сервисов

echo "🔍 Проверка состояния сервисов..."
echo

# Проверка PM2 процессов
echo "📊 PM2 процессы:"
pm2 status

echo
echo "📋 PM2 логи (последние 20 строк):"

# Проверка существования процессов
if pm2 list | grep -q "frontend"; then
    echo "--- Frontend logs ---"
    pm2 logs frontend --lines 20 --nostream
else
    echo "--- NextJS Static logs (старое имя) ---"
    pm2 logs nextjs-static --lines 20 --nostream 2>/dev/null || echo "Frontend процесс не найден"
fi

echo
if pm2 list | grep -q "signaling-server"; then
    echo "--- Signaling Server logs ---"
    pm2 logs signaling-server --lines 20 --nostream
else
    echo "--- Rust WebSocket logs (старое имя) ---"
    pm2 logs rust-websocket --lines 20 --nostream 2>/dev/null || echo "Signaling server процесс не найден"
fi

echo
echo "🌐 Проверка портов:"
# Проверка порта 3000 (Next.js)
if lsof -i:3000 >/dev/null 2>&1; then
    echo "✅ Порт 3000 (Next.js) активен"
    lsof -i:3000 | grep LISTEN
else
    echo "❌ Порт 3000 (Next.js) недоступен"
fi

# Проверка порта 8080 (WebSocket)
if lsof -i:8080 >/dev/null 2>&1; then
    echo "✅ Порт 8080 (WebSocket) активен"
    lsof -i:8080 | grep LISTEN
else
    echo "❌ Порт 8080 (WebSocket) недоступен"
fi

echo
echo "🔧 Системные процессы:"
ps aux | grep -E "(node|cargo|signaling)" | grep -v grep

echo
echo "🚀 Попытка перезапуска сервисов..."
pm2 restart ecosystem.config.js

echo
echo "⏳ Ожидание запуска (10 секунд)..."
sleep 10

echo
echo "📊 Финальная проверка:"
pm2 status

# Проверка доступности через curl
echo
echo "🌐 Проверка доступности:"

# WebSocket
if timeout 5 bash -c "cat < /dev/tcp/localhost/8080" &>/dev/null; then
    echo "✅ WebSocket сервер доступен локально"
else
    echo "❌ WebSocket сервер недоступен локально"
fi

# HTTP
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:3000 || echo "000")
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "404" ]]; then
    echo "✅ HTTP сервер доступен локально (код $HTTP_CODE)"
else
    echo "❌ HTTP сервер недоступен локально (код $HTTP_CODE)"
fi