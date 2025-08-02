#!/bin/bash

# Автоматическое развертывание с использованием .env файла
# Использует переменные из .env для SSH подключения

set -e

# Проверка существования .env файла
if [ ! -f ".env" ]; then
    echo "❌ Файл .env не найден!"
    echo "📋 Скопируйте .env.example в .env и заполните данными"
    exit 1
fi

# Загрузка переменных из .env
export $(grep -v '^#' .env | xargs)

echo "🚀 Автоматическое развертывание на $SERVER_HOST..."

# Проверка обязательных переменных
if [ -z "$SERVER_HOST" ] || [ -z "$SERVER_USER" ] || [ -z "$SERVER_PASSWORD" ]; then
    echo "❌ Не заполнены обязательные переменные в .env:"
    echo "   SERVER_HOST, SERVER_USER, SERVER_PASSWORD"
    exit 1
fi

# Функция для выполнения SSH команд
ssh_exec() {
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" "$1"
}

# Функция для копирования файлов
scp_copy() {
    sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no "$1" "$SERVER_USER@$SERVER_HOST:$2"
}

echo "📡 Подключение к серверу..."

# Проверка подключения
if ! ssh_exec "echo 'Подключение успешно'"; then
    echo "❌ Не удалось подключиться к серверу"
    exit 1
fi

echo "📥 Обновление кода на сервере..."

# Выполнение развертывания
ssh_exec "cd $SERVER_PROJECT_PATH && ./deploy.sh"

echo "✅ Развертывание завершено!"
echo "🌐 Приложение доступно на http://$SERVER_HOST:3000"
echo "📡 WebSocket сервер на ws://$SERVER_HOST:8080"