"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const WebSocketServer_1 = require("./server/WebSocketServer");
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
const server = new WebSocketServer_1.WebSocketServer(PORT);
console.log(`🚀 WebSocket сервер запущен на порту ${PORT}`);
process.on('SIGTERM', () => {
    console.log('SIGTERM получен, закрываем сервер...');
    server.закрыть();
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('SIGINT получен, закрываем сервер...');
    server.закрыть();
    process.exit(0);
});
//# sourceMappingURL=index.js.map