#!/bin/bash

# Скрипт настройки автоматического мониторинга
# Настраивает cron задачи для периодической проверки системы

echo "🔧 Настройка автоматического мониторинга..."

# Создание директории для логов мониторинга
mkdir -p /root/TelegramVoice/logs/monitoring

# Создание скрипта для cron
cat > /root/TelegramVoice/cron-monitor.sh << 'EOF'
#!/bin/bash

# Cron скрипт мониторинга
cd /root/TelegramVoice

# Быстрая проверка статуса
STATUS=$(./notify-status.sh quick)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Логирование статуса
echo "[$TIMESTAMP] $STATUS" >> logs/monitoring/status.log

# Если есть проблемы - детальный мониторинг
if echo "$STATUS" | grep -q "🔴\|🟡"; then
    echo "[$TIMESTAMP] Обнаружены проблемы, запуск детального мониторинга..." >> logs/monitoring/status.log
    ./monitor.sh >> logs/monitoring/detailed-$(date +%Y%m%d).log 2>&1
fi

# Ротация логов (оставляем только последние 7 дней)
find logs/monitoring/ -name "detailed-*.log" -mtime +7 -delete
EOF

chmod +x /root/TelegramVoice/cron-monitor.sh

# Настройка cron задач
echo "⏰ Настройка cron задач..."

# Создание crontab entries
CRON_ENTRIES="
# TelegramVoice мониторинг
# Каждые 5 минут - быстрая проверка
*/5 * * * * /root/TelegramVoice/cron-monitor.sh

# Каждый час - детальный отчет
0 * * * * cd /root/TelegramVoice && ./notify-status.sh full >> logs/monitoring/hourly.log 2>&1

# Ежедневно в 6:00 - очистка старых логов PM2
0 6 * * * pm2 flush

# Еженедельно в воскресенье в 3:00 - перезапуск сервисов для профилактики  
0 3 * * 0 cd /root/TelegramVoice && pm2 restart all && ./monitor.sh >> logs/monitoring/weekly-restart.log 2>&1
"

# Добавление в crontab
(crontab -l 2>/dev/null; echo "$CRON_ENTRIES") | crontab -

echo "✅ Автоматический мониторинг настроен!"
echo ""
echo "📋 Настроенные задачи:"
echo "   • Каждые 5 минут: быстрая проверка статуса"
echo "   • Каждый час: детальный отчет"
echo "   • Ежедневно в 6:00: очистка логов PM2"
echo "   • Еженедельно: профилактический перезапуск"
echo ""
echo "📊 Логи мониторинга:"
echo "   • Статус: logs/monitoring/status.log"
echo "   • Часовые отчеты: logs/monitoring/hourly.log"  
echo "   • Детальные логи: logs/monitoring/detailed-YYYYMMDD.log"
echo ""
echo "🔍 Команды для проверки:"
echo "   ./monitor.sh          - ручная проверка"
echo "   ./notify-status.sh    - отчет о статусе"
echo "   crontab -l           - просмотр cron задач"
echo "   tail -f logs/monitoring/status.log - живой мониторинг"