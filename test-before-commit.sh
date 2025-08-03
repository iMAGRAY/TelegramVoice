#!/bin/bash
# Тестирование перед коммитом

echo "🧪 ТЕСТИРОВАНИЕ ПЕРЕД КОММИТОМ"
echo "==============================="
echo

# 1. Проверка синтаксиса всех bash скриптов
echo "1️⃣ Проверка синтаксиса bash скриптов..."
for script in *.sh; do
    if [ -f "$script" ]; then
        if bash -n "$script"; then
            echo "✅ $script - OK"
        else
            echo "❌ $script - ОШИБКА СИНТАКСИСА"
            exit 1
        fi
    fi
done

# 2. Проверка наличия всех критических файлов
echo
echo "2️⃣ Проверка наличия файлов..."
REQUIRED_FILES=(
    "ultimate-ws-fix.sh"
    "emergency-fix.sh"
    "backup-ws-server.js"
    "simple-ws-start.sh"
    "setup-systemd.sh"
    "diagnose-websocket.sh"
    "quick-debug.sh"
    ".github/workflows/simple-deploy.yml"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file - найден"
    else
        echo "❌ $file - НЕ НАЙДЕН"
        exit 1
    fi
done

# 3. Проверка прав на выполнение
echo
echo "3️⃣ Проверка прав на выполнение..."
for script in *.sh; do
    if [ -f "$script" ]; then
        chmod +x "$script"
        echo "✅ $script - права установлены"
    fi
done

# 4. Проверка сборки фронтенда
echo
echo "4️⃣ Проверка сборки фронтенда..."
cd mini-app
if npm run build; then
    echo "✅ Фронтенд собирается успешно"
else
    echo "❌ Ошибка сборки фронтенда"
    exit 1
fi
cd ..

# 5. Проверка сборки Rust
echo
echo "5️⃣ Проверка сборки Rust сервера..."
cd signaling-server
if cargo check; then
    echo "✅ Rust код валиден"
else
    echo "❌ Ошибка в Rust коде"
    exit 1
fi
cd ..

# 6. Git статус
echo
echo "6️⃣ Git статус:"
git status --short

echo
echo "✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ!"
echo
echo "Теперь можно коммитить:"
echo "  git add ."
echo "  git commit -m 'Fix: Ultimate WebSocket server startup solution'"
echo "  git push origin main"