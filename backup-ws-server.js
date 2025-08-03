#!/usr/bin/env node
// Запасной WebSocket сервер на Node.js

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

// Создаем HTTP сервер для health check
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Создаем WebSocket сервер
const wss = new WebSocket.Server({ server });

// Хранилище подключений
const connections = new Map();
const rooms = new Map();

console.log(`[Backup WS] Запуск резервного WebSocket сервера на порту ${PORT}...`);

wss.on('connection', (ws, req) => {
  const clientId = generateId();
  console.log(`[Backup WS] Новое подключение: ${clientId}`);
  
  connections.set(clientId, {
    ws,
    user: null,
    room: null
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`[Backup WS] Сообщение от ${clientId}:`, message.тип);
      
      handleMessage(clientId, message);
    } catch (error) {
      console.error(`[Backup WS] Ошибка обработки сообщения:`, error);
    }
  });

  ws.on('close', () => {
    console.log(`[Backup WS] Отключение: ${clientId}`);
    handleDisconnect(clientId);
  });

  ws.on('error', (error) => {
    console.error(`[Backup WS] Ошибка соединения ${clientId}:`, error);
  });
});

function handleMessage(clientId, message) {
  const connection = connections.get(clientId);
  if (!connection) return;

  switch (message.тип) {
    case 'присоединиться':
      connection.user = message.пользователь;
      console.log(`[Backup WS] Пользователь ${message.пользователь.имя} присоединился`);
      
      // Отправляем подтверждение
      sendToClient(clientId, {
        тип: 'пользователи-обновлены',
        пользователи: Array.from(connections.values())
          .filter(c => c.user)
          .map(c => c.user)
      });
      break;

    case 'присоединиться-к-комнате':
      const roomId = message.комната_id;
      connection.room = roomId;
      
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      rooms.get(roomId).add(clientId);
      
      console.log(`[Backup WS] ${connection.user?.имя} присоединился к комнате ${roomId}`);
      
      // Уведомляем всех в комнате
      broadcastToRoom(roomId, {
        тип: 'участники-комнаты-обновлены',
        комната_id: roomId,
        участники: getRoomParticipants(roomId)
      });
      break;

    case 'webrtc-signal':
      // Пересылаем WebRTC сигнал
      const targetId = findClientByUserId(message.к);
      if (targetId) {
        sendToClient(targetId, {
          тип: 'webrtc-signal',
          от: message.от,
          к: message.к,
          комната: message.комната,
          данные: message.данные
        });
        console.log(`[Backup WS] WebRTC сигнал от ${message.от} к ${message.к}`);
      }
      break;

    case 'микрофон-переключен':
      if (connection.user) {
        connection.user.микрофон_включен = message.включен;
        broadcastToRoom(connection.room, {
          тип: 'микрофон-переключен',
          пользователь_id: message.пользователь_id,
          комната_id: message.комната_id,
          включен: message.включен
        });
      }
      break;

    default:
      console.log(`[Backup WS] Неизвестный тип сообщения: ${message.тип}`);
  }
}

function handleDisconnect(clientId) {
  const connection = connections.get(clientId);
  if (!connection) return;

  // Удаляем из комнаты
  if (connection.room && rooms.has(connection.room)) {
    rooms.get(connection.room).delete(clientId);
    
    // Уведомляем остальных
    broadcastToRoom(connection.room, {
      тип: 'участники-комнаты-обновлены',
      комната_id: connection.room,
      участники: getRoomParticipants(connection.room)
    });
  }

  connections.delete(clientId);
}

function sendToClient(clientId, message) {
  const connection = connections.get(clientId);
  if (connection && connection.ws.readyState === WebSocket.OPEN) {
    connection.ws.send(JSON.stringify(message));
  }
}

function broadcastToRoom(roomId, message, excludeId = null) {
  if (!rooms.has(roomId)) return;
  
  rooms.get(roomId).forEach(clientId => {
    if (clientId !== excludeId) {
      sendToClient(clientId, message);
    }
  });
}

function getRoomParticipants(roomId) {
  if (!rooms.has(roomId)) return [];
  
  return Array.from(rooms.get(roomId))
    .map(clientId => connections.get(clientId)?.user)
    .filter(user => user != null);
}

function findClientByUserId(userId) {
  for (const [clientId, connection] of connections) {
    if (connection.user && connection.user.id === userId) {
      return clientId;
    }
  }
  return null;
}

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Запуск сервера
server.listen(PORT, () => {
  console.log(`[Backup WS] Сервер запущен на порту ${PORT}`);
  console.log(`[Backup WS] WebSocket: ws://localhost:${PORT}`);
  console.log(`[Backup WS] Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Backup WS] Получен SIGTERM, закрываем соединения...');
  wss.clients.forEach(client => {
    client.close();
  });
  server.close(() => {
    console.log('[Backup WS] Сервер остановлен');
    process.exit(0);
  });
});