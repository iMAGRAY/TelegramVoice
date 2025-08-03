#!/bin/bash
# Полная диагностика проекта TelegramVoice

echo "🔍 ПОЛНАЯ ДИАГНОСТИКА ПРОЕКТА TELEGRAMVOICE"
echo "=========================================="
echo

# 1. Проверка окружения
echo "📋 1. ПРОВЕРКА ОКРУЖЕНИЯ"
echo "------------------------"
echo "Текущий пользователь: $(whoami)"
echo "Текущая директория: $(pwd)"
echo "Node.js версия: $(node --version 2>/dev/null || echo 'НЕ УСТАНОВЛЕН')"
echo "NPM версия: $(npm --version 2>/dev/null || echo 'НЕ УСТАНОВЛЕН')"
echo "Rust версия: $(rustc --version 2>/dev/null || echo 'НЕ УСТАНОВЛЕН')"
echo "PM2 версия: $(pm2 --version 2>/dev/null || echo 'НЕ УСТАНОВЛЕН')"
echo

# 2. Проверка структуры проекта
echo "📁 2. ПРОВЕРКА СТРУКТУРЫ ПРОЕКТА"
echo "--------------------------------"
if [ -d "/root/TelegramVoice" ]; then
    echo "✅ Директория проекта существует"
    cd /root/TelegramVoice
    
    # Проверка основных директорий
    for dir in "mini-app" "signaling-server" "logs"; do
        if [ -d "$dir" ]; then
            echo "✅ Директория $dir существует"
        else
            echo "❌ Директория $dir НЕ НАЙДЕНА"
        fi
    done
    
    # Проверка критических файлов
    echo
    echo "Проверка файлов:"
    if [ -f "signaling-server/target/release/signaling-server" ]; then
        echo "✅ Бинарный файл signaling-server существует"
        ls -la signaling-server/target/release/signaling-server
    else
        echo "❌ Бинарный файл signaling-server НЕ НАЙДЕН"
    fi
    
    if [ -d "mini-app/out" ]; then
        echo "✅ Директория сборки Next.js существует"
        echo "   Количество файлов: $(find mini-app/out -type f | wc -l)"
    else
        echo "❌ Директория сборки Next.js НЕ НАЙДЕНА"
    fi
else
    echo "❌ Директория проекта /root/TelegramVoice НЕ НАЙДЕНА!"
    exit 1
fi
echo

# 3. Проверка процессов PM2
echo "🚀 3. ПРОВЕРКА ПРОЦЕССОВ PM2"
echo "----------------------------"
pm2 list
echo

# Детальная информация о процессах
echo "Детали процессов:"
pm2 describe signaling-server 2>/dev/null || echo "signaling-server не найден в PM2"
echo "---"
pm2 describe frontend 2>/dev/null || echo "frontend не найден в PM2"
echo

# 4. Проверка портов
echo "🌐 4. ПРОВЕРКА ПОРТОВ"
echo "--------------------"
echo "Проверка порта 8080 (WebSocket):"
if lsof -i:8080 2>/dev/null; then
    echo "✅ Порт 8080 используется"
    lsof -i:8080
else
    echo "❌ Порт 8080 СВОБОДЕН - WebSocket сервер не запущен!"
fi

echo
echo "Проверка порта 3000 (HTTP):"
if lsof -i:3000 2>/dev/null; then
    echo "✅ Порт 3000 используется"
    lsof -i:3000
else
    echo "❌ Порт 3000 СВОБОДЕН - HTTP сервер не запущен!"
fi
echo

# 5. Проверка логов
echo "📝 5. ПРОВЕРКА ЛОГОВ"
echo "-------------------"
echo "Последние строки логов PM2:"

if [ -d "/root/.pm2/logs" ]; then
    echo
    echo "=== Логи signaling-server ==="
    tail -n 20 /root/.pm2/logs/signaling-server-error.log 2>/dev/null || echo "Лог ошибок не найден"
    echo
    tail -n 20 /root/.pm2/logs/signaling-server-out.log 2>/dev/null || echo "Лог вывода не найден"
    
    echo
    echo "=== Логи frontend ==="
    tail -n 20 /root/.pm2/logs/frontend-error.log 2>/dev/null || echo "Лог ошибок не найден"
    echo
    tail -n 20 /root/.pm2/logs/frontend-out.log 2>/dev/null || echo "Лог вывода не найден"
