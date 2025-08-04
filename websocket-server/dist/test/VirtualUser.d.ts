import type { СообщениеСервера } from '@/types';
export declare class VirtualUser {
    private ws;
    private userId;
    private имя;
    private currentRoom;
    private messageLog;
    private onMessageCallback?;
    constructor(имя: string);
    connect(url: string): Promise<void>;
    private sendJoinMessage;
    private handleMessage;
    joinRoom(roomId: string): void;
    leaveRoom(): void;
    toggleMicrophone(enabled: boolean): void;
    sendWebRTCSignal(to: string, data: any): void;
    private send;
    private logMessage;
    onMessage(callback: (message: СообщениеСервера) => void): void;
    getMessageLog(): Array<{
        время: Date;
        тип: string;
        данные: any;
    }>;
    getLastMessage(): СообщениеСервера | null;
    disconnect(): void;
    get name(): string;
    get id(): string;
    get room(): string | null;
}
//# sourceMappingURL=VirtualUser.d.ts.map