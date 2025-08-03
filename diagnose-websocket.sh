#!/bin/bash
# Диагностика WebSocket соединения

echo "🔍 ДИАГНОСТИКА WEBSOCKET"
echo "========================"
echo

# 1. Проверка процесса
echo "1️⃣ Проверка процесса signaling-server:"
if pm2 list | grep -q "signaling-server"; then
    echo "✅ Процесс найден в PM2"
    pm2 describe signaling-server | grep -E "(status|uptime|restarts)"
else
    echo "❌ Процесс НЕ найден в PM2"
fi

# 2. Проверка порта 8080
echo
echo "2️⃣ Проверка порта 8080:"
if lsof -i:8080 2>/dev/null | grep LISTEN; then
    echo "✅ Порт 8080 слушается"
else
    echo "❌ Порт 8080 НЕ слушается"
    
    # Проверяем не занят ли порт
    if lsof -i:8080 2>/dev/null; then
        echo "⚠️ Порт 8080 занят другим процессом:"
        lsof -i:8080
    fi
fi

# 3. Тест TCP соединения
echo
echo "3️⃣ Тест TCP соединения на порт 8080:"
if timeout 2 bash -c "</dev/tcp/localhost/8080" 2>/dev/null; then
    echo "✅ TCP соединение успешно"
else
    echo "❌ TCP соединение НЕ удалось"
fi

# 4. Тест WebSocket upgrade
echo
echo "4️⃣ Тест WebSocket Upgrade:"
WS_RESPONSE=$(curl -s -I -N \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" \
    http://localhost:8080 2>&1)

if echo "$WS_RESPONSE" | grep -q "101"; then
    echo "✅ WebSocket Upgrade успешен"
    echo "$WS_RESPONSE" | head -5
else
    echo "❌ WebSocket Upgrade НЕ удался"
    echo "$WS_RESPONSE" | head -10
fi

# 5. Проверка логов
echo
echo "5️⃣ Последние логи signaling-server:"
echo "=== Ошибки ==="
pm2 logs signaling-server --err --lines 10 --nostream 2>/dev/null || \
    tail -10 /root/TelegramVoice/logs/signaling-server-error.log 2>/dev/null || \
    echo "Логи ошибок не найдены"

echo
echo "=== Вывод ==="
pm2 logs signaling-server --out --lines 10 --nostream 2>/dev/null || \
    tail -10 /root/TelegramVoice/logs/signaling-server-out.log 2>/dev/null || \
    echo "Логи вывода не найдены"

# 6. Проверка файла
echo
echo "6️⃣ Проверка исполняемого файла:"
FILE="/root/TelegramVoice/signaling-server/target/release/signaling-server"
if [ -f "$FILE" ]; then
    echo "✅ Файл существует"
    ls -la "$FILE"
    
    # Проверка, что это действительно исполняемый файл
    if file "$FILE" | grep -q "ELF"; then
        echo "✅ Это корректный исполняемый файл"
    else
        echo "❌ Файл поврежден или не является исполняемым"
        file "$FILE"
    fi
else
    echo "❌ Файл НЕ существует"
fi

# 7. Проверка окружения
echo
echo "7️⃣ Проверка окружения:"
echo "RUST_LOG=${RUST_LOG:-не установлен}"
echo "PATH=$PATH"

# 8. Попытка ручного запуска
echo
echo "8️⃣ Попытка ручного запуска (3 секунды):"
if [ -f "$FILE" ]; then
    cd /root/TelegramVoice/signaling-server
    timeout 3 RUST_LOG=debug ./target/release/signaling-server 2>&1 | head -20
    echo
    echo "Ручной запуск завершен"
fi

# Итоговый вердикт
echo
echo "📊 ИТОГ:"
echo "========"

ISSUES=0

if ! lsof -i:8080 2>/dev/null | grep -q LISTEN; then
    echo "❌ WebSocket сервер НЕ слушает порт 8080"
    ((ISSUES++))
fi

if ! pm2 list | grep -q "signaling-server.*online"; then
    echo "❌ Процесс signaling-server НЕ работает в PM2"
    ((ISSUES++))
fi

if [ ! -f "$FILE" ]; then
    echo "❌ Исполняемый файл НЕ найден"
    ((ISSUES++))
fi

if [ $ISSUES -eq 0 ]; then
    echo "✅ WebSocket сервер работает корректно"
else
    echo
    echo "🚨 Обнаружено проблем: $ISSUES"
    echo
    echo "РЕКОМЕНДАЦИИ:"
    echo "1. Запустите: ./fix-all.sh"
    echo "2. Проверьте логи: pm2 logs signaling-server"
    echo "3. Пересоберите проект: cd signaling-server && cargo build --release"
fi