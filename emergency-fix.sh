#!/bin/bash
# ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ WEBSOCKET СЕРВЕРА

echo "🚨 ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ WEBSOCKET"
echo "===================================="
echo

# Переход в директорию проекта
cd /root/TelegramVoice || exit 1

# 1. ПОЛНАЯ ОСТАНОВКА ВСЕГО
echo "1️⃣ Останавливаем ВСЕ процессы..."
pm2 kill 2>/dev/null || true
killall -9 node 2>/dev/null || true
killall -9 signaling-server 2>/dev/null || true
pkill -f "signaling-server" 2>/dev/null || true
pkill -f "serve" 2>/dev/null || true

# Убиваем все что слушает наши порты
for port in 8080 3000; do
    pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo "Убиваем процесс $pid на порту $port"
        kill -9 $pid 2>/dev/null || true
    fi
done

sleep 2
echo "✅ Все процессы остановлены"

# 2. ПРОВЕРКА БИНАРНОГО ФАЙЛА
echo
echo "2️⃣ Проверка бинарного файла..."
BINARY="/root/TelegramVoice/signaling-server/target/release/signaling-server"

if [ -f "$BINARY" ]; then
    echo "Файл найден, проверяем..."
    file "$BINARY"
    chmod +x "$BINARY"
else
    echo "❌ Бинарный файл не найден! Собираем..."
    cd /root/TelegramVoice/signaling-server
    cargo clean
    RUST_LOG=debug cargo build --release
    if [ ! -f "$BINARY" ]; then
        echo "❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось собрать signaling-server!"
        exit 1
    fi
fi

# 3. ТЕСТ ПРЯМОГО ЗАПУСКА
echo
echo "3️⃣ Тест прямого запуска signaling-server..."
cd /root/TelegramVoice/signaling-server
timeout 5 RUST_LOG=info ./target/release/signaling-server &
TEST_PID=$!
sleep 2

if lsof -i:8080 | grep -q LISTEN; then
    echo "✅ Прямой запуск работает!"
    kill $TEST_PID 2>/dev/null || true
else
    echo "❌ Прямой запуск НЕ работает!"
    # Проверяем ошибки
    echo "Проверка зависимостей:"
    ldd "$BINARY" | grep "not found" || echo "Все зависимости на месте"
fi

# 4. НОВАЯ КОНФИГУРАЦИЯ PM2
echo
echo "4️⃣ Создаем новую конфигурацию PM2..."
cd /root/TelegramVoice

cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'ws-server',
      script: '/root/TelegramVoice/signaling-server/target/release/signaling-server',
      cwd: '/root/TelegramVoice/signaling-server',
      env: {
        RUST_LOG: 'info'
      },
      error_file: '/root/TelegramVoice/logs/ws-error.log',
      out_file: '/root/TelegramVoice/logs/ws-out.log',
      time: true,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 50,
      min_uptime: '10s',
      watch: false
    },
    {
      name: 'web-server',
      script: '/usr/bin/serve',
      args: '-s /root/TelegramVoice/mini-app/out -l 3000 --no-clipboard',
      cwd: '/root/TelegramVoice/mini-app',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/root/TelegramVoice/logs/web-error.log',
      out_file: '/root/TelegramVoice/logs/web-out.log',
      time: true,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 50,
      min_uptime: '10s',
      watch: false
    }
  ]
};
EOF

# 5. ЗАПУСК ЧЕРЕЗ PM2
echo
echo "5️⃣ Запускаем через PM2..."
pm2 start ecosystem.config.js

# 6. ЖДЕМ И ПРОВЕРЯЕМ
echo
echo "6️⃣ Ожидание запуска (15 секунд)..."
for i in {1..15}; do
    echo -n "."
    sleep 1
done
echo

# 7. СТАТУС
echo
echo "7️⃣ Проверка статуса..."
pm2 list

# 8. ДЕТАЛЬНАЯ ПРОВЕРКА WEBSOCKET
echo
echo "8️⃣ Проверка WebSocket..."

# Проверка процесса
if pm2 list | grep -q "ws-server.*online"; then
    echo "✅ Процесс ws-server запущен"
