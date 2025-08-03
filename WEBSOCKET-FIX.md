# WebSocket Server Fix Documentation

## Проблема
WebSocket сервер не запускается во время GitHub Actions deployment, показывая ошибку "❌ WS недоступен".

## Решение
Создан набор скриптов с каскадной системой запуска WebSocket сервера.

### Главный скрипт: ultimate-ws-fix.sh
Пробует 5 методов запуска последовательно:
1. Прямой запуск Rust сервера через nohup
2. PM2 с Rust сервером
3. Systemd сервис
4. Node.js резервный сервер через PM2
5. Прямой запуск Node.js через nohup

### Резервные решения
- `backup-ws-server.js` - полноценный WebSocket сервер на Node.js
- `emergency-fix.sh` - агрессивная очистка и перезапуск
- `setup-systemd.sh` - создание systemd сервисов

### GitHub Actions интеграция
Workflow автоматически:
1. Запускает `ultimate-ws-fix.sh` при деплое
2. Проверяет доступность WebSocket
3. При ошибке запускает повторное исправление
4. Включает диагностику через `quick-debug.sh`

## Команды для диагностики

### На сервере
```bash
# Проверить статус
./diagnose-websocket.sh

# Быстрая диагностика
./quick-debug.sh

# Запустить вручную
./ultimate-ws-fix.sh
```

### Проверка портов
```bash
# Кто слушает порт 8080
lsof -i:8080

# Все сетевые соединения
netstat -tlnp | grep 8080
```

### PM2 команды
```bash
pm2 list
pm2 logs signaling-server
pm2 logs backup-ws
```

### Systemd команды
```bash
systemctl status telegramvoice-ws
systemctl status telegramvoice-backup-ws
journalctl -u telegramvoice-ws -f
```

## Логи
Все логи сохраняются в `/root/TelegramVoice/logs/`:
- `direct-rust.log` - прямой запуск Rust
- `pm2-rust.log` - PM2 с Rust
- `pm2-backup.log` - PM2 с Node.js
- `direct-nodejs.log` - прямой запуск Node.js
- `systemd-ws.log` - systemd сервис

## Возможные причины проблем
1. Порт 8080 занят другим процессом
2. Недостаточно памяти для Rust сервера
3. Отсутствует бинарный файл после сборки
4. Проблемы с правами доступа
5. Конфликт с другими PM2 процессами

## Экстренное восстановление
Если ничего не помогает:
```bash
cd /root/TelegramVoice
./emergency-fix.sh
```

Это убьет ВСЕ процессы, пересоберет проект и запустит заново.