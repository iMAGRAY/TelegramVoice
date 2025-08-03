#!/bin/bash
# Настройка systemd сервиса для WebSocket сервера

echo "⚙️ НАСТРОЙКА SYSTEMD СЕРВИСА"
echo "============================"

# Создаем systemd сервис для signaling-server
cat > /etc/systemd/system/telegramvoice-ws.service << EOF
[Unit]
Description=TelegramVoice WebSocket Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/TelegramVoice/signaling-server
ExecStart=/root/TelegramVoice/signaling-server/target/release/signaling-server
Restart=always
RestartSec=10
Environment="RUST_LOG=info"

# Логирование
StandardOutput=append:/root/TelegramVoice/logs/systemd-ws.log
StandardError=append:/root/TelegramVoice/logs/systemd-ws-error.log

[Install]
WantedBy=multi-user.target
EOF

# Создаем резервный systemd сервис для Node.js
cat > /etc/systemd/system/telegramvoice-backup-ws.service << EOF
[Unit]
Description=TelegramVoice Backup WebSocket Server (Node.js)
After=network.target
Conflicts=telegramvoice-ws.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/TelegramVoice
ExecStart=/usr/bin/node /root/TelegramVoice/backup-ws-server.js
Restart=always
RestartSec=10

# Логирование
StandardOutput=append:/root/TelegramVoice/logs/systemd-backup-ws.log
StandardError=append:/root/TelegramVoice/logs/systemd-backup-ws-error.log

[Install]
WantedBy=multi-user.target
EOF

# Перезагружаем systemd
systemctl daemon-reload

echo "Сервисы созданы:"
echo "- telegramvoice-ws.service (основной Rust сервер)"
echo "- telegramvoice-backup-ws.service (резервный Node.js)"

# Функция запуска через systemd
start_with_systemd() {
    echo
    echo "Запуск через systemd..."
    
    # Останавливаем все
    systemctl stop telegramvoice-ws telegramvoice-backup-ws 2>/dev/null || true
    
    # Пробуем основной сервис
    if [ -f "/root/TelegramVoice/signaling-server/target/release/signaling-server" ]; then
        echo "Запускаем основной сервис..."
        systemctl start telegramvoice-ws
        sleep 3
        
        if systemctl is-active --quiet telegramvoice-ws; then
            echo "✅ Основной сервис запущен"
            systemctl enable telegramvoice-ws
            return 0
        else
            echo "❌ Основной сервис не запустился"
            systemctl status telegramvoice-ws --no-pager | tail -10
        fi
    fi
    
    # Запускаем резервный
    echo "Запускаем резервный сервис..."
    systemctl start telegramvoice-backup-ws
    sleep 3
    
    if systemctl is-active --quiet telegramvoice-backup-ws; then
        echo "✅ Резервный сервис запущен"
        systemctl enable telegramvoice-backup-ws
        return 0
    else
        echo "❌ Резервный сервис не запустился"
        systemctl status telegramvoice-backup-ws --no-pager | tail -10
        return 1
    fi
}

# Запускаем
start_with_systemd

# Проверка
echo
echo "Проверка состояния:"
systemctl status telegramvoice-ws --no-pager 2>/dev/null | head -10 || true
systemctl status telegramvoice-backup-ws --no-pager 2>/dev/null | head -10 || true

echo
echo "Команды управления:"
echo "  systemctl start telegramvoice-ws     - запустить основной"
echo "  systemctl start telegramvoice-backup-ws - запустить резервный"
echo "  systemctl status telegramvoice-ws    - статус основного"
echo "  systemctl restart telegramvoice-ws   - перезапустить"
echo "  journalctl -u telegramvoice-ws -f   - логи в реальном времени"