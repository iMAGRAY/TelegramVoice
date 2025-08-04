import type { Пользователь, Комната } from '@/types';
export declare class WebSocketServer {
    private wss;
    private пользователи;
    private комнаты;
    private соединения;
    constructor(port?: number);
    private инициализироватьКомнаты;
    private настроитьОбработчики;
    private обработатьСообщение;
    private обработатьПрисоединение;
    private присоединитьсяККомнате;
    private покинутьКомнату;
    private создатьКомнату;
    private переслатьWebRTCСигнал;
    private обновитьСостояниеМикрофона;
    private обновитьСостояниеРечи;
    private обновитьУчастниковКомнаты;
    private отправитьСписокКомнат;
    private отправитьУчастниковКомнаты;
    private отправитьСообщение;
    private отправитьВКомнату;
    private широковещательноеСообщение;
    private обработатьОтключение;
    получитьПользователей(): Map<string, Пользователь>;
    получитьКомнаты(): Map<string, Комната>;
    закрыть(): void;
}
//# sourceMappingURL=WebSocketServer.d.ts.map