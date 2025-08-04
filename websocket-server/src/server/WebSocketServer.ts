import { WebSocketServer as WSServer } from 'ws';
import type { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { 
  Пользователь, 
  Комната, 
  СообщениеКлиента, 
  СообщениеСервера 
} from '@/types';

interface WSConnection extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

export class WebSocketServer {
  private wss: WSServer;
  private пользователи: Map<string, Пользователь> = new Map();
  private комнаты: Map<string, Комната> = new Map();
  private соединения: Map<string, WSConnection> = new Map();

  constructor(port: number = 8080) {
    this.wss = new WSServer({ port });
    this.инициализироватьКомнаты();
    this.настроитьОбработчики();
    
    console.log(`🚀 WebSocket сервер запущен на порту ${port}`);
  }

  private инициализироватьКомнаты() {
    const предустановленныеКомнаты: Комната[] = [
      {
        id: 'general',
        название: 'Общий',
        создатель: 'system',
        участники: [],
        максимум_участников: 50,
        создана: new Date().toISOString(),
        активна: true,
        приватная: false
      },
      {
        id: 'important',
        название: 'Комната важных переговоров',
        создатель: 'system',
        участники: [],
        максимум_участников: 10,
        создана: new Date().toISOString(),
        активна: true,
        приватная: false
      },
      {
        id: 'channel1',
        название: 'Канал 1',
        создатель: 'system',
        участники: [],
        максимум_участников: 20,
        создана: new Date().toISOString(),
        активна: true,
        приватная: false
      }
    ];

    предустановленныеКомнаты.forEach(комната => {
      this.комнаты.set(комната.id, комната);
    });

    console.log(`📋 Создано ${предустановленныеКомнаты.length} предустановленных комнат`);
  }

  private настроитьОбработчики() {
    // Heartbeat для проверки соединений
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws: WSConnection) => {
        if (ws.isAlive === false) {
          this.обработатьОтключение(ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('connection', (ws: WSConnection) => {
      console.log('🔗 Новое подключение');
      ws.isAlive = true;
      
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        try {
          const сообщение = JSON.parse(data.toString()) as СообщениеКлиента;
          this.обработатьСообщение(ws, сообщение);
        } catch (error) {
          console.error('❌ Ошибка парсинга:', error);
          this.отправитьСообщение(ws, {
            тип: 'ошибка',
            сообщение: 'Неверный формат сообщения'
          });
        }
      });

      ws.on('close', () => {
        this.обработатьОтключение(ws);
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket ошибка:', error);
      });
    });

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  private обработатьСообщение(ws: WSConnection, сообщение: СообщениеКлиента) {
    console.log(`📥 Получено: ${сообщение.тип}`, ws.userId ? `от ${ws.userId}` : '');

    switch (сообщение.тип) {
      case 'присоединиться':
        this.обработатьПрисоединение(ws, сообщение.пользователь);
        break;
      
      case 'присоединиться-к-комнате':
        this.присоединитьсяККомнате(ws, сообщение.комната_id, сообщение.пароль);
        break;
      
      case 'покинуть-комнату':
        this.покинутьКомнату(ws, сообщение.комната_id);
        break;
      
      case 'создать-комнату':
        this.создатьКомнату(ws, сообщение);
        break;
      
      case 'webrtc-signal':
        this.переслатьWebRTCСигнал(сообщение);
        break;
      
      case 'микрофон-переключен':
        this.обновитьСостояниеМикрофона(ws, сообщение.включен, сообщение.комната_id);
        break;
      
      case 'говорит':
        this.обновитьСостояниеРечи(ws, сообщение.говорит, сообщение.комната_id);
        break;
      
      case 'получить-комнаты':
        this.отправитьСписокКомнат(ws);
        break;
      
      case 'получить-пользователей-комнаты':
        this.отправитьУчастниковКомнаты(ws, сообщение.комната_id);
        break;
    }
  }

  private обработатьПрисоединение(ws: WSConnection, пользователь: Пользователь) {
    ws.userId = пользователь.id;
    this.соединения.set(пользователь.id, ws);
    this.пользователи.set(пользователь.id, {
      ...пользователь,
      подключен: true,
      последняя_активность: new Date().toISOString()
    });

    console.log(`👤 Пользователь ${пользователь.имя} присоединился (${пользователь.id})`);

    // Отправляем список комнат
    this.отправитьСписокКомнат(ws);
  }

  private присоединитьсяККомнате(ws: WSConnection, комнатаId: string, пароль?: string) {
    if (!ws.userId) {
      this.отправитьСообщение(ws, {
        тип: 'ошибка',
        сообщение: 'Пользователь не авторизован'
      });
      return;
    }

    const комната = this.комнаты.get(комнатаId);
    if (!комната) {
      this.отправитьСообщение(ws, {
        тип: 'ошибка',
        сообщение: 'Комната не найдена'
      });
      return;
    }

    if (комната.приватная && комната.пароль !== пароль) {
      this.отправитьСообщение(ws, {
        тип: 'ошибка',
        сообщение: 'Неверный пароль'
      });
      return;
    }

    if (комната.участники.length >= комната.максимум_участников) {
      this.отправитьСообщение(ws, {
        тип: 'ошибка',
        сообщение: 'Комната переполнена'
      });
      return;
    }

    // Добавляем пользователя в комнату
    if (!комната.участники.includes(ws.userId)) {
      комната.участники.push(ws.userId);
    }

    const пользователь = this.пользователи.get(ws.userId)!;
    пользователь.в_комнате = комнатаId;

    console.log(`🏠 ${пользователь.имя} присоединился к комнате "${комната.название}"`);

    // Отправляем подтверждение
    this.отправитьСообщение(ws, {
      тип: 'присоединился-к-комнате',
      комната,
      пользователь
    });

    // Обновляем всех участников комнаты
    this.обновитьУчастниковКомнаты(комнатаId);
  }

  private покинутьКомнату(ws: WSConnection, комнатаId: string) {
    if (!ws.userId) return;

    const комната = this.комнаты.get(комнатаId);
    if (!комната) return;

    комната.участники = комната.участники.filter(id => id !== ws.userId);

    const пользователь = this.пользователи.get(ws.userId);
    if (пользователь) {
      пользователь.в_комнате = null;
    }

    // Уведомляем всех в комнате
    this.отправитьВКомнату(комнатаId, {
      тип: 'покинул-комнату',
      комната_id: комнатаId,
      пользователь_id: ws.userId
    }, ws.userId);

    // Обновляем список участников
    this.обновитьУчастниковКомнаты(комнатаId);
  }

  private создатьКомнату(ws: WSConnection, данные: any) {
    if (!ws.userId) return;

    const новаяКомната: Комната = {
      id: uuidv4(),
      название: данные.название,
      создатель: ws.userId,
      участники: [ws.userId],
      максимум_участников: данные.максимум_участников || 10,
      создана: new Date().toISOString(),
      активна: true,
      приватная: данные.приватная || false,
      пароль: данные.пароль
    };

    this.комнаты.set(новаяКомната.id, новаяКомната);

    // Обновляем пользователя
    const пользователь = this.пользователи.get(ws.userId);
    if (пользователь) {
      пользователь.в_комнате = новаяКомната.id;
    }

    // Уведомляем всех о новой комнате
    this.широковещательноеСообщение({
      тип: 'комната-создана',
      комната: новаяКомната
    });
  }

  private переслатьWebRTCСигнал(сообщение: any) {
    const получатель = this.соединения.get(сообщение.к);
    if (получатель) {
      this.отправитьСообщение(получатель, {
        тип: 'webrtc-signal',
        от: сообщение.от,
        к: сообщение.к,
        комната: сообщение.комната,
        данные: сообщение.данные
      });
      console.log(`🔄 WebRTC сигнал переслан от ${сообщение.от} к ${сообщение.к}`);
    }
  }

  private обновитьСостояниеМикрофона(ws: WSConnection, включен: boolean, комнатаId: string) {
    if (!ws.userId) return;

    const пользователь = this.пользователи.get(ws.userId);
    if (пользователь) {
      пользователь.микрофон_включен = включен;
    }

    this.отправитьВКомнату(комнатаId, {
      тип: 'микрофон-переключен',
      пользователь_id: ws.userId,
      комната_id: комнатаId,
      включен
    });
  }

  private обновитьСостояниеРечи(ws: WSConnection, говорит: boolean, комнатаId: string) {
    if (!ws.userId) return;

    const пользователь = this.пользователи.get(ws.userId);
    if (пользователь) {
      пользователь.говорит = говорит;
    }

    this.отправитьВКомнату(комнатаId, {
      тип: 'говорит',
      пользователь_id: ws.userId,
      комната_id: комнатаId,
      говорит
    });
  }

  private обновитьУчастниковКомнаты(комнатаId: string) {
    const комната = this.комнаты.get(комнатаId);
    if (!комната) return;

    const участники = комната.участники
      .map(id => this.пользователи.get(id))
      .filter(п => п) as Пользователь[];

    console.log(`👥 Обновление участников комнаты ${комната.название}: [${участники.map(у => у.имя).join(', ')}]`);

    this.отправитьВКомнату(комнатаId, {
      тип: 'участники-комнаты-обновлены',
      комната_id: комнатаId,
      участники
    });
  }

  private отправитьСписокКомнат(ws: WSConnection) {
    const комнаты = Array.from(this.комнаты.values());
    this.отправитьСообщение(ws, {
      тип: 'комнаты-обновлены',
      комнаты
    });
  }

  private отправитьУчастниковКомнаты(ws: WSConnection, комнатаId: string) {
    const комната = this.комнаты.get(комнатаId);
    if (!комната) return;

    const участники = комната.участники
      .map(id => this.пользователи.get(id))
      .filter(п => п) as Пользователь[];

    this.отправитьСообщение(ws, {
      тип: 'участники-комнаты-обновлены',
      комната_id: комнатаId,
      участники
    });
  }

  private отправитьСообщение(ws: WSConnection, сообщение: СообщениеСервера) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(сообщение));
    }
  }

  private отправитьВКомнату(комнатаId: string, сообщение: СообщениеСервера, исключить?: string) {
    const комната = this.комнаты.get(комнатаId);
    if (!комната) return;

    комната.участники.forEach(userId => {
      if (userId !== исключить) {
        const соединение = this.соединения.get(userId);
        if (соединение) {
          this.отправитьСообщение(соединение, сообщение);
        }
      }
    });
  }

  private широковещательноеСообщение(сообщение: СообщениеСервера) {
    this.wss.clients.forEach((client: WSConnection) => {
      if (client.readyState === client.OPEN) {
        this.отправитьСообщение(client, сообщение);
      }
    });
  }

  private обработатьОтключение(ws: WSConnection) {
    if (!ws.userId) return;

    console.log(`👋 Пользователь ${ws.userId} отключился`);

    const пользователь = this.пользователи.get(ws.userId);
    if (пользователь && пользователь.в_комнате) {
      this.покинутьКомнату(ws, пользователь.в_комнате);
    }

    this.пользователи.delete(ws.userId);
    this.соединения.delete(ws.userId);
  }

  // Публичные методы для тестирования
  public получитьПользователей(): Map<string, Пользователь> {
    return this.пользователи;
  }

  public получитьКомнаты(): Map<string, Комната> {
    return this.комнаты;
  }

  public закрыть() {
    this.wss.close();
  }
}