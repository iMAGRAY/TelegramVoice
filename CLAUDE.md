# Проект: Telegram Mini App для голосового общения

## Описание проекта
Полноценное Telegram Mini App на TypeScript + Next.js с WebRTC для голосового общения в реальном времени между несколькими участниками.

## Структура проекта
- `mini-app/` - фронтенд Next.js приложение (Telegram Mini App)
- `websocket-server/` - WebSocket сервер на Next.js + TypeScript для сигналинга WebRTC
- `src/` - старый Telegram бот (можно удалить)

## Архитектура
### Frontend (Next.js Mini App)
- **WebRTC** - прямые peer-to-peer голосовые соединения между пользователями
- **WebSocket** - сигналинг сервер для координации соединений
- **Telegram Web App SDK** - интеграция с Telegram
- **React hooks** - управление состоянием и WebRTC соединениями

### Backend (Next.js WebSocket Server)
- **WebSocket сервер** - координация участников и комнат
- **Сигналинг** - обмен WebRTC offer/answer/ICE кандидатами
- **Управление комнатами** - создание, присоединение, выход
- **TypeScript** - полная типобезопасность

## Команды для разработки

### Mini App (Frontend)
```bash
cd mini-app
npm install
npm run dev    # Запуск в режиме разработки
npm run build  # Сборка для продакшена
npm run start  # Запуск продакшен версии
```

### WebSocket Server (Backend)
```bash
cd websocket-server
npm install
npm run dev    # Запуск в режиме разработки
npm run build  # Сборка для продакшена
npm start      # Запуск продакшен версии на порту 8080
npm test       # Запуск с автоматическими тестами
```

## Переменные окружения

### Mini App (.env.local)
- `NEXT_PUBLIC_WEBSOCKET_URL` - URL WebSocket сервера (ws://localhost:8080)
- `TELEGRAM_BOT_TOKEN` - токен бота для настройки Mini App

## Функциональность
1. **Голосовые комнаты** - создание и присоединение к комнатам
2. **WebRTC аудио** - прямые peer-to-peer соединения между участниками
3. **Управление микрофоном** - включение/выключение микрофона
4. **Индикация речи** - показ говорящих участников в реальном времени
5. **Приватные комнаты** - комнаты с паролем
6. **Управление громкостью** - регулировка входящего звука
7. **Telegram интеграция** - авторизация через Telegram, вибрация, уведомления

## Настройка Telegram Mini App
1. Создать бота у @BotFather
2. Настроить Mini App командой `/newapp`
3. Указать URL веб-приложения (например, https://yourdomain.com)
4. Настроить Web App в боте

## Технологии
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, WebRTC
- **Backend**: Next.js, TypeScript, WebSocket (ws), Node.js
- **Telegram**: Web App SDK, Bot API

## Workflow разработки и развертывания

### КРИТИЧЕСКОЕ ПРАВИЛО: Локальная разработка → Git → Сервер
**ВСЕ изменения производятся ТОЛЬКО в следующем порядке:**

1. **Локальная разработка**
   - Все изменения делаются в локальной среде
   - Тестирование функций локально
   - Проверка сборки: `npm run build` в обеих папках

2. **Git коммит и push**
   - `git add .`
   - `git commit -m "описание изменений"`
   - `git push origin main`

3. **Обновление на продакшен сервере**
   - SSH подключение к серверу 89.23.115.156
   - `cd /root/TelegramVoice && git pull origin main`
   - Пересборка и перезапуск сервисов
   - Тестирование на продакшене

### ЗАПРЕЩЕНО:
- ❌ Редактировать файлы напрямую на сервере
- ❌ Копировать файлы с сервера на локальную машину для разработки
- ❌ Делать hotfix-ы на продакшене без git

### Команды для развертывания на сервере:
```bash
# Автоматическое развертывание (рекомендуется)
cd /root/TelegramVoice
./deploy.sh

# Или ручное развертывание:
git pull origin main
cd mini-app && npm install && npm run build
cd ../websocket-server && npm install && npm run build
pm2 restart ecosystem.config.js
```

## CI/CD Pipeline

### Автоматизация
- **GitHub Actions** - автоматическая сборка и развертывание
- **Pre-commit хуки** - проверка сборки перед коммитом
- **Pull Request проверки** - качество кода и безопасность

### Настройка CI/CD
1. Запустить `./dev.sh` для настройки pre-commit хуков
2. Настроить GitHub Secrets для автоматического развертывания
3. Push в main автоматически запускает сборку, тестирование и развертывание

### Workflow GitHub Actions
```
Push → Build & Test → Auto Deploy на сервер (только main ветка)
PR → Code Quality Checks + Security Audit
Локальное развертывание → ./auto-deploy.sh (альтернатива)
```

## Правила разработки
- Весь код и комментарии должны быть на русском языке
- В конце каждого задания указывать что НЕ БЫЛО СДЕЛАНО, а не что было сделано
- Использовать TypeScript для типобезопасности
- Обрабатывать ошибки WebRTC и WebSocket соединений
- Оптимизировать для мобильных устройств (основная платформа Telegram)