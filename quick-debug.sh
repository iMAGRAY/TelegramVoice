#!/bin/bash
# Быстрая диагностика для GitHub Actions

echo "🔍 БЫСТРАЯ ДИАГНОСТИКА"
echo "===================="
echo

echo "1. Проверка процессов PM2:"
pm2 list

echo
echo "2. Проверка портов:"
netstat -tlnp | grep -E "(8080|3000)" || echo "Порты не найдены"

echo
echo "3. Проверка процессов:"
ps aux | grep -E "(signaling-server|node|serve)" | grep -v grep || echo "Процессы не найдены"

echo
echo "4. Проверка файлов:"
ls -la /root/TelegramVoice/signaling-server/target/release/ 2>/dev/null || echo "Директория release не найдена"

echo
echo "5. Последние логи PM2:"
pm2 logs --lines 5 --nostream 2>/dev/null || echo "Логи недоступны"

echo
echo "6. Попытка прямого запуска:"
cd /root/TelegramVoice/signaling-server
if [ -f "target/release/signaling-server" ]; then
    timeout 3 ./target/release/signaling-server 2>&1 | head -10
else
    echo "Бинарный файл не найден!"
fi

echo
echo "7. Проверка, что слушает порт 8080:"
lsof -i:8080 2>/dev/null || echo "Ничего не слушает порт 8080"

echo
echo "Диагностика завершена"