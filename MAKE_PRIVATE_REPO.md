# Инструкция: Как сделать репозиторий приватным

## Шаги для перевода репозитория в приватный режим

### 1. Перейти в настройки репозитория
1. Откройте репозиторий на GitHub: https://github.com/iMAGRAY/TelegramVoice
2. Нажмите на вкладку **Settings** (в верхней части страницы репозитория)
3. Прокрутите вниз до раздела **Danger Zone** (красная область внизу страницы)

### 2. Изменить видимость репозитория
1. В разделе **Danger Zone** найдите **Change repository visibility**
2. Нажмите **Change visibility**
3. Выберите **Make private**
4. Введите название репозитория для подтверждения: `iMAGRAY/TelegramVoice`
5. Нажмите **I understand, change repository visibility**

### 3. Настроить доступ для CI/CD (если нужно)
После того как репозиторий станет приватным:

#### Настройка GitHub Secrets:
1. **Settings** → **Secrets and variables** → **Actions**
2. Добавьте секреты:
   - `SERVER_HOST` = `89.23.115.156`
   - `SERVER_USER` = `root`  
   - `SERVER_PASSWORD` = `cMoTy7E5,JjLV3`
   - `SERVER_PORT` = `22` (опционально)
   - `SERVER_PROJECT_PATH` = `/root/TelegramVoice` (опционально)

#### Настройка Production Environment:
1. **Settings** → **Environments**
2. Нажмите **New environment**
3. Введите имя: `production`
4. Нажмите **Configure environment**
5. Можно добавить защиту (required reviewers)

## Что изменится после приватизации

### ✅ Преимущества:
- Код будет скрыт от публичного доступа
- Безопасность учетных данных
- Контроль доступа к репозиторию

### ⚠️ Особенности:
- GitHub Actions будут продолжать работать
- Потребуется настройка секретов для CI/CD
- Ограничен доступ для внешних пользователей

## Локальные изменения

После приватизации репозитория:

### 1. Проверьте remote URL
```bash
git remote -v
```

### 2. Если нужно, обновите URL для HTTPS с токеном
```bash
git remote set-url origin https://TOKEN@github.com/iMAGRAY/TelegramVoice.git
```

### 3. Или используйте SSH ключи
```bash
git remote set-url origin git@github.com:iMAGRAY/TelegramVoice.git
```

## Команды для развертывания остаются такими же

```bash
# Локальная разработка
./dev.sh

# Автоматическое развертывание
./auto-deploy.sh

# Или на сервере
./deploy.sh
```

## Безопасность

✅ **Рекомендации после приватизации:**
- Регулярно ротируйте пароли и ключи
- Используйте SSH ключи вместо паролей где возможно
- Настройте 2FA для GitHub аккаунта
- Ограничьте доступ к production environment