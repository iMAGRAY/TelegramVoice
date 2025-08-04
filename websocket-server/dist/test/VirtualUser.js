"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirtualUser = void 0;
const ws_1 = __importDefault(require("ws"));
const uuid_1 = require("uuid");
class VirtualUser {
    constructor(имя) {
        this.ws = null;
        this.currentRoom = null;
        this.messageLog = [];
        this.userId = `user-${(0, uuid_1.v4)()}`;
        this.имя = имя;
    }
    async connect(url) {
        return new Promise((resolve, reject) => {
            this.ws = new ws_1.default(url);
            this.ws.on('open', () => {
                console.log(`✅ ${this.имя} подключился`);
                this.sendJoinMessage();
                resolve();
            });
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.logMessage(message);
                    if (this.onMessageCallback) {
                        this.onMessageCallback(message);
                    }
                    this.handleMessage(message);
                }
                catch (error) {
                    console.error(`❌ ${this.имя}: ошибка парсинга`, error);
                }
            });
            this.ws.on('close', () => {
                console.log(`👋 ${this.имя} отключился`);
                this.ws = null;
            });
            this.ws.on('error', (error) => {
                console.error(`❌ ${this.имя}: ошибка WebSocket`, error);
                reject(error);
            });
        });
    }
    sendJoinMessage() {
        const пользователь = {
            id: this.userId,
            имя: this.имя,
            аватар: '👤',
            подключен: true,
            микрофон_включен: false,
            говорит: false
        };
        this.send({
            тип: 'присоединиться',
            пользователь
        });
    }
    handleMessage(message) {
        switch (message.тип) {
            case 'присоединился-к-комнате':
                this.currentRoom = message.комната.id;
                console.log(`🏠 ${this.имя} присоединился к комнате "${message.комната.название}"`);
                break;
            case 'участники-комнаты-обновлены':
                console.log(`👥 ${this.имя} видит участников: [${message.участники.map((у) => у.имя).join(', ')}]`);
                break;
            case 'комнаты-обновлены':
                console.log(`📋 ${this.имя} получил список комнат: [${message.комнаты.map((к) => к.название).join(', ')}]`);
                break;
        }
    }
    joinRoom(roomId) {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            console.error(`❌ ${this.имя}: не подключен`);
            return;
        }
        this.send({
            тип: 'присоединиться-к-комнате',
            комната_id: roomId,
            пользователь_id: this.userId
        });
    }
    leaveRoom() {
        if (!this.currentRoom)
            return;
        this.send({
            тип: 'покинуть-комнату',
            комната_id: this.currentRoom,
            пользователь_id: this.userId
        });
        this.currentRoom = null;
    }
    toggleMicrophone(enabled) {
        if (!this.currentRoom)
            return;
        this.send({
            тип: 'микрофон-переключен',
            пользователь_id: this.userId,
            комната_id: this.currentRoom,
            включен: enabled
        });
    }
    sendWebRTCSignal(to, data) {
        if (!this.currentRoom)
            return;
        this.send({
            тип: 'webrtc-signal',
            от: this.userId,
            к: to,
            комната: this.currentRoom,
            данные: data
        });
    }
    send(data) {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify(data));
            console.log(`📤 ${this.имя} отправил:`, data.тип);
        }
    }
    logMessage(message) {
        this.messageLog.push({
            время: new Date(),
            тип: message.тип,
            данные: message
        });
    }
    onMessage(callback) {
        this.onMessageCallback = callback;
    }
    getMessageLog() {
        return this.messageLog;
    }
    getLastMessage() {
        const last = this.messageLog[this.messageLog.length - 1];
        return last ? last.данные : null;
    }
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    get name() {
        return this.имя;
    }
    get id() {
        return this.userId;
    }
    get room() {
        return this.currentRoom;
    }
}
exports.VirtualUser = VirtualUser;
//# sourceMappingURL=VirtualUser.js.map