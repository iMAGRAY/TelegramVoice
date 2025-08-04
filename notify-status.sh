#!/bin/bash

# Скрипт уведомлений о статусе развертывания
# Отправляет краткий отчет о состоянии системы

# Параметры
STATUS_FILE="/tmp/telegram_voice_status.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Функция для проверки статуса
check_status() {
    local errors=0
    local warnings=0
    
    # Проверка PM2 процессов
    if ! pm2 list | grep "websocket-server" | grep -q "online"; then
        ((errors++))
    fi
    
    if ! pm2 list | grep "frontend" | grep -q "online"; then
        ((errors++))
    fi
    
    # Проверка портов
    if ! netstat -tlnp | grep :8080 > /dev/null; then
        ((errors++))
    fi
    
    if ! netstat -tlnp | grep :3000 > /dev/null; then
        ((errors++))
    fi
    
    # Проверка HTTP ответа
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000 || echo "000")
    if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "404" ]; then
        ((errors++))
    fi
    
    # Проверка ресурсов
    MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    if [ "$MEMORY_USAGE" -gt 80 ]; then
        ((warnings++))
    fi
    
    DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 80 ]; then
        ((warnings++))
    fi
    
    # Проверка логов
    if pm2 logs --nostream --lines 10 | grep -i "error\|fail\|crash" > /dev/null; then
        ((warnings++))
    fi
    
    echo "$errors:$warnings"
}

# Основная функция уведомления
send_notification() {
    local deploy_status="$1"
    local commit_hash=$(git rev-parse --short HEAD)
    local status_check=$(check_status)
    local errors=$(echo "$status_check" | cut -d':' -f1)
    local warnings=$(echo "$status_check" | cut -d':' -f2)
    
    # Определение общего статуса
    if [ "$errors" -eq 0 ] && [ "$warnings" -eq 0 ]; then
        OVERALL_STATUS="🟢 УСПЕШНО"
        STATUS_ICON="✅"
    elif [ "$errors" -eq 0 ]; then
        OVERALL_STATUS="🟡 С ПРЕДУПРЕЖДЕНИЯМИ ($warnings)"
        STATUS_ICON="⚠️"
    else
        OVERALL_STATUS="🔴 ЕСТЬ ОШИБКИ ($errors ошибок, $warnings предупреждений)"
        STATUS_ICON="❌"
    fi
    
    # Создание отчета
    cat > "$STATUS_FILE" << EOF
$STATUS_ICON TELEGRAM VOICE DEPLOY REPORT
========================================
⏰ Время: $TIMESTAMP
🔄 Коммит: $commit_hash
📊 Статус: $OVERALL_STATUS

🔧 СЕРВИСЫ:
$(pm2 list | grep -E "(websocket-server|frontend)" | awk '{print "   "$2": "$10}')

🌐 ПОРТЫ:
   • WebSocket (8080): $(netstat -tlnp | grep :8080 > /dev/null && echo "✅ Работает" || echo "❌ Не работает")
   • HTTP (3000): $(netstat -tlnp | grep :3000 > /dev/null && echo "✅ Работает" || echo "❌ Не работает")

💾 РЕСУРСЫ:
   • RAM: ${MEMORY_USAGE}%
   • Диск: ${DISK_USAGE}%
   • Load: $(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}')

🌍 ДОСТУПНОСТЬ:
   • HTTP код: $HTTP_CODE
   • Внешний доступ: $(curl -s --max-time 3 http://89.23.115.156:3000 > /dev/null && echo "✅ Доступен" || echo "❌ Недоступен")

📝 ПОСЛЕДНИЕ ЛОГИ:
$(pm2 logs --nostream --lines 3 2>/dev/null | head -3 || echo "Логи недоступны")

========================================
EOF
    
    # Вывод отчета
    cat "$STATUS_FILE"
    
    # Сохранение в историю
    echo "[$TIMESTAMP] Deploy: $OVERALL_STATUS" >> /root/TelegramVoice/logs/deploy-history.log
}

# Функция для краткого статуса
quick_status() {
    local status_check=$(check_status)
    local errors=$(echo "$status_check" | cut -d':' -f1)
    local warnings=$(echo "$status_check" | cut -d':' -f2)
    
    if [ "$errors" -eq 0 ] && [ "$warnings" -eq 0 ]; then
        echo "🟢 Система работает нормально"
    elif [ "$errors" -eq 0 ]; then
        echo "🟡 Система работает с предупреждениями ($warnings)"
    else
        echo "🔴 Система имеет проблемы ($errors ошибок)"
    fi
}

# Основная логика
case "${1:-full}" in
    "quick")
        quick_status
        ;;
    "full"|*)
        send_notification "${2:-manual}"
        ;;
esac