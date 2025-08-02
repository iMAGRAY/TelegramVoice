// Типы для Telegram Mini App голосового общения

export interface Пользователь {
  id: string;
  имя: string;
  телеграм_id?: number;
  аватар?: string;
  подключен: boolean;
  в_комнате?: string;
  микрофон_включен: boolean;
  говорит: boolean;
}

export interface Комната {
  id: string;
  название: string;
  создатель: string;
  участники: Пользователь[];
  максимум_участников: number;
  создана: Date;
  активна: boolean;
  приватная: boolean;
  пароль?: string;
}

export interface СообщениеВебСокета {
  тип: 'присоединиться' | 'покинуть' | 'offer' | 'answer' | 'ice-candidate' | 'пользователи_обновлены' | 'микрофон_переключен' | 'говорит' | 'ошибка';
  данные: any;
  от?: string;
  к?: string;
  комната?: string;
  время: number;
}

export interface НастройкиWebRTC {
  iceServers: RTCIceServer[];
  audio: boolean;
  video: boolean;
}

export interface СостояниеПриложения {
  текущий_пользователь: Пользователь | null;
  комнаты: Комната[];
  активная_комната: Комната | null;
  подключено_к_серверу: boolean;
  состояние_микрофона: boolean;
  громкость: number;
  ошибка: string | null;
  загружается: boolean;
}

export interface WebRTCПодключение {
  peer: RTCPeerConnection;
  поток: MediaStream | null;
  пользователь_id: string;
  подключен: boolean;
}

export interface НастройкиЗвука {
  подавление_шума: boolean;
  эхо_подавление: boolean;
  автоматическая_регулировка_громкости: boolean;
  громкость_входа: number;
  громкость_выхода: number;
}