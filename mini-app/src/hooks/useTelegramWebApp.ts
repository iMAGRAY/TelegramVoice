import { useEffect, useState } from 'react';

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
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      setWebApp(tg);
      
      // Инициализация WebApp
      tg.ready();
      
      // Расширение до полного размера
      tg.expand();
      
      // Получение данных пользователя
      if (tg.initDataUnsafe?.user) {
        setПользователь(tg.initDataUnsafe.user);
      }
      
      setГотов(true);
      
      // Настройка темы
      document.documentElement.style.setProperty('--tg-theme-bg-color', tg.backgroundColor);
      document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color);
      document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color);
      document.documentElement.style.setProperty('--tg-theme-link-color', tg.themeParams.link_color);
      document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color);
      document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color);
    }
  }, []);

  const показатьУведомление = (сообщение: string) => {
    if (webApp) {
      webApp.showAlert(сообщение);
    }
  };

  const показатьПодтверждение = (сообщение: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (webApp) {
        webApp.showConfirm(сообщение, (confirmed) => {
          resolve(confirmed);
        });
      } else {
        resolve(false);
      }
    });
  };

  const закрыть = () => {
    if (webApp) {
      webApp.close();
    }
  };

  const отправитьДанные = (данные: string) => {
    if (webApp) {
      webApp.sendData(данные);
    }
  };

  const вибрация = () => {
    if (webApp?.HapticFeedback) {
      webApp.HapticFeedback.impactOccurred('medium');
    }
  };

  return {
    webApp,
    пользователь,
    готов,
    темная_тема: webApp?.colorScheme === 'dark',
    показатьУведомление,
    показатьПодтверждение,
    закрыть,
    отправитьДанные,
    вибрация,
  };
};