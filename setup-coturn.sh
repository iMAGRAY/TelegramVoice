#!/bin/bash

# Скрипт установки и настройки Coturn TURN сервера
# Для Ubuntu/Debian серверов

set -e

echo "🚀 Установка Coturn TURN сервера..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Пожалуйста, запустите скрипт с правами root (sudo)${NC}"
    exit 1
fi

# Получение внешнего IP
EXTERNAL_IP=$(curl -s ifconfig.me)
echo -e "${GREEN}Определен внешний IP: $EXTERNAL_IP${NC}"

# Генерация случайного пароля для TURN
TURN_PASSWORD=$(openssl rand -hex 16)
TURN_USERNAME="telegramvoice"

# Установка Coturn
echo "📦 Установка Coturn..."
apt-get update
apt-get install -y coturn

# Включение Coturn как системного сервиса
echo "⚙️ Настройка Coturn как системного сервиса..."
sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/g' /etc/default/coturn

# Создание конфигурации
echo "📝 Создание конфигурации Coturn..."
cat > /etc/turnserver.conf << EOF
# Основные настройки
listening-port=3478
tls-listening-port=5349

# Внешний IP адрес сервера
external-ip=$EXTERNAL_IP

# Интерфейс для прослушивания (все интерфейсы)
listening-ip=0.0.0.0

# Диапазон портов для relay
min-port=49152
max-port=65535

# Учетные данные
user=$TURN_USERNAME:$TURN_PASSWORD

# Realm (домен)
realm=hesovoice.online

# Fingerprint для дополнительной безопасности
fingerprint

# Использование долгосрочных учетных данных
lt-cred-mech

# Запрет multicast peers
no-multicast-peers

# Отключение CLI
no-cli

# Логирование
log-file=/var/log/turnserver.log
verbose

# Ограничения для безопасности
max-bps=1000000
bps-capacity=0
total-quota=100
stale-nonce=600

# SSL/TLS сертификаты (если есть)
# cert=/etc/letsencrypt/live/hesovoice.online/fullchain.pem
# pkey=/etc/letsencrypt/live/hesovoice.online/privkey.pem

# Запрет локальных адресов для безопасности
no-loopback-peers
EOF

# Настройка файрволла
echo "🔥 Настройка файрволла..."
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 5349/tcp
ufw allow 5349/udp
ufw allow 49152:65535/udp

# Создание директории для логов
mkdir -p /var/log
touch /var/log/turnserver.log
chown turnserver:turnserver /var/log/turnserver.log

# Запуск Coturn
echo "🚀 Запуск Coturn..."
systemctl enable coturn
systemctl restart coturn

# Проверка статуса
sleep 2
if systemctl is-active --quiet coturn; then
    echo -e "${GREEN}✅ Coturn успешно установлен и запущен!${NC}"
else
    echo -e "${RED}❌ Ошибка запуска Coturn${NC}"
    systemctl status coturn
    exit 1
fi

# Сохранение учетных данных
echo "💾 Сохранение учетных данных..."
cat > /root/coturn-credentials.txt << EOF
TURN Server Credentials
======================
Server: turn:$EXTERNAL_IP:3478
Username: $TURN_USERNAME
Password: $TURN_PASSWORD

Для использования в приложении добавьте в .env.production:
NEXT_PUBLIC_CUSTOM_STUN_SERVER=stun:$EXTERNAL_IP:3478
NEXT_PUBLIC_CUSTOM_TURN_SERVER=turn:$EXTERNAL_IP:3478
NEXT_PUBLIC_TURN_USERNAME=$TURN_USERNAME
NEXT_PUBLIC_TURN_CREDENTIAL=$TURN_PASSWORD
EOF

echo -e "${GREEN}📋 Учетные данные сохранены в /root/coturn-credentials.txt${NC}"

# Настройка автоматического перезапуска
echo "🔄 Настройка автоматического перезапуска..."
cat > /etc/systemd/system/coturn-monitor.service << EOF
[Unit]
Description=Coturn Monitor
After=network.target

[Service]
Type=simple
ExecStart=/bin/bash -c 'while true; do if ! systemctl is-active --quiet coturn; then systemctl restart coturn; fi; sleep 60; done'
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl enable coturn-monitor
systemctl start coturn-monitor

# Проверка работы TURN сервера
echo "🧪 Проверка работы TURN сервера..."
timeout 5 turnutils_uclient -v -t -T -u $TURN_USERNAME -w $TURN_PASSWORD turn:127.0.0.1:3478 || true

echo -e "${GREEN}
========================================
✅ Установка Coturn завершена!
========================================

Детали подключения:
- STUN: stun:$EXTERNAL_IP:3478
- TURN: turn:$EXTERNAL_IP:3478
- Username: $TURN_USERNAME
- Password: $TURN_PASSWORD

Добавьте эти переменные в файл .env.production вашего приложения:

NEXT_PUBLIC_CUSTOM_STUN_SERVER=stun:$EXTERNAL_IP:3478
NEXT_PUBLIC_CUSTOM_TURN_SERVER=turn:$EXTERNAL_IP:3478
NEXT_PUBLIC_TURN_USERNAME=$TURN_USERNAME
NEXT_PUBLIC_TURN_CREDENTIAL=$TURN_PASSWORD

Логи Coturn: /var/log/turnserver.log
Конфигурация: /etc/turnserver.conf

Команды управления:
- systemctl status coturn    # Статус
- systemctl restart coturn   # Перезапуск
- tail -f /var/log/turnserver.log  # Просмотр логов
${NC}"