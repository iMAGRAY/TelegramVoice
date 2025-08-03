# Настройка ICE серверов для WebRTC

## Что такое ICE серверы?

ICE (Interactive Connectivity Establishment) серверы необходимы для установки WebRTC соединений между пользователями, особенно когда они находятся за NAT или файрволлами.

### STUN серверы
STUN (Session Traversal Utilities for NAT) серверы помогают определить публичный IP адрес клиента. Они бесплатны и не требуют много ресурсов.

### TURN серверы
TURN (Traversal Using Relays around NAT) серверы используются как релей для передачи данных, когда прямое P2P соединение невозможно. Они требуют больше ресурсов и обычно платные.

## Текущая конфигурация

По умолчанию приложение использует:

1. **Публичные STUN серверы:**
   - Google STUN серверы (stun.l.google.com:19302)
   - Mozilla STUN сервер
   - Cloudflare STUN сервер

2. **Публичные TURN серверы:**
   - OpenRelay (бесплатные, но с ограничениями)

## Настройка собственных серверов

### 1. Использование Twilio

1. Зарегистрируйтесь на [twilio.com](https://www.twilio.com)
2. Получите учетные данные для Network Traversal Service
3. Добавьте в `.env.production`:

```env
NEXT_PUBLIC_CUSTOM_TURN_SERVER=turn:global.turn.twilio.com:3478?transport=tcp
NEXT_PUBLIC_TURN_USERNAME=your-twilio-username
NEXT_PUBLIC_TURN_CREDENTIAL=your-twilio-credential
```

### 2. Использование Xirsys

1. Зарегистрируйтесь на [xirsys.com](https://xirsys.com)
2. Создайте канал и получите учетные данные
3. Добавьте в `.env.production`:

```env
NEXT_PUBLIC_CUSTOM_STUN_SERVER=stun:fr-turn1.xirsys.com
NEXT_PUBLIC_CUSTOM_TURN_SERVER=turn:fr-turn1.xirsys.com:80?transport=tcp
NEXT_PUBLIC_TURN_USERNAME=your-xirsys-username
NEXT_PUBLIC_TURN_CREDENTIAL=your-xirsys-credential
```

### 3. Развертывание собственного Coturn сервера

#### Установка на Ubuntu/Debian:

```bash
# Установка Coturn
sudo apt-get update
sudo apt-get install coturn

# Включение сервиса
sudo systemctl enable coturn
```

#### Конфигурация `/etc/turnserver.conf`:

```conf
# Основные настройки
listening-port=3478
tls-listening-port=5349

# Внешний IP сервера
external-ip=YOUR_SERVER_IP

# Учетные данные
user=turnuser:turnpassword

# Realm (домен)
realm=yourdomain.com

# Логирование
log-file=/var/log/turnserver.log

# Безопасность
fingerprint
lt-cred-mech
no-multicast-peers
no-cli
```

#### Настройка файрволла:

```bash
# Открыть порты
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49152:65535/udp
```

#### Запуск сервера:

```bash
sudo systemctl start coturn
sudo systemctl status coturn
```

#### Добавление в приложение:

```env
NEXT_PUBLIC_CUSTOM_STUN_SERVER=stun:your-server.com:3478
NEXT_PUBLIC_CUSTOM_TURN_SERVER=turn:your-server.com:3478
NEXT_PUBLIC_TURN_USERNAME=turnuser
NEXT_PUBLIC_TURN_CREDENTIAL=turnpassword
```

## Диагностика

Приложение включает встроенную диагностику ICE серверов:

1. **Автоматическая проверка** - при загрузке приложения
2. **Ручная проверка** - через компонент ICEStatus
3. **Определение типа NAT** - для оптимизации конфигурации

### Типы NAT и их влияние:

- **Full Cone NAT** - лучший для WebRTC, прямые соединения работают хорошо
- **Port Restricted NAT** - хороший для WebRTC, может требовать STUN
- **Симметричный NAT** - сложный для WebRTC, часто требует TURN

## Рекомендации для продакшена

1. **Используйте минимум 2-3 STUN сервера** для надежности
2. **Обязательно настройте TURN серверы** для пользователей за сложными NAT
3. **Мониторьте использование TURN** - это может быть дорого
4. **Используйте географически распределенные серверы** для минимизации задержек

## Оптимизация для мобильных устройств

Для Telegram Mini App особенно важна оптимизация для мобильных сетей:

```typescript
// В useWebRTC.ts используется:
bundlePolicy: 'max-bundle' // Уменьшает количество соединений
rtcpMuxPolicy: 'require' // Уменьшает количество портов
```

## Мониторинг и отладка

### Проверка ICE кандидатов в браузере:

```javascript
// В консоли разработчика
pc = new RTCPeerConnection({iceServers: [{urls: 'stun:stun.l.google.com:19302'}]});
pc.onicecandidate = (e) => console.log('ICE candidate:', e.candidate);
pc.createDataChannel('test');
pc.createOffer().then(o => pc.setLocalDescription(o));
```

### Проверка TURN сервера:

```bash
# Используя turnutils_uclient из пакета coturn
turnutils_uclient -v -t -T -u turnuser -w turnpassword turn:your-server.com:3478
```

## Безопасность

1. **Всегда используйте TLS** для TURN серверов в продакшене
2. **Ограничивайте bandwidth** на TURN сервере
3. **Используйте временные credentials** через REST API
4. **Мониторьте использование** для предотвращения злоупотреблений