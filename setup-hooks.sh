#!/bin/bash

# Скрипт для настройки Git хуков
# Настраивает pre-commit хук для проверки сборки

echo "🔧 Настройка Git хуков..."

# Создание символической ссылки на pre-commit хук
if [ -f ".githooks/pre-commit" ]; then
    chmod +x .githooks/pre-commit
    
    # Настройка Git для использования кастомной директории хуков
    git config core.hooksPath .githooks
    
    echo "✅ Pre-commit хук настроен!"
    echo "📝 Теперь перед каждым коммитом будет проверяться сборка"
else
    echo "❌ Файл .githooks/pre-commit не найден!"
    exit 1
fi

echo "🎉 Настройка завершена!"