else
    echo "❌ Директория логов PM2 не найдена"
fi
echo

# 6. Проверка разрешений
echo "🔐 6. ПРОВЕРКА РАЗРЕШЕНИЙ"
echo "------------------------"
if [ -f "/root/TelegramVoice/signaling-server/target/release/signaling-server" ]; then
    ls -la /root/TelegramVoice/signaling-server/target/release/signaling-server
    if [ -x "/root/TelegramVoice/signaling-server/target/release/signaling-server" ]; then
        echo "✅ Файл имеет права на выполнение"
    else
        echo "❌ Файл НЕ имеет прав на выполнение"
    fi
fi
echo

# 7. Проверка конфигурации
echo "⚙️  7. ПРОВЕРКА КОНФИГУРАЦИИ"
echo "---------------------------"
if [ -f "/root/TelegramVoice/ecosystem.config.js" ]; then
    echo "✅ ecosystem.config.js найден"
    echo "Содержимое:"
    cat /root/TelegramVoice/ecosystem.config.js
else
    echo "❌ ecosystem.config.js НЕ НАЙДЕН"
fi
echo

# 8. Тест запуска signaling-server напрямую
echo "🧪 8. ТЕСТ ЗАПУСКА SIGNALING-SERVER"
echo "-----------------------------------"
echo "Попытка запустить signaling-server напрямую на 5 секунд..."
if [ -f "/root/TelegramVoice/signaling-server/target/release/signaling-server" ]; then
    cd /root/TelegramVoice/signaling-server
    timeout 5 RUST_LOG=debug ./target/release/signaling-server 2>&1 | head -20
    echo
    echo "Тест завершен"
else
    echo "❌ Бинарный файл не найден для теста"
fi
echo

# 9. Проверка зависимостей
echo "📦 9. ПРОВЕРКА ЗАВИСИМОСТЕЙ"
echo "---------------------------"
echo "Проверка serve:"
if command -v serve &> /dev/null; then
    echo "✅ serve установлен: $(which serve)"
else
    echo "❌ serve НЕ УСТАНОВЛЕН"
fi

echo
echo "Проверка глобальных npm пакетов:"
npm list -g --depth=0 2>/dev/null || echo "Не удалось получить список"
echo

# 10. Сетевая диагностика
echo "🌐 10. СЕТЕВАЯ ДИАГНОСТИКА"
echo "--------------------------"
echo "Открытые порты:"
netstat -tlnp | grep -E "(8080|3000)" || echo "Порты 8080 и 3000 не найдены"

echo
echo "Firewall статус:"
if command -v ufw &> /dev/null; then
    ufw status | grep -E "(8080|3000)" || echo "Правила для портов не найдены"
else
    echo "UFW не установлен"
fi

if command -v iptables &> /dev/null; then
    echo
    echo "IPTables правила для портов:"
    iptables -L -n | grep -E "(8080|3000)" || echo "Правила не найдены"
fi
echo

# Итоговая оценка
echo "📊 ИТОГОВАЯ ОЦЕНКА"
echo "=================="
echo
PROBLEMS=0

# Проверяем критические проблемы
if ! lsof -i:8080 &>/dev/null; then
    echo "❌ КРИТИЧНО: WebSocket сервер не запущен на порту 8080"
    ((PROBLEMS++))
fi

if ! lsof -i:3000 &>/dev/null; then
    echo "❌ КРИТИЧНО: HTTP сервер не запущен на порту 3000"
    ((PROBLEMS++))
fi

if [ ! -f "/root/TelegramVoice/signaling-server/target/release/signaling-server" ]; then
    echo "❌ КРИТИЧНО: Бинарный файл signaling-server отсутствует"
    ((PROBLEMS++))
fi

if [ ! -d "/root/TelegramVoice/mini-app/out" ]; then
    echo "❌ КРИТИЧНО: Сборка Next.js отсутствует"
    ((PROBLEMS++))
fi

if [ $PROBLEMS -eq 0 ]; then
    echo "✅ Критических проблем не обнаружено"
else
    echo
    echo "🚨 Обнаружено критических проблем: $PROBLEMS"
    echo
    echo "РЕКОМЕНДАЦИИ:"
    echo "1. Запустите ./fix-websocket.sh для исправления проблем"
    echo "2. Проверьте логи PM2: pm2 logs"
    echo "3. Пересоберите проект: ./deploy.sh"
fi