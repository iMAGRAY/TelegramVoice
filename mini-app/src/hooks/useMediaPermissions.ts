'use client';

import { useState, useEffect, useCallback } from 'react';

export type СтатусРазрешений = 'неизвестно' | 'запрашивается' | 'разрешено' | 'отклонено' | 'недоступно';

// Глобальный флаг для предотвращения множественных проверок
let глобальная_проверка_выполнена = false;

interface UseMediaPermissionsResult {
  статус_микрофона: СтатусРазрешений;
  статус_камеры: СтатусРазрешений;
  запросить_микрофон: () => Promise<boolean>;
  запросить_камеру: () => Promise<boolean>;
  запросить_все: () => Promise<{ микрофон: boolean; камера: boolean }>;
  проверить_статус: () => Promise<void>;
  сбросить_разрешения: () => Promise<void>;
  сбросить_статус_микрофона: () => void;
  поддерживается: boolean;
}

export const useMediaPermissions = (): UseMediaPermissionsResult => {
  const [статус_микрофона, setСтатус_микрофона] = useState<СтатусРазрешений>('неизвестно');
  const [статус_камеры, setСтатус_камеры] = useState<СтатусРазрешений>('неизвестно');
  const [поддерживается] = useState(() => {
    return typeof navigator !== 'undefined' && 
           'mediaDevices' in navigator && 
           'getUserMedia' in navigator.mediaDevices;
  });

  // Проверяем, работаем ли мы в Telegram Mini App
  const isInTelegram = typeof window !== 'undefined' && window.Telegram?.WebApp;

  // Проверка текущего статуса разрешений
  const проверить_статус = useCallback(async () => {
    if (!поддерживается) {
      setСтатус_микрофона('недоступно');
      setСтатус_камеры('недоступно');
      return;
    }

    try {
      // Проверяем через Permissions API если доступно
      if ('permissions' in navigator) {
        try {
          const [микрофон_разрешение, камера_разрешение] = await Promise.all([
            navigator.permissions.query({ name: 'microphone' as PermissionName }),
            navigator.permissions.query({ name: 'camera' as PermissionName })
          ]);

          // Логируем только один раз при первой проверке
          // console.log('[MediaPermissions] Permissions API результат - микрофон:', микрофон_разрешение.state, 'камера:', камера_разрешение.state);

          setСтатус_микрофона(переводить_статус_разрешения(микрофон_разрешение.state));
          setСтатус_камеры(переводить_статус_разрешения(камера_разрешение.state));

          // Подписываемся на изменения разрешений ТОЛЬКО ОДИН РАЗ
          if (!микрофон_разрешение.onchange) {
            микрофон_разрешение.onchange = () => {
              console.log('[MediaPermissions] Изменение статуса микрофона:', микрофон_разрешение.state);
              setСтатус_микрофона(переводить_статус_разрешения(микрофон_разрешение.state));
            };
          }
          if (!камера_разрешение.onchange) {
            камера_разрешение.onchange = () => {
              console.log('[MediaPermissions] Изменение статуса камеры:', камера_разрешение.state);
              setСтатус_камеры(переводить_статус_разрешения(камера_разрешение.state));
            };
          }

          return;
        } catch (error) {
          console.log('[MediaPermissions] Permissions API недоступно, используем fallback:', error);
        }
      }

      // Fallback: пытаемся получить доступ к устройствам
      try {
        const поток = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: false 
        });
        поток.getTracks().forEach(track => track.stop());
        setСтатус_микрофона('разрешено');
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            setСтатус_микрофона('отклонено');
          } else if (error.name === 'NotFoundError') {
            setСтатус_микрофона('недоступно');
          } else {
            setСтатус_микрофона('неизвестно');
          }
        }
      }

      try {
        const поток = await navigator.mediaDevices.getUserMedia({ 
          audio: false, 
          video: true 
        });
        поток.getTracks().forEach(track => track.stop());
        setСтатус_камеры('разрешено');
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            setСтатус_камеры('отклонено');
          } else if (error.name === 'NotFoundError') {
            setСтатус_камеры('недоступно');
          } else {
            setСтатус_камеры('неизвестно');
          }
        }
      }
    } catch (error) {
      console.error('Ошибка проверки разрешений:', error);
      setСтатус_микрофона('неизвестно');
      setСтатус_камеры('неизвестно');
    }
  }, [поддерживается]);

  // Принудительный сброс статуса (для Telegram Mini App)
  const сбросить_статус_микрофона = useCallback(() => {
    console.log('[MediaPermissions] Принудительный сброс статуса микрофона');
    setСтатус_микрофона('неизвестно');
  }, []);

  // Запрос разрешения на микрофон
  const запросить_микрофон = useCallback(async (): Promise<boolean> => {
    if (!поддерживается) {
      console.log('[MediaPermissions] Браузер не поддерживает медиа API');
      setСтатус_микрофона('недоступно');
      return false;
    }

    console.log('[MediaPermissions] Запрос разрешения микрофона...', {
      isInTelegram,
      currentStatus: статус_микрофона
    });
    
    try {
      setСтатус_микрофона('запрашивается');
      
      // В Telegram Mini App может потребоваться дополнительное время
      const mediaConstraints = { 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }, 
        video: false 
      };
      
      console.log('[MediaPermissions] Вызываем getUserMedia с ограничениями:', mediaConstraints);
      
      const поток = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      
      console.log('[MediaPermissions] Разрешение получено успешно', {
        tracks: поток.getTracks().length,
        audioTracks: поток.getAudioTracks().length
      });
      
      // Останавливаем поток, он нам нужен был только для запроса разрешения
      поток.getTracks().forEach(track => {
        console.log('[MediaPermissions] Останавливаем трек:', track.kind, track.label);
        track.stop();
      });
      
      setСтатус_микрофона('разрешено');
      return true;
    } catch (error) {
      console.error('[MediaPermissions] Ошибка запроса разрешения микрофона:', error);
      
      if (error instanceof Error) {
        console.log('[MediaPermissions] Детали ошибки:', {
          name: error.name,
          message: error.message,
          isInTelegram
        });
        
        if (error.name === 'NotAllowedError') {
          console.log('[MediaPermissions] Пользователь отклонил разрешение или оно уже заблокировано');
          setСтатус_микрофона('отклонено');
        } else if (error.name === 'NotFoundError') {
          console.log('[MediaPermissions] Микрофон не найден');
          setСтатус_микрофона('недоступно');
        } else if (error.name === 'AbortError') {
          console.log('[MediaPermissions] Запрос был прерван');
          setСтатус_микрофона('неизвестно');
        } else {
          console.log('[MediaPermissions] Неизвестная ошибка:', error.message);
          setСтатус_микрофона('неизвестно');
        }
      }
      
      return false;
    }
  }, [поддерживается, isInTelegram, статус_микрофона]);

  // Запрос разрешения на камеру
  const запросить_камеру = useCallback(async (): Promise<boolean> => {
    if (!поддерживается) {
      setСтатус_камеры('недоступно');
      return false;
    }

    try {
      setСтатус_камеры('запрашивается');
      
      const поток = await navigator.mediaDevices.getUserMedia({ 
        audio: false, 
        video: true 
      });
      
      поток.getTracks().forEach(track => track.stop());
      
      setСтатус_камеры('разрешено');
      return true;
    } catch (error) {
      console.error('Ошибка запроса разрешения камеры:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setСтатус_камеры('отклонено');
        } else if (error.name === 'NotFoundError') {
          setСтатус_камеры('недоступно');
        } else {
          setСтатус_камеры('неизвестно');
        }
      }
      
      return false;
    }
  }, [поддерживается]);

  // Запрос всех разрешений
  const запросить_все = useCallback(async () => {
    const [микрофон, камера] = await Promise.all([
      запросить_микрофон(),
      запросить_камеру()
    ]);

    return { микрофон, камера };
  }, [запросить_микрофон, запросить_камеру]);

  // Сброс разрешений (информационная функция)
  const сбросить_разрешения = useCallback(async () => {
    // Браузер не позволяет программно сбрасывать разрешения
    // Эта функция для информирования пользователя
    console.log('Для сброса разрешений используйте настройки браузера');
    await проверить_статус();
  }, [проверить_статус]);

  // Инициализация - проверяем статус при загрузке ТОЛЬКО ОДИН РАЗ
  useEffect(() => {
    let монтирован = true;
    
    // Проверяем глобальный флаг чтобы избежать множественных проверок
    if (!глобальная_проверка_выполнена) {
      глобальная_проверка_выполнена = true;
      
      // Добавляем небольшую задержку чтобы избежать гонки состояний
      const таймер = setTimeout(() => {
        if (монтирован) {
          проверить_статус();
        }
      }, 100);
      
      return () => {
        монтирован = false;
        clearTimeout(таймер);
      };
    }
  }, []); // Убираем проверить_статус из зависимостей чтобы избежать циклического вызова

  return {
    статус_микрофона,
    статус_камеры,
    запросить_микрофон,
    запросить_камеру,
    запросить_все,
    проверить_статус,
    сбросить_разрешения,
    сбросить_статус_микрофона,
    поддерживается
  };
};

// Вспомогательная функция для перевода статуса разрешения
function переводить_статус_разрешения(state: PermissionState): СтатусРазрешений {
  switch (state) {
    case 'granted':
      return 'разрешено';
    case 'denied':
      return 'отклонено';
    case 'prompt':
      return 'неизвестно';
    default:
      return 'неизвестно';
  }
}