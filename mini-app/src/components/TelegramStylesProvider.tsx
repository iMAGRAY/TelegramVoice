'use client';

import { useEffect } from 'react';

export default function TelegramStylesProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Применяем стили Telegram только на клиенте
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      
      // Устанавливаем CSS переменные, которые использует Telegram
      const root = document.documentElement;
      root.style.setProperty('--tg-viewport-height', `${tg.viewportHeight}px`);
      root.style.setProperty('--tg-viewport-stable-height', `${tg.viewportStableHeight}px`);
      
      // Подписываемся на изменения размера viewport
      tg.onEvent('viewportChanged', (event: any) => {
        root.style.setProperty('--tg-viewport-height', `${event.viewportHeight}px`);
        root.style.setProperty('--tg-viewport-stable-height', `${event.viewportStableHeight}px`);
      });
    }
  }, []);

  return <>{children}</>;
}