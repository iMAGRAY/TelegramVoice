#!/bin/bash
# Полное исправление всех проблем проекта TelegramVoice

set -e

echo "🔧 ПОЛНОЕ ИСПРАВЛЕНИЕ ПРОЕКТА TELEGRAMVOICE"
echo "==========================================="
echo

# 0. Переход в директорию проекта
cd /root/TelegramVoice

# 1. Остановка всех процессов
echo "🛑 1. ОСТАНОВКА ВСЕХ ПРОЦЕССОВ"
echo "------------------------------"
pm2 kill || true
killall node 2>/dev/null || true
killall signaling-server 2>/dev/null || true

# Принудительное освобождение портов
echo "Освобождение портов..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2
echo "✅ Все процессы остановлены"
echo

# 2. Очистка старых файлов
echo "🧹 2. ОЧИСТКА СТАРЫХ ФАЙЛОВ"
echo "---------------------------"
rm -rf mini-app/out
rm -rf mini-app/.next
rm -rf signaling-server/target
rm -rf ~/.pm2/logs/*
mkdir -p logs
echo "✅ Очистка завершена"
echo

# 3. Обновление кода
echo "📥 3. ОБНОВЛЕНИЕ КОДА"
echo "--------------------"
git fetch origin
git reset --hard origin/main
git clean -fd
echo "✅ Код обновлен"
echo

# 4. Установка глобальных зависимостей
echo "🌐 4. УСТАНОВКА ГЛОБАЛЬНЫХ ЗАВИСИМОСТЕЙ"
echo "--------------------------------------"
npm install -g pm2 serve
echo "✅ Глобальные зависимости установлены"
echo

# 5. Сборка signaling-server
echo "⚙️  5. СБОРКА SIGNALING-SERVER"
echo "-----------------------------"
cd signaling-server
cargo clean
cargo build --release
chmod +x target/release/signaling-server

# Проверка сборки
if [ -f "target/release/signaling-server" ]; then
    echo "✅ Signaling-server успешно собран"
    ls -la target/release/signaling-server
else
    echo "❌ Ошибка сборки signaling-server"
    exit 1
fi
cd ..
echo

# 6. Сборка frontend
echo "🏗️  6. СБОРКА FRONTEND"
echo "--------------------"
cd mini-app
rm -rf node_modules package-lock.json
npm install
npm run build

# Проверка сборки
if [ -d "out" ]; then
    echo "✅ Frontend успешно собран"
    echo "Количество файлов: $(find out -type f | wc -l)"
else
    echo "❌ Ошибка сборки frontend"
    exit 1
fi
cd ..
echo

# 7. Создание правильного ecosystem.config.js
echo "📝 7. СОЗДАНИЕ КОНФИГУРАЦИИ PM2"
echo "-------------------------------"
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'signaling-server',
      script: '/root/TelegramVoice/signaling-server/target/release/signaling-server',
      cwd: '/root/TelegramVoice/signaling-server',
      env: {
        RUST_LOG: 'info,signaling_server=debug'
      },
      error_file: '/root/TelegramVoice/logs/signaling-server-error.log',
      out_file: '/root/TelegramVoice/logs/signaling-server-out.log',
      log_file: '/root/TelegramVoice/logs/signaling-server-combined.log',
      time: true,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000
    },
    {
      name: 'frontend',
      script: 'serve',
      args: '-s out -l 3000 --no-clipboard',
      cwd: '/root/TelegramVoice/mini-app',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/root/TelegramVoice/logs/frontend-error.log',
      out_file: '/root/TelegramVoice/logs/frontend-out.log',
      log_file: '/root/TelegramVoice/logs/frontend-combined.log',
      time: true,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000
    }
  ]
};
EOF
echo "✅ Конфигурация создана"
echo

# 8. Проверка прав
echo "🔐 8. УСТАНОВКА ПРАВ"
echo "-------------------"
chmod +x signaling-server/target/release/signaling-server
chmod +x *.sh
echo "✅ Права установлены"
echo

# 9. Запуск через PM2
echo "🚀 9. ЗАПУСК СЕРВИСОВ"
echo "--------------------"
pm2 start ecosystem.config.js

# Ждем запуска
echo "⏳ Ожидание запуска (15 секунд)..."
sleep 15

# Проверка статуса
pm2 status
echo

# 10. Проверка работоспособности
echo "🧪 10. ПРОВЕРКА РАБОТОСПОСОБНОСТИ"
echo "---------------------------------"

# Проверка WebSocket
echo -n "WebSocket (порт 8080): "
if timeout 5 bash -c "</dev/tcp/localhost/8080" 2>/dev/null; then
    echo "✅ РАБОТАЕТ"
else
    echo "❌ НЕ РАБОТАЕТ"
    echo "Логи signaling-server:"
    pm2 logs signaling-server --lines 30 --nostream
fi

# Проверка HTTP
echo -n "HTTP сервер (порт 3000): "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000 || echo "000")
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "404" ]]; then
    echo "✅ РАБОТАЕТ (код $HTTP_CODE)"
else
    echo "❌ НЕ РАБОТАЕТ (код $HTTP_CODE)"
    echo "Логи frontend:"
    pm2 logs frontend --lines 30 --nostream
fi

echo
echo "📊 Финальная проверка портов:"
netstat -tlnp | grep -E "(8080|3000)" || echo "Порты не найдены"

echo
echo "✨ СКРИПТ ЗАВЕРШЕН"
echo
echo "Используйте следующие команды для мониторинга:"
echo "  pm2 status      - статус процессов"
echo "  pm2 logs        - просмотр логов"
echo "  pm2 monit       - интерактивный мониторинг"
echo "  ./full-diagnosis.sh - полная диагностика"

# Сохраняем PM2 конфигурацию
pm2 save
pm2 startup