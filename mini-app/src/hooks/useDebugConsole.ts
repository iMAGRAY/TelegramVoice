'use client';

import { useState, useEffect, useCallback } from 'react';

export const useDebugConsole = () => {
  // Отключаем debug консоль в production
  const isProductionMode = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_DISABLE_DEBUG === 'true';
  const [показать_отладку, setПоказать_отладку] = useState(false);

  const переключить_отладку = useCallback(() => {
    if (!isProductionMode) {
      setПоказать_отладку(prev => !prev);
    }
  }, [isProductionMode]);

  const закрыть_отладку = useCallback(() => {
    setПоказать_отладку(false);
  }, []);

  // Обработка горячих клавиш (только в development)
  useEffect(() => {
    if (isProductionMode) return;
    
    const обработчик_клавиш = (event: KeyboardEvent) => {
      // F12 для переключения отладочной консоли
      if (event.key === 'F12') {
        event.preventDefault();
        переключить_отладку();
        return;
      }

      // ESC для закрытия
      if (event.key === 'Escape' && показать_отладку) {
        event.preventDefault();
        закрыть_отладку();
        return;
      }

      // Ctrl+Shift+D как альтернатива для F12 (на случай если F12 заблокирован)
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        переключить_отладку();
        return;
      }
    };

    document.addEventListener('keydown', обработчик_клавиш);
    
    return () => {
      document.removeEventListener('keydown', обработчик_клавиш);
    };
  }, [isProductionMode, показать_отладку, переключить_отладку, закрыть_отладку]);

  // Telegram Mini App специфичные методы открытия (только в development)
  useEffect(() => {
    if (isProductionMode || typeof window === 'undefined' || !window.Telegram?.WebApp) return;
    
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      
      // Добавляем кнопку в главное меню (если поддерживается)
      try {
        // Обработка тапа по статус бару (если доступно)
        const обработчик_тапа_статус_бара = () => {
          переключить_отладку();
        };

        // Пытаемся зарегистрировать обработчик для специальных событий Telegram
        if (tg.onEvent) {
          tg.onEvent('themeChanged', () => {
            console.log('[DebugConsole] Telegram theme changed');
          });
        }

        // Добавляем скрытую кнопку для отладки (тройной тап в углу)
        let тапы_в_углу = 0;
        let таймер_сброса: NodeJS.Timeout;

        const обработчик_тапа_в_углу = (event: TouchEvent) => {
          const touch = event.touches[0];
          if (!touch) return;

          // Проверяем тап в правом верхнем углу (50x50 пикселей)
          const в_правом_верхнем_углу = 
            touch.clientX > window.innerWidth - 50 && 
            touch.clientY < 50;

          if (в_правом_верхнем_углу) {
            тапы_в_углу++;
            
            if (тапы_в_углу >= 3) {
              переключить_отладку();
              тапы_в_углу = 0;
              if (tg.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('medium');
              }
            }

            // Сбрасываем счетчик через 2 секунды
            clearTimeout(таймер_сброса);
            таймер_сброса = setTimeout(() => {
              тапы_в_углу = 0;
            }, 2000);
          }
        };

        document.addEventListener('touchstart', обработчик_тапа_в_углу);

        return () => {
          document.removeEventListener('touchstart', обработчик_тапа_в_углу);
          clearTimeout(таймер_сброса);
        };
      } catch (error) {
        // Не выводим логи в production
      }
    }
  }, [isProductionMode, переключить_отладку]);

  return {
    показать_отладку,
    переключить_отладку,
    закрыть_отладку
  };
};