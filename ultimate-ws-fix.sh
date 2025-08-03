#!/bin/bash
# Финальное решение для запуска WebSocket сервера
# Использует все возможные методы последовательно

echo "🚀 ULTIMATE WEBSOCKET FIX"
echo "========================"
echo "Время: $(date)"
echo

# Функция проверки порта
check_port() {
    timeout 2 bash -c "cat < /dev/tcp/localhost/8080" &>/dev/null
    return $?
}

# Функция очистки
cleanup() {
    echo "🧹 Очистка старых процессов..."
    
    # PM2 - удаляем ВСЕ процессы
    pm2 delete all 2>/dev/null || true
    pm2 kill 2>/dev/null || true
    
    # Systemd
    systemctl stop telegramvoice-ws 2>/dev/null || true
    systemctl stop telegramvoice-backup-ws 2>/dev/null || true
    
    # Процессы по PID файлам
    [ -f /tmp/ws.pid ] && kill -9 $(cat /tmp/ws.pid) 2>/dev/null || true
    [ -f /tmp/backup-ws.pid ] && kill -9 $(cat /tmp/backup-ws.pid) 2>/dev/null || true
    
    # АГРЕССИВНАЯ очистка порта 8080
    echo "Очистка порта 8080..."
    # lsof
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    sleep 1
    # fuser
    fuser -k 8080/tcp 2>/dev/null || true
    sleep 1
    # ss вместо netstat
    ss -lptn 'sport = :8080' | grep -oP '(?<=pid=)\d+' | xargs kill -9 2>/dev/null || true
    sleep 1
    # Убиваем все процессы signaling-server и node
    pkill -9 -f signaling-server 2>/dev/null || true
    pkill -9 -f "node.*backup-ws-server" 2>/dev/null || true
    pkill -9 -f "node.*8080" 2>/dev/null || true
    
    sleep 3
}

# Создаем директорию для логов
mkdir -p /root/TelegramVoice/logs

# 1. МЕТОД: Прямой запуск Rust сервера
try_direct_rust() {
    echo "1️⃣ Попытка: прямой запуск Rust сервера..."
    
    if [ -f "/root/TelegramVoice/signaling-server/target/release/signaling-server" ]; then
        cd /root/TelegramVoice/signaling-server
        export RUST_LOG=info
        nohup ./target/release/signaling-server > /root/TelegramVoice/logs/direct-rust.log 2>&1 &
        echo $! > /tmp/ws.pid
        sleep 3
        
        if check_port; then
            echo "✅ Rust сервер запущен через nohup!"
            return 0
        else
            echo "❌ Rust сервер не запустился"
            cat /root/TelegramVoice/logs/direct-rust.log | tail -20
        fi
    else
        echo "❌ Бинарный файл Rust не найден"
    fi
    return 1
}

# 2. МЕТОД: PM2 с Rust
try_pm2_rust() {
    echo "2️⃣ Попытка: PM2 с Rust сервером..."
    
    cd /root/TelegramVoice
    cat > ws-runner.sh << 'EOF'
#!/bin/bash
cd /root/TelegramVoice/signaling-server
export RUST_LOG=info
exec ./target/release/signaling-server
EOF
    chmod +x ws-runner.sh
    
    pm2 start ws-runner.sh --name signaling-server --log /root/TelegramVoice/logs/pm2-rust.log
    sleep 3
    
    if check_port; then
        echo "✅ Rust сервер запущен через PM2!"
        pm2 save
        return 0
    else
        echo "❌ PM2 не смог запустить Rust сервер"
        pm2 logs signaling-server --lines 20 --nostream
    fi
    return 1
}

# 3. МЕТОД: Systemd сервис
try_systemd() {
    echo "3️⃣ Попытка: Systemd сервис..."
    
    # Создаем сервис если не существует
    if [ ! -f /etc/systemd/system/telegramvoice-ws.service ]; then
        cd /root/TelegramVoice
        chmod +x setup-systemd.sh
        ./setup-systemd.sh
    fi
    
    systemctl start telegramvoice-ws
    sleep 3
    
    if check_port; then
        echo "✅ Rust сервер запущен через systemd!"
        systemctl enable telegramvoice-ws
        return 0
    else
        echo "❌ Systemd не смог запустить Rust сервер"
        systemctl status telegramvoice-ws --no-pager | tail -20
    fi
    return 1
}

