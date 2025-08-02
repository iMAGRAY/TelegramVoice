# Настройка GitHub Production Environment

Для корректной работы автоматического развертывания необходимо настроить Production Environment в GitHub.

## Шаги настройки

### 1. Создание Production Environment

1. Перейдите в ваш репозиторий на GitHub
2. Откройте **Settings** → **Environments**
3. Нажмите **New environment**
4. Введите имя: `production`
5. Нажмите **Configure environment**

### 2. Настройка защиты (опционально)

В настройках `production` environment можно добавить:

#### Protection rules:
- **Required reviewers** - кто должен одобрить развертывание
- **Wait timer** - задержка перед развертыванием
- **Deployment branches** - только main ветка

#### Рекомендуемые настройки:
- ✅ **Deployment branches**: Selected branches → `main`
- ⚠️ **Required reviewers**: Добавить себя (для контроля)

### 3. Environment secrets (если нужны дополнительные)

Можно добавить секреты специфичные для production:
- `TELEGRAM_BOT_TOKEN` - для продакшен бота
- `DOMAIN_NAME` - доменное имя

## Проверка настройки

После настройки environment:

1. Сделайте тестовый push в main
2. Перейдите в **Actions** и проверьте workflow
3. Убедитесь что deploy job запускается
4. Проверьте что сервер обновился

## Структура workflow с environment

```yaml
deploy:
  needs: build-and-test
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main'
  environment: production  # ← Использует production environment
  
  steps:
    - name: Deploy
      # ... SSH действия
```

## Мониторинг

В **Actions** → **Environments** можно увидеть:
- История развертываний
- Статус каждого развертывания
- Время выполнения

## Безопасность

✅ **Что защищено:**
- Секреты доступны только в production environment
- Развертывание только из main ветки
- Логи развертывания в GitHub Actions

⚠️ **Рекомендации:**
- Включить required reviewers для критических изменений
- Регулярно проверять логи развертывания
- Мониторить статус сервера после автодеплоя