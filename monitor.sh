#!/bin/bash

# Скрипт мониторинга состояния TelegramVoice системы
# Проверяет все компоненты и выводит детальный отчет

set -e

echo "📊 Мониторинг системы TelegramVoice"
echo "=================================="
echo "⏰ $(date)"
echo ""

# Функция для цветного вывода
print_status() {
    if [ "$2" = "OK" ]; then
        echo "✅ $1: OK"
    elif [ "$2" = "WARNING" ]; then
        echo "⚠️  $1: WARNING"
    else
        echo "❌ $1: ERROR"
    fi
}

# 1. Проверка PM2 процессов
echo "🔧 Проверка PM2 процессов:"
if pm2 list | grep -q "online"; then
    pm2 status
    
    # Проверка конкретных процессов
    if pm2 list | grep "rust-websocket" | grep -q "online"; then
        print_status "Rust WebSocket сервер" "OK"
    else
        print_status "Rust WebSocket сервер" "ERROR"
    fi
    
    if pm2 list | grep "nextjs-static" | grep -q "online"; then
        print_status "Next.js статик сервер" "OK"
    else
        print_status "Next.js статик сервер" "ERROR"
    fi
else
    print_status "PM2 процессы" "ERROR"
fi

echo ""

# 2. Проверка портов
echo "🌐 Проверка портов:"

# WebSocket порт 8080
if netstat -tlnp | grep :8080 > /dev/null; then
    print_status "WebSocket порт 8080" "OK"
    WS_PID=$(netstat -tlnp | grep :8080 | awk '{print $7}' | cut -d'/' -f1)
    echo "   └─ PID: $WS_PID"
else
    print_status "WebSocket порт 8080" "ERROR"
fi

# HTTP порт 3000
if netstat -tlnp | grep :3000 > /dev/null; then
    print_status "HTTP порт 3000" "OK"
    HTTP_PID=$(netstat -tlnp | grep :3000 | awk '{print $7}' | cut -d'/' -f1)
    echo "   └─ PID: $HTTP_PID"
else
    print_status "HTTP порт 3000" "ERROR"
fi

echo ""

# 3. Проверка HTTP ответов
echo "📡 Проверка HTTP ответов:"

# Проверка Next.js приложения
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    print_status "HTTP ответ (localhost:3000)" "OK"
    echo "   └─ HTTP код: $HTTP_CODE"
elif [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "500" ]; then
    print_status "HTTP ответ (localhost:3000)" "WARNING"
    echo "   └─ HTTP код: $HTTP_CODE (сервер работает, но есть проблемы)"
else
    print_status "HTTP ответ (localhost:3000)" "ERROR"
    echo "   └─ HTTP код: $HTTP_CODE"
fi

echo ""

# 4. Проверка использования ресурсов
echo "💾 Использование ресурсов:"

# Память
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
echo "   🧠 RAM: ${MEMORY_USAGE}%"
if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
    print_status "Использование памяти" "WARNING"
else
    print_status "Использование памяти" "OK"
fi

# Диск
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
echo "   💿 Диск: ${DISK_USAGE}%"
if [ "$DISK_USAGE" -gt 80 ]; then
    print_status "Использование диска" "WARNING"
else
    print_status "Использование диска" "OK"
fi

# CPU Load Average
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
echo "   ⚡ Load Average: $LOAD_AVG"

echo ""

# 5. Проверка логов на ошибки
echo "📝 Анализ логов (последние 20 строк):"

if pm2 logs --nostream --lines 20 | grep -i "error\|fail\|crash\|exception" > /dev/null; then
    print_status "Логи" "WARNING"
    echo "   └─ Обнаружены ошибки:"
    pm2 logs --nostream --lines 10 | grep -i "error\|fail\|crash\|exception" | head -3
    echo "   └─ Полные логи: pm2 logs"
else
    print_status "Логи" "OK"
    echo "   └─ Критические ошибки не обнаружены"
fi

echo ""

# 6. Проверка uptime процессов
echo "⏱️  Время работы процессов:"
pm2 list | grep -E "(rust-websocket|nextjs-static)" | while read line; do
    PROCESS_NAME=$(echo "$line" | awk '{print $2}')
    UPTIME=$(echo "$line" | awk '{print $6}')
    echo "   └─ $PROCESS_NAME: $UPTIME"
done

echo ""

# 7. Проверка Git статуса
echo "🔄 Git статус:"
cd /root/TelegramVoice
GIT_STATUS=$(git status --porcelain)
if [ -z "$GIT_STATUS" ]; then
    print_status "Git рабочая директория" "OK"
    echo "   └─ Чистая рабочая директория"
else
    print_status "Git рабочая директория" "WARNING"
    echo "   └─ Есть несохраненные изменения"
fi

CURRENT_COMMIT=$(git rev-parse --short HEAD)
echo "   └─ Текущий коммит: $CURRENT_COMMIT"

echo ""

# 8. Общий статус
echo "📊 ОБЩИЙ СТАТУС СИСТЕМЫ:"
echo "========================"

# Подсчет проблем
ERRORS=0
WARNINGS=0

# Проверяем основные компоненты
if ! pm2 list | grep "rust-websocket" | grep -q "online"; then
    ((ERRORS++))
fi

if ! pm2 list | grep "nextjs-static" | grep -q "online"; then
    ((ERRORS++))
fi

if ! netstat -tlnp | grep :8080 > /dev/null; then
    ((ERRORS++))
fi

if ! netstat -tlnp | grep :3000 > /dev/null; then
    ((ERRORS++))
fi

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "404" ]; then
    ((ERRORS++))
fi

if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
    ((WARNINGS++))
fi

if [ "$DISK_USAGE" -gt 80 ]; then
    ((WARNINGS++))
fi

if pm2 logs --nostream --lines 20 | grep -i "error\|fail\|crash" > /dev/null; then
    ((WARNINGS++))
fi

# Вывод общего статуса
if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
    echo "🟢 СИСТЕМА РАБОТАЕТ НОРМАЛЬНО"
elif [ "$ERRORS" -eq 0 ]; then
    echo "🟡 СИСТЕМА РАБОТАЕТ (предупреждения: $WARNINGS)"
else
    echo "🔴 СИСТЕМА ИМЕЕТ ПРОБЛЕМЫ (ошибки: $ERRORS, предупреждения: $WARNINGS)"
fi

echo ""
echo "🔧 Команды для диагностики:"
echo "   pm2 logs     - просмотр логов"
echo "   pm2 monit    - интерактивный мониторинг"
echo "   pm2 restart all - перезапуск всех процессов"