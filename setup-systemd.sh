#!/bin/bash
# Настройка systemd сервисов для TelegramVoice

echo "⚙️ НАСТРОЙКА SYSTEMD СЕРВИСОВ"
echo "============================="

# Создаем systemd сервис для WebSocket сервера
cat > /etc/systemd/system/telegramvoice-ws.service << EOF
[Unit]
Description=TelegramVoice WebSocket Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/TelegramVoice/websocket-server
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment="NODE_ENV=production"

# Логирование
StandardOutput=append:/root/TelegramVoice/logs/systemd-ws.log
StandardError=append:/root/TelegramVoice/logs/systemd-ws-error.log

[Install]
WantedBy=multi-user.target
EOF

# Создаем systemd сервис для Frontend
cat > /etc/systemd/system/telegramvoice-frontend.service << EOF
[Unit]
Description=TelegramVoice Frontend Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/TelegramVoice/mini-app
ExecStart=/usr/bin/serve -s out -l 3000
Restart=always
RestartSec=10
Environment="NODE_ENV=production"

# Логирование
StandardOutput=append:/root/TelegramVoice/logs/systemd-frontend.log
StandardError=append:/root/TelegramVoice/logs/systemd-frontend-error.log

[Install]
WantedBy=multi-user.target
EOF

# Создаем директории для логов
mkdir -p /root/TelegramVoice/logs

# Перезагружаем systemd
systemctl daemon-reload

echo "✅ Systemd сервисы созданы!"
echo ""
echo "Управление сервисами:"
echo "  systemctl start telegramvoice-ws      - запустить WebSocket сервер"
echo "  systemctl start telegramvoice-frontend - запустить Frontend"
echo "  systemctl enable telegramvoice-ws      - автозапуск WebSocket"
echo "  systemctl enable telegramvoice-frontend - автозапуск Frontend"
echo ""
echo "Рекомендуется использовать PM2 вместо systemd:"
echo "  pm2 start ecosystem.config.js"