# 4. МЕТОД: Node.js резервный сервер через PM2
try_nodejs_backup() {
    echo "4️⃣ Попытка: Node.js резервный сервер..."
    
    cd /root/TelegramVoice
    
    # Установка зависимостей
    if [ ! -d "node_modules/ws" ]; then
        echo "Установка ws модуля..."
        npm install ws
    fi
    
    # Проверяем наличие backup-ws-server.js
    if [ ! -f "backup-ws-server.js" ]; then
        echo "❌ backup-ws-server.js не найден!"
        return 1
    fi
    
    pm2 start backup-ws-server.js --name backup-ws --log /root/TelegramVoice/logs/pm2-backup.log
    sleep 3
    
    if check_port; then
        echo "✅ Node.js резервный сервер запущен!"
        pm2 save
        return 0
    else
        echo "❌ Node.js сервер не запустился"
        pm2 logs backup-ws --lines 20 --nostream
    fi
    return 1
}

# 5. МЕТОД: Прямой запуск Node.js
try_direct_nodejs() {
    echo "5️⃣ Попытка: прямой запуск Node.js сервера..."
    
    cd /root/TelegramVoice
    nohup node backup-ws-server.js > /root/TelegramVoice/logs/direct-nodejs.log 2>&1 &
    echo $! > /tmp/backup-ws.pid
    sleep 3
    
    if check_port; then
        echo "✅ Node.js сервер запущен через nohup!"
        return 0
    else
        echo "❌ Node.js сервер не запустился"
        cat /root/TelegramVoice/logs/direct-nodejs.log | tail -20
    fi
    return 1
}

# ГЛАВНАЯ ЛОГИКА
echo "🔍 Текущее состояние портов:"
ss -tlnp | grep 8080 || echo "Порт 8080 свободен"
echo
echo "Процессы на порту 8080:"
lsof -i:8080 2>/dev/null || echo "Никто не слушает порт 8080"
echo

# Очистка
cleanup

# Пробуем все методы по порядку
if try_direct_rust; then
    echo "🎉 Успех с методом 1!"
elif try_pm2_rust; then
    echo "🎉 Успех с методом 2!"
elif try_systemd; then
    echo "🎉 Успех с методом 3!"
elif try_nodejs_backup; then
    echo "🎉 Успех с методом 4!"
elif try_direct_nodejs; then
    echo "🎉 Успех с методом 5!"
else
    echo "❌ ВСЕ МЕТОДЫ НЕ СРАБОТАЛИ!"
    echo
    echo "📋 Диагностическая информация:"
    echo "================================"
    
    # Проверка файлов
    echo "Файлы:"
    ls -la /root/TelegramVoice/signaling-server/target/release/signaling-server 2>/dev/null || echo "- Rust бинарник не найден"
    ls -la /root/TelegramVoice/backup-ws-server.js 2>/dev/null || echo "- Node.js backup не найден"
    
    # Проверка портов
    echo
    echo "Порты:"
    ss -tlnp | grep 8080 || echo "- Порт 8080 никто не слушает (ss)"
    lsof -i:8080 2>/dev/null || echo "- Порт 8080 никто не слушает (lsof)"
    
    # PM2 статус
    echo
    echo "PM2:"
    pm2 list
    
    exit 1
fi

# Финальная проверка
echo
echo "📊 ФИНАЛЬНЫЙ СТАТУС:"
echo "==================="

# Проверка порта
if check_port; then
    echo "✅ WebSocket сервер доступен на порту 8080"
    
    # Кто слушает порт
    echo
    echo "Процесс на порту 8080:"
    lsof -i:8080
    
    # Статус PM2
    echo
    echo "PM2 процессы:"
    pm2 list
    
    # Статус systemd
    echo
    echo "Systemd сервисы:"
    systemctl is-active telegramvoice-ws 2>/dev/null && echo "telegramvoice-ws: active" || echo "telegramvoice-ws: inactive"
    systemctl is-active telegramvoice-backup-ws 2>/dev/null && echo "telegramvoice-backup-ws: active" || echo "telegramvoice-backup-ws: inactive"
else
    echo "❌ WebSocket сервер НЕ ДОСТУПЕН!"
    exit 1
fi

echo
echo "🎯 WebSocket сервер успешно запущен!"