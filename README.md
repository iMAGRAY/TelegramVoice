# 🎤 Telegram Mini App для голосового общения

Полноценное Telegram Mini App на TypeScript + Next.js с WebRTC для голосового общения в реальном времени между несколькими участниками.

## 🚀 Быстрый старт

### Настройка локальной разработки
```bash
# Клонирование репозитория
git clone https://github.com/iMAGRAY/TelegramVoice.git
cd TelegramVoice

# Настройка окружения
cp .env.example .env
# Отредактируйте .env с вашими данными

# Инициализация проекта
./dev.sh
```

### Локальный запуск
```bash
# Frontend
cd mini-app
npm run dev

# WebSocket сервер  
cd websocket-server
npm run dev
# или для тестирования с виртуальными пользователями:
npm test
```

## 🔧 Настройка окружения

### .env файл
Создайте `.env` файл из `.env.example` и заполните:
```bash
# SSH данные для продакшен сервера
SERVER_HOST=your_server_ip
SERVER_USER=your_ssh_user  
SERVER_PASSWORD=your_ssh_password

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token

# WebSocket URL
NEXT_PUBLIC_WEBSOCKET_URL=ws://your_server:8080
```

## 📦 Развертывание

### Автоматическое развертывание
```bash
# С использованием .env данных
./auto-deploy.sh

# Или на сервере
./deploy.sh
```

### CI/CD Pipeline
- **Push в main** → автоматическая сборка и развертывание
- **Pull Request** → проверки качества кода
- **Pre-commit хуки** → локальная проверка сборки

## 🏗️ Архитектура

### Frontend (Next.js Mini App)
- **WebRTC** - P2P голосовые соединения
- **WebSocket** - сигналинг сервер
- **Telegram Web App SDK** - интеграция с Telegram
- **React hooks** - управление состоянием

### Backend (Next.js WebSocket Server)  
- **WebSocket сервер** - координация участников
- **Сигналинг** - обмен WebRTC данными
- **Управление комнатами** - создание, присоединение, выход
- **TypeScript** - полная типобезопасность

## 🛠️ Технологии
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, WebRTC
- **Backend**: Next.js, TypeScript, WebSocket (ws), Node.js
- **DevOps**: GitHub Actions, PM2, Docker
- **Telegram**: Web App SDK, Bot API

## 📋 Workflow разработки

### КРИТИЧЕСКОЕ ПРАВИЛО: Локально → Git → Сервер
1. **Локальная разработка** - все изменения делаются локально
2. **Git коммит и push** - с автоматической проверкой сборки  
3. **Автоматическое развертывание** - на продакшен сервере

### Запрещено:
- ❌ Редактировать файлы напрямую на сервере
- ❌ Копировать файлы с сервера для разработки
- ❌ Hotfix-ы на продакшене без Git

## 🔐 Безопасность

**Приватный репозиторий** - код и учетные данные защищены

**Переменные окружения:**
- `.env` файл не коммитится в Git
- Секреты хранятся в GitHub Secrets
- SSH данные только в .env

## 📚 Документация

- **[CLAUDE.md](CLAUDE.md)** - правила разработки и workflow
- **[DEPLOY_INSTRUCTIONS.md](DEPLOY_INSTRUCTIONS.md)** - подробные инструкции развертывания
- **[GITHUB_SECRETS.md](GITHUB_SECRETS.md)** - настройка GitHub Secrets
- **[MAKE_PRIVATE_REPO.md](MAKE_PRIVATE_REPO.md)** - как сделать репозиторий приватным

## 🎯 Функциональность

1. **Голосовые комнаты** - создание и присоединение к комнатам
2. **WebRTC аудио** - прямые P2P соединения  
3. **Управление микрофоном** - включение/выключение микрофона
4. **Индикация речи** - показ говорящих участников
5. **Приватные комнаты** - комнаты с паролем
6. **Управление громкостью** - регулировка звука
7. **Telegram интеграция** - авторизация, уведомления, вибрация

## 🤝 Разработка

Весь код и комментарии на русском языке. 
TypeScript для типобезопасности.
Оптимизация для мобильных устройств.