// Умный выбор WebSocket URL в зависимости от протокола страницы

function getWebSocketURL() {
    // Получаем текущий протокол страницы
    const isHTTPS = window.location.protocol === 'https:';
    const hostname = window.location.hostname;
    
    // Если это localhost или IP для разработки
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'ws://localhost:8080';
    }
    
    // Если это IP адрес сервера
    if (hostname === '89.23.115.156') {
        return isHTTPS ? 'wss://hesovoice.online/ws' : 'ws://89.23.115.156:8080';
    }
    
    // Если это домен
    if (hostname === 'hesovoice.online') {
        return isHTTPS ? 'wss://hesovoice.online/ws' : 'ws://hesovoice.online/ws';
    }
    
    // Fallback - автоматический выбор протокола
    const wsProtocol = isHTTPS ? 'wss:' : 'ws:';
    const wsPort = isHTTPS ? '' : ':8080';  // Для HTTPS используем nginx proxy
    
    return `${wsProtocol}//${hostname}${wsPort}/ws`;
}

// Экспорт для использования в React компонентах
export { getWebSocketURL };

// Для прямого использования в браузере
if (typeof window !== 'undefined') {
    window.getWebSocketURL = getWebSocketURL;
    console.log('Smart WebSocket URL:', getWebSocketURL());
}