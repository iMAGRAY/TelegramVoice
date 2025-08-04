import { useEffect, useState } from 'react';

// Проверка поддержки методов в текущей версии Telegram Web App
const проверить_поддержку_метода = (метод: string, webApp: ТелеграмWebApp | null): boolean => {
  if (!webApp) return false;
  
  // Получаем версию из webApp
  const версия = webApp.version || '6.0';
  
  // Список методов и минимальные версии для их поддержки
  const требования_версий: Record<string, string> = {
    'ready': '6.0',
    'expand': '6.0', 
    'close': '6.0',
    'sendData': '6.0',
    'showAlert': '6.2',
    'showConfirm': '6.2',
    'showPopup': '6.9',
    'showScanQrPopup': '6.4',
    'closeScanQrPopup': '6.4',
    'openLink': '6.1',
    'openTelegramLink': '6.1',
    'openInvoice': '6.1',
    'switchInlineQuery': '6.7',
    'HapticFeedback.impactOccurred': '6.1',
    'HapticFeedback.notificationOccurred': '6.1',
    'HapticFeedback.selectionChanged': '6.1'
  };
  
  const требуемая_версия = требования_версий[метод];
  if (!требуемая_версия) return false;
  
  // Простое сравнение версий (предполагаем формат X.Y)
  const сравнить_версии = (v1: string, v2: string): number => {
    const части1 = v1.split('.').map(Number);
    const части2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(части1.length, части2.length); i++) {
      const num1 = части1[i] || 0;
      const num2 = части2[i] || 0;
      
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  };
  
  return сравнить_версии(версия, требуемая_версия) >= 0;
};

