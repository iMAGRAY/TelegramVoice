#!/bin/bash
# Детальная диагностика порта 8080

echo "🔍 ДИАГНОСТИКА ПОРТА 8080"
echo "========================"
echo

echo "1. Проверка через lsof:"
lsof -i:8080 -P -n 2>/dev/null || echo "Никто не слушает порт 8080 (lsof)"

echo
echo "2. Проверка через ss:"
ss -tlnp | grep :8080 || echo "Никто не слушает порт 8080 (ss)"

echo
echo "3. Проверка через fuser:"
fuser -v 8080/tcp 2>&1 || echo "Никто не использует порт 8080 (fuser)"

echo
echo "4. Все процессы с 8080 в командной строке:"
ps aux | grep 8080 | grep -v grep || echo "Нет процессов с 8080"

echo
echo "5. PM2 процессы:"
pm2 list

echo
echo "6. Systemd сервисы WebSocket:"
systemctl status telegramvoice-ws --no-pager 2>&1 | head -10 || true
systemctl status telegramvoice-backup-ws --no-pager 2>&1 | head -10 || true

echo
echo "7. Поиск всех WebSocket процессов:"
ps aux | grep -E "(signaling-server|backup-ws-server|ws-server|websocket)" | grep -v grep || echo "WebSocket процессы не найдены"

echo
echo "8. История PM2 логов для WebSocket:"
pm2 logs --lines 5 --nostream 2>&1 | grep -A5 -B5 "8080\|EADDRINUSE" || echo "Нет логов о порте 8080"

echo
echo "9. Проверка, не запущен ли другой веб-сервер на 8080:"
curl -s -o /dev/null -w "HTTP статус: %{http_code}\n" http://localhost:8080 || echo "Нет HTTP ответа"

echo
echo "10. Попытка определить, что именно слушает порт:"
if lsof -i:8080 -P -n >/dev/null 2>&1; then
    echo "Порт 8080 ЗАНЯТ!"
    echo "Убиваем процесс..."
    lsof -ti:8080 | xargs kill -9 2>/dev/null && echo "Процесс убит" || echo "Не удалось убить процесс"
else
    echo "Порт 8080 СВОБОДЕН"
fi

echo
echo "Диагностика завершена"