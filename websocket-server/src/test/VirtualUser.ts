import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { Пользователь, СообщениеСервера } from '@/types';

export class VirtualUser {
  private ws: WebSocket | null = null;
  private userId: string;
  private имя: string;
  private currentRoom: string | null = null;
  private messageLog: Array<{ время: Date; тип: string; данные: any }> = [];
  private onMessageCallback?: (message: СообщениеСервера) => void;

  constructor(имя: string) {
    this.userId = `user-${uuidv4()}`;
    this.имя = имя;
  }

  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      
      this.ws.on('open', () => {
        console.log(`✅ ${this.имя} подключился`);
        this.sendJoinMessage();
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString()) as СообщениеСервера;
          this.logMessage(message);
          
          if (this.onMessageCallback) {
            this.onMessageCallback(message);
          }

          // Автоматическая обработка некоторых сообщений
          this.handleMessage(message);
        } catch (error) {
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

  private sendJoinMessage() {
    const пользователь: Пользователь = {
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

  private handleMessage(message: СообщениеСервера) {
    switch (message.тип) {
      case 'присоединился-к-комнате':
        this.currentRoom = message.комната.id;
        console.log(`🏠 ${this.имя} присоединился к комнате "${message.комната.название}"`);
        break;
      
      case 'участники-комнаты-обновлены':
        console.log(`👥 ${this.имя} видит участников: [${message.участники.map(у => у.имя).join(', ')}]`);
        break;
      
      case 'комнаты-обновлены':
        console.log(`📋 ${this.имя} получил список комнат: [${message.комнаты.map(к => к.название).join(', ')}]`);
        break;
    }
  }

  joinRoom(roomId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error(`❌ ${this.имя}: не подключен`);
      return;
    }

    this.send({
      тип: 'присоединиться-к-комнате',
      комната_id: roomId,
      пользователь_id: this.userId
    });
  }

  leaveRoom(): void {
    if (!this.currentRoom) return;

    this.send({
      тип: 'покинуть-комнату',
      комната_id: this.currentRoom,
      пользователь_id: this.userId
    });
    this.currentRoom = null;
  }

  toggleMicrophone(enabled: boolean): void {
    if (!this.currentRoom) return;

    this.send({
      тип: 'микрофон-переключен',
      пользователь_id: this.userId,
      комната_id: this.currentRoom,
      включен: enabled
    });
  }

  sendWebRTCSignal(to: string, data: any): void {
    if (!this.currentRoom) return;

    this.send({
      тип: 'webrtc-signal',
      от: this.userId,
      к: to,
      комната: this.currentRoom,
      данные: data
    });
  }

  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      console.log(`📤 ${this.имя} отправил:`, data.тип);
    }
  }

  private logMessage(message: СообщениеСервера): void {
    this.messageLog.push({
      время: new Date(),
      тип: message.тип,
      данные: message
    });
  }

  onMessage(callback: (message: СообщениеСервера) => void): void {
    this.onMessageCallback = callback;
  }

  getMessageLog(): Array<{ время: Date; тип: string; данные: any }> {
    return this.messageLog;
  }

  getLastMessage(): СообщениеСервера | null {
    const last = this.messageLog[this.messageLog.length - 1];
    return last ? last.данные : null;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get name(): string {
    return this.имя;
  }

  get id(): string {
    return this.userId;
  }

  get room(): string | null {
    return this.currentRoom;
  }
}