else
    echo "❌ Процесс ws-server НЕ запущен"
    echo "Логи ошибок:"
    tail -20 /root/TelegramVoice/logs/ws-error.log 2>/dev/null || echo "Нет логов"
fi

# Проверка порта
if lsof -i:8080 | grep -q LISTEN; then
    echo "✅ Порт 8080 слушается"
    lsof -i:8080
else
    echo "❌ Порт 8080 НЕ слушается"
fi

# Тест соединения
if timeout 3 bash -c "</dev/tcp/localhost/8080" 2>/dev/null; then
    echo "✅ TCP соединение работает"
else
    echo "❌ TCP соединение НЕ работает"
fi

# 9. АЛЬТЕРНАТИВНЫЙ ЗАПУСК
if ! lsof -i:8080 | grep -q LISTEN; then
    echo
    echo "9️⃣ Пробуем альтернативный запуск..."
    
    # Останавливаем PM2 процесс
    pm2 delete ws-server 2>/dev/null || true
    
    # Запускаем напрямую через nohup
    cd /root/TelegramVoice/signaling-server
    nohup RUST_LOG=info ./target/release/signaling-server > /root/TelegramVoice/logs/ws-direct.log 2>&1 &
    echo $! > /root/TelegramVoice/ws-server.pid
    
    sleep 5
    
    if lsof -i:8080 | grep -q LISTEN; then
        echo "✅ Альтернативный запуск успешен!"
        echo "PID: $(cat /root/TelegramVoice/ws-server.pid)"
    else
        echo "❌ Альтернативный запуск тоже не работает"
    fi
fi

# 10. РЕЗЕРВНЫЙ WEBSOCKET СЕРВЕР
if ! lsof -i:8080 | grep -q LISTEN; then
    echo
    echo "🆘 Запускаем РЕЗЕРВНЫЙ WebSocket сервер на Node.js..."
    
    # Устанавливаем ws модуль если нет
    cd /root/TelegramVoice
    if [ ! -d "node_modules/ws" ]; then
        npm install ws
    fi
    
    # Запускаем резервный сервер
    pm2 start backup-ws-server.js --name backup-ws
    sleep 5
    
    if lsof -i:8080 | grep -q LISTEN; then
        echo "✅ Резервный WebSocket сервер запущен!"
    else
        echo "❌ Даже резервный сервер не запускается"
    fi
fi

# 11. ПРОВЕРКА NGINX
echo
echo "🔍 Проверка и настройка nginx..."
chmod +x check-nginx-ws.sh
./check-nginx-ws.sh

# 12. ФИНАЛЬНАЯ ПРОВЕРКА
echo
echo "🏁 ФИНАЛЬНАЯ ПРОВЕРКА:"
echo "====================="

WS_OK=false
HTTP_OK=false

# WebSocket
if timeout 5 bash -c "cat < /dev/tcp/localhost/8080" &>/dev/null; then
    echo "✅ WebSocket сервер РАБОТАЕТ"
    WS_OK=true
else
    echo "❌ WebSocket сервер НЕ РАБОТАЕТ"
fi

# HTTP
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000 || echo "000")
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "404" ]]; then
    echo "✅ HTTP сервер РАБОТАЕТ (код $HTTP_CODE)"
    HTTP_OK=true
else
    echo "❌ HTTP сервер НЕ РАБОТАЕТ (код $HTTP_CODE)"
fi

# Результат
if [ "$WS_OK" = true ] && [ "$HTTP_OK" = true ]; then
    echo
    echo "🎉 ВСЕ СЕРВИСЫ РАБОТАЮТ!"
    pm2 save
else
    echo
    echo "🚨 ПРОБЛЕМЫ НЕ РЕШЕНЫ!"
    echo
    echo "Дополнительная информация:"
    echo "- Проверьте файрвол: ufw status"
    echo "- Проверьте логи: tail -f /root/TelegramVoice/logs/*"
    echo "- Проверьте память: free -h"
    echo "- Проверьте диск: df -h"
    exit 1
fi