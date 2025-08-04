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
    "websocket-server/package.json"
    "mini-app/package.json"
    "ecosystem.config.js"
    "deploy.sh"
    "dev.sh"
    "monitor.sh"
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

# 5. Проверка сборки WebSocket сервера
echo
echo "5️⃣ Проверка сборки WebSocket сервера..."
cd websocket-server
if npm run build; then
    echo "✅ WebSocket сервер собирается успешно"
else
    echo "❌ Ошибка сборки WebSocket сервера"
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
echo "  git commit -m 'описание изменений'"
echo "  git push origin main"