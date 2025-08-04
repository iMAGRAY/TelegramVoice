#!/usr/bin/env node

// Простой WebSocket сервер для диагностики
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

// Хранилище пользователей и комнат
const users = new Map(); // connection_id -> user_data
const rooms = new Map(); // room_id -> room_data
const connectionToUser = new Map(); // ws -> user_id

// Предустановленные комнаты
const defaultRooms = [
    { id: 'general', название: 'Общий', участники: [], максимум_участников: 50 },
    { id: 'important', название: 'Комната важных переговоров', участники: [], максимум_участников: 10 },
    { id: 'channel1', название: 'Канал 1', участники: [], максимум_участников: 20 },
    { id: 'channel2', название: 'Канал 2', участники: [], максимум_участников: 20 },
    { id: 'channel3', название: 'Канал 3', участники: [], максимум_участников: 20 }
];

defaultRooms.forEach(room => {
    rooms.set(room.id, room);
});

console.log(`🚀 Simple WebSocket server started on port 8080`);
console.log(`📋 Created ${defaultRooms.length} default rooms`);

function broadcastToRoom(roomId, message, excludeUserId = null) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.участники.forEach(userId => {
        if (userId !== excludeUserId) {
            const user = users.get(userId);
            if (user && user.ws && user.ws.readyState === WebSocket.OPEN) {
                user.ws.send(JSON.stringify(message));
            }
        }
    });
}

function sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

wss.on('connection', function connection(ws) {
    console.log('🔗 New WebSocket connection');
    let currentUserId = null;

    ws.on('message', function incoming(data) {
        try {
            const message = JSON.parse(data.toString());
            console.log('📥 Received:', message.тип, currentUserId ? `from ${currentUserId}` : '(no user)');

            switch (message.тип) {
                case 'присоединиться':
                    const пользователь = message.пользователь;
                    currentUserId = пользователь.id;
                    
                    // Сохраняем пользователя
                    users.set(currentUserId, {
                        ...пользователь,
                        ws: ws,
                        подключен: true
                    });
                    
                    connectionToUser.set(ws, currentUserId);
                    
                    console.log(`👤 User ${пользователь.имя} joined (${currentUserId})`);
                    
                    // Отправляем список комнат
                    const комнаты = Array.from(rooms.values());
                    sendMessage(ws, {
                        тип: 'комнаты-обновлены',
                        комнаты: комнаты
                    });
                    break;

                case 'присоединиться-к-комнате':
                    if (!currentUserId) {
                        sendMessage(ws, {
                            тип: 'ошибка',
                            сообщение: 'Пользователь не зарегистрирован'
                        });
                        return;
                    }

                    const roomId = message.комната_id;
                    const room = rooms.get(roomId);
                    
                    if (!room) {
                        sendMessage(ws, {
                            тип: 'ошибка',
                            сообщение: 'Комната не найдена'
                        });
                        return;
                    }

                    // Добавляем пользователя в комнату
                    if (!room.участники.includes(currentUserId)) {
                        room.участники.push(currentUserId);
                    }

                    // Обновляем пользователя
                    const user = users.get(currentUserId);
                    user.в_комнате = roomId;

                    console.log(`🏠 User ${currentUserId} joined room ${room.название}`);

                    // Подтверждение присоединения
                    sendMessage(ws, {
                        тип: 'присоединился-к-комнате',
                        комната: room,
                        пользователь: user
                    });

                    // Отправляем обновленный список участников всем в комнате
                    const участники = room.участники.map(uid => users.get(uid)).filter(u => u);
                    broadcastToRoom(roomId, {
                        тип: 'участники-комнаты-обновлены',
                        комната_id: roomId,
                        участники: участники
                    });

                    console.log(`👥 Room ${room.название} participants: [${участники.map(u => u.имя).join(', ')}]`);
                    break;

                case 'покинуть-комнату':
                    if (!currentUserId) return;
                    
                    const leaveRoomId = message.комната_id;
                    const leaveRoom = rooms.get(leaveRoomId);
                    
                    if (leaveRoom) {
                        leaveRoom.участники = leaveRoom.участники.filter(uid => uid !== currentUserId);
                        
                        const leaveUser = users.get(currentUserId);
                        leaveUser.в_комнате = null;

                        // Уведомляем остальных участников
                        broadcastToRoom(leaveRoomId, {
                            тип: 'покинул-комнату',
                            комната_id: leaveRoomId,
                            пользователь_id: currentUserId
                        });

                        // Обновляем список участников
                        const remainingParticipants = leaveRoom.участники.map(uid => users.get(uid)).filter(u => u);
                        broadcastToRoom(leaveRoomId, {
                            тип: 'участники-комнаты-обновлены',
                            комната_id: leaveRoomId,
                            участники: remainingParticipants
                        });
                    }
                    break;

                case 'webrtc-signal':
                    // Пересылаем WebRTC сигнал получателю
                    const targetUserId = message.к;
                    const targetUser = users.get(targetUserId);
                    
                    if (targetUser && targetUser.ws) {
                        sendMessage(targetUser.ws, {
                            тип: 'webrtc-signal',
                            от: message.от,
                            к: message.к,
                            комната: message.комната,
                            данные: message.данные
                        });
                        console.log(`🔄 WebRTC signal forwarded from ${message.от} to ${message.к}`);
                    }
                    break;

                default:
                    console.log(`❓ Unknown message type: ${message.тип}`);
                    break;
            }

        } catch (error) {
            console.error('❌ Error processing message:', error);
            sendMessage(ws, {
                тип: 'ошибка',
                сообщение: 'Ошибка обработки сообщения: ' + error.message
            });
        }
    });

    ws.on('close', function close() {
        console.log('🔌 Connection closed');
        
        if (currentUserId) {
            const user = users.get(currentUserId);
            if (user && user.в_комнате) {
                const room = rooms.get(user.в_комнате);
                if (room) {
                    room.участники = room.участники.filter(uid => uid !== currentUserId);
                    
                    // Уведомляем остальных участников
                    broadcastToRoom(user.в_комнате, {
                        тип: 'покинул-комнату',
                        комната_id: user.в_комнате,
                        пользователь_id: currentUserId
                    });

                    // Обновляем список участников
                    const remainingParticipants = room.участники.map(uid => users.get(uid)).filter(u => u);
                    broadcastToRoom(user.в_комнате, {
                        тип: 'участники-комнаты-обновлены',
                        комната_id: user.в_комнате,
                        участники: remainingParticipants
                    });
                }
            }
            
            users.delete(currentUserId);
            connectionToUser.delete(ws);
            console.log(`👋 User ${currentUserId} disconnected`);
        }
    });

    ws.on('error', function error(err) {
        console.error('❌ WebSocket error:', err);
    });
});