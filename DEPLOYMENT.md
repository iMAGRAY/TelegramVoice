# 🚀 Руководство по развертыванию TelegramVoice

## 📋 Требования

- Ubuntu 20.04+ или аналогичный Linux
- Node.js 18+
- Rust 1.70+
- PM2
- nginx
- Git

## 🛠️ Установка зависимостей

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Установка Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Установка PM2 и serve
npm install -g pm2 serve

# Установка nginx
sudo apt install -y nginx

# Установка утилит
sudo apt install -y git curl lsof net-tools
```

## 📥 Клонирование проекта

```bash
cd /root
git clone https://github.com/iMAGRAY/TelegramVoice.git
cd TelegramVoice
```

## 🔧 Первоначальная настройка

### 1. Настройка переменных окружения

```bash
# Создайте файл mini-app/.env.local
cat > mini-app/.env.local << EOF
NEXT_PUBLIC_WEBSOCKET_URL=wss://yourdomain.com/ws
EOF
```

### 2. Сборка проекта

```bash
# Используйте скрипт полной установки
chmod +x fix-all.sh
./fix-all.sh
```

## 🚀 Развертывание

### Автоматическое развертывание (рекомендуется)

```bash
chmod +x deploy.sh
./deploy.sh
```

### Ручное развертывание

```bash
# 1. Обновление кода
git pull origin main

# 2. Сборка frontend
cd mini-app
npm install
npm run build

# 3. Сборка backend
cd ../signaling-server
cargo build --release

# 4. Перезапуск через PM2
cd ..
pm2 restart ecosystem.config.js
```

## 🔍 Диагностика

### Проверка состояния

```bash
# Полная диагностика
./full-diagnosis.sh

# Проверка WebSocket
./diagnose-websocket.sh

# Быстрая проверка
./check-services.sh
```

### Просмотр логов

```bash
# Все логи
pm2 logs

# Логи signaling-server
pm2 logs signaling-server

# Логи frontend
pm2 logs frontend
```

## 🔧 Устранение проблем

### WebSocket сервер не запускается

```bash
# Используйте скрипт исправления
./fix-websocket.sh

# Или полное исправление
./fix-all.sh
```

### Порт занят

```bash
# Найти процесс на порту 8080
lsof -i:8080

# Убить процесс
kill -9 <PID>
```

### PM2 не видит процессы

```bash
# Удалить все процессы
pm2 delete all

# Запустить заново
pm2 start ecosystem.config.js

# Сохранить конфигурацию
pm2 save
pm2 startup
```

## 📊 Мониторинг

### PM2 мониторинг

```bash
# Интерактивный мониторинг
pm2 monit

# Статус процессов
pm2 status

# Информация о процессе
pm2 describe signaling-server
```

### Системный мониторинг

```bash
# Использование CPU и памяти
htop

# Сетевые соединения
netstat -tlnp

# Открытые порты
lsof -i:8080
lsof -i:3000
```

## 🔐 Безопасность

### Настройка firewall

```bash
# Разрешить порты
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 3000/tcp

# Включить firewall
sudo ufw enable
```

### Настройка nginx (опционально)

```bash
# Настроить reverse proxy для WebSocket
chmod +x setup-nginx.sh
./setup-nginx.sh
```

## 📱 Telegram Mini App

### Настройка бота

1. Создайте бота у @BotFather
2. Получите токен бота
3. Настройте Mini App командой `/newapp`
4. Укажите URL вашего приложения

### Обновление URL Mini App

```
/setmenubutton
Выберите вашего бота
Введите текст кнопки: 🎤 Голосовой чат
Введите URL: https://yourdomain.com
```

## 🔄 CI/CD

Проект настроен для автоматического развертывания через GitHub Actions.

### Настройка секретов GitHub

В настройках репозитория добавьте следующие секреты:

- `SERVER_HOST` - IP адрес сервера
- `SERVER_USER` - Пользователь SSH (обычно root)
- `SERVER_PASSWORD` - Пароль SSH
- `SERVER_PORT` - SSH порт (по умолчанию 22)

### Автоматическое развертывание

При push в ветку `main` автоматически запускается развертывание.

## 📝 Дополнительные скрипты

- `check-services.sh` - Быстрая проверка состояния
- `diagnose-websocket.sh` - Диагностика WebSocket
- `fix-websocket.sh` - Исправление проблем с WebSocket
- `fix-all.sh` - Полное исправление всех проблем
- `full-diagnosis.sh` - Подробная диагностика
- `deploy.sh` - Стандартное развертывание

## ⚠️ Важные замечания

1. **Всегда делайте бэкап** перед обновлением
2. **Проверяйте логи** после развертывания
3. **Используйте HTTPS** для продакшена
4. **Настройте мониторинг** для отслеживания проблем

## 🆘 Поддержка

При возникновении проблем:

1. Проверьте логи: `pm2 logs`
2. Запустите диагностику: `./full-diagnosis.sh`
3. Создайте issue на GitHub с описанием проблемы и логами