interface ТелеграмПользователь {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface ТелеграмWebApp {
  initData: string;
  initDataUnsafe: {
    user?: ТелеграмПользователь;
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: any;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  isClosingConfirmationEnabled: boolean;
  headerColor: string;
  backgroundColor: string;
  BackButton: any;
  MainButton: any;
  HapticFeedback: any;
  ready: () => void;
  expand: () => void;
  close: () => void;
  showAlert: (message: string) => void;
  showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
  showPopup: (params: any, callback?: (buttonId: string) => void) => void;
  showScanQrPopup: (params: any, callback?: (data: string) => void) => void;
  closeScanQrPopup: () => void;
  sendData: (data: string) => void;
  switchInlineQuery: (query: string, choose_chat_types?: string[]) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (url: string, callback?: (status: string) => void) => void;
}

declare global {
  interface Window {
    Telegram: {
      WebApp: ТелеграмWebApp;
    };
  }
}

export const useTelegramWebApp = () => {
  const [webApp, setWebApp] = useState<ТелеграмWebApp | null>(null);
  const [пользователь, setПользователь] = useState<ТелеграмПользователь | null>(null);
  const [готов, setГотов] = useState(false);

  useEffect(() => {
    console.log(`[useTelegramWebApp] 🔄 Начинаем инициализацию Telegram WebApp...`);
    // Проверяем, запущено ли приложение в Telegram
    const isInTelegram = typeof window !== 'undefined' && window.Telegram?.WebApp;
    console.log(`[useTelegramWebApp] 🔍 В Telegram:`, isInTelegram);
    
    if (isInTelegram) {
      const tg = window.Telegram.WebApp;
      setWebApp(tg);
      
      // Логирование версии для диагностики
      console.log('[TelegramWebApp] Инициализирован в Telegram:', {
        версия: tg.version,
        платформа: tg.platform,
        пользователь: tg.initDataUnsafe?.user,
        поддерживает_showAlert: проверить_поддержку_метода('showAlert', tg),
        поддерживает_showConfirm: проверить_поддержку_метода('showConfirm', tg),
        поддерживает_HapticFeedback: проверить_поддержку_метода('HapticFeedback.impactOccurred', tg)
      });
      
      // Инициализация WebApp (поддерживается с версии 6.0)
      if (проверить_поддержку_метода('ready', tg)) {
        try {
          tg.ready();
          console.log('[TelegramWebApp] WebApp готов');
        } catch (error) {
          console.error('[TelegramWebApp] Ошибка инициализации:', error);
        }
      }
      
      // Расширение до полного размера (поддерживается с версии 6.0)
      if (проверить_поддержку_метода('expand', tg)) {
        try {
          tg.expand();
          console.log('[TelegramWebApp] WebApp расширен');
        } catch (error) {
          console.error('[TelegramWebApp] Ошибка расширения:', error);
        }
      }
      
      // Получение данных пользователя
      if (tg.initDataUnsafe?.user) {
        setПользователь(tg.initDataUnsafe.user);
      }
      
      console.log(`[useTelegramWebApp] ✅ Telegram WebApp инициализирован, устанавливаем готов=true`);
      setГотов(true);
      
      // Настройка темы
      try {
        document.documentElement.style.setProperty('--tg-theme-bg-color', tg.backgroundColor);
        document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color);
        document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color);
        document.documentElement.style.setProperty('--tg-theme-link-color', tg.themeParams.link_color);
        document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color);
        document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color);
      } catch (error) {
        console.warn('[TelegramWebApp] Ошибка настройки темы:', error);
      }
    } else {
      // Fallback для случаев, когда приложение запущено не в Telegram
      console.warn('[useTelegramWebApp] ⚠️ Приложение запущено вне Telegram. Используем тестовый режим.');
      
      // Создаем тестового пользователя
      const testUser = {
        id: 123456789,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        language_code: 'ru'
      } as ТелеграмПользователь;
      
      console.log(`[useTelegramWebApp] 👤 Создан тестовый пользователь:`, testUser);
      setПользователь(testUser);
      
      console.log(`[useTelegramWebApp] ✅ Тестовый режим инициализирован, устанавливаем готов=true`);  
      setГотов(true);
    }
  }, []);

  const показатьУведомление = (сообщение: string) => {
    if (webApp && проверить_поддержку_метода('showAlert', webApp)) {
      try {
        webApp.showAlert(сообщение);
      } catch (error) {
        console.warn('showAlert вызвал ошибку, используем fallback:', error);
        alert(сообщение);
      }
    } else {
      // Fallback для версий без поддержки showAlert
      console.info(`Telegram Web App версии ${webApp?.version || 'неизвестна'} не поддерживает showAlert, используем стандартный alert`);
      alert(сообщение);
    }
  };

  const показатьПодтверждение = (сообщение: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (webApp && проверить_поддержку_метода('showConfirm', webApp)) {
        try {
          webApp.showConfirm(сообщение, (confirmed) => {
            resolve(confirmed);
          });
        } catch (error) {
          console.warn('showConfirm вызвал ошибку, используем fallback:', error);
          resolve(confirm(сообщение));
        }
      } else {
        // Fallback для версий без поддержки showConfirm
        console.info(`Telegram Web App версии ${webApp?.version || 'неизвестна'} не поддерживает showConfirm, используем стандартный confirm`);
        resolve(confirm(сообщение));
      }
    });
  };

  const закрыть = () => {
    if (webApp && проверить_поддержку_метода('close', webApp)) {
      try {
        webApp.close();
      } catch (error) {
        console.warn('close вызвал ошибку:', error);
        // Для close нет прямого fallback - просто логируем
      }
    } else {
      console.info(`Telegram Web App версии ${webApp?.version || 'неизвестна'} не поддерживает close`);
    }
  };

  const отправитьДанные = (данные: string) => {
    if (webApp && проверить_поддержку_метода('sendData', webApp)) {
      try {
        webApp.sendData(данные);
      } catch (error) {
        console.warn('sendData вызвал ошибку:', error);
      }
    } else {
      console.info(`Telegram Web App версии ${webApp?.version || 'неизвестна'} не поддерживает sendData`);
    }
  };

  const вибрация = () => {
    if (webApp && проверить_поддержку_метода('HapticFeedback.impactOccurred', webApp)) {
      try {
        webApp.HapticFeedback?.impactOccurred('medium');
      } catch (error) {
        console.warn('HapticFeedback.impactOccurred вызвал ошибку:', error);
      }
    } else {
      console.info(`Telegram Web App версии ${webApp?.version || 'неизвестна'} не поддерживает HapticFeedback`);
    }
  };

  // Универсальная функция для показа всплывающего окна
  const показатьВсплывающееОкно = (заголовок: string, сообщение: string, кнопки: Array<{id: string, type?: string, text: string}> = []) => {
    if (webApp && проверить_поддержку_метода('showPopup', webApp)) {
      try {
        return new Promise((resolve) => {
          webApp.showPopup({
            title: заголовок,
            message: сообщение,
            buttons: кнопки.length > 0 ? кнопки : [{ id: 'ok', type: 'default', text: 'OK' }]
          }, (buttonId) => {
            resolve(buttonId);
          });
        });
      } catch (error) {
        console.warn('showPopup вызвал ошибку, используем fallback:', error);
        return Promise.resolve(показатьУведомление(`${заголовок}: ${сообщение}`));
      }
    } else {
      // Fallback через showAlert или обычный alert
      console.info(`Telegram Web App версии ${webApp?.version || 'неизвестна'} не поддерживает showPopup, используем fallback`);
      показатьУведомление(`${заголовок}: ${сообщение}`);
      return Promise.resolve('ok');
    }
  };

  return {
    webApp,
    пользователь,
    готов,
    темная_тема: webApp?.colorScheme === 'dark',
    версия: webApp?.version || 'неизвестна',
    поддерживается: (метод: string) => проверить_поддержку_метода(метод, webApp),
    показатьУведомление,
    показатьПодтверждение,
    показатьВсплывающееОкно,
    закрыть,
    отправитьДанные,
    вибрация,
  };
};