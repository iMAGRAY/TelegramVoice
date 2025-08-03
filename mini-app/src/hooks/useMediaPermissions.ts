'use client';

import { useState, useEffect, useCallback } from 'react';

export type СтатусРазрешений = 'неизвестно' | 'запрашивается' | 'разрешено' | 'отклонено' | 'недоступно';

interface UseMediaPermissionsResult {
  статус_микрофона: СтатусРазрешений;
  статус_камеры: СтатусРазрешений;
  запросить_микрофон: () => Promise<boolean>;
  запросить_камеру: () => Promise<boolean>;
  запросить_все: () => Promise<{ микрофон: boolean; камера: boolean }>;
  проверить_статус: () => Promise<void>;
  сбросить_разрешения: () => Promise<void>;
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

          console.log('[MediaPermissions] Permissions API результат - микрофон:', микрофон_разрешение.state, 'камера:', камера_разрешение.state);

          setСтатус_микрофона(переводить_статус_разрешения(микрофон_разрешение.state));
          setСтатус_камеры(переводить_статус_разрешения(камера_разрешение.state));

          // Подписываемся на изменения разрешений
          микрофон_разрешение.onchange = () => {
            console.log('[MediaPermissions] Изменение статуса микрофона:', микрофон_разрешение.state);
            setСтатус_микрофона(переводить_статус_разрешения(микрофон_разрешение.state));
          };
          камера_разрешение.onchange = () => {
            console.log('[MediaPermissions] Изменение статуса камеры:', камера_разрешение.state);
            setСтатус_камеры(переводить_статус_разрешения(камера_разрешение.state));
          };

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

  // Запрос разрешения на микрофон
  const запросить_микрофон = useCallback(async (): Promise<boolean> => {
    if (!поддерживается) {
      console.log('[MediaPermissions] Браузер не поддерживает медиа API');
      setСтатус_микрофона('недоступно');
      return false;
    }

    console.log('[MediaPermissions] Запрос разрешения микрофона...');
    
    try {
      setСтатус_микрофона('запрашивается');
      
      const поток = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      
      console.log('[MediaPermissions] Разрешение получено успешно');
      
      // Останавливаем поток, он нам нужен был только для запроса разрешения
      поток.getTracks().forEach(track => track.stop());
      
      setСтатус_микрофона('разрешено');
      return true;
    } catch (error) {
      console.error('[MediaPermissions] Ошибка запроса разрешения микрофона:', error);
      
      if (error instanceof Error) {
        console.log('[MediaPermissions] Тип ошибки:', error.name);
        if (error.name === 'NotAllowedError') {
          console.log('[MediaPermissions] Пользователь отклонил разрешение или оно уже заблокировано');
          setСтатус_микрофона('отклонено');
        } else if (error.name === 'NotFoundError') {
          console.log('[MediaPermissions] Микрофон не найден');
          setСтатус_микрофона('недоступно');
        } else {
          console.log('[MediaPermissions] Неизвестная ошибка:', error.message);
          setСтатус_микрофона('неизвестно');
        }
      }
      
      return false;
    }
  }, [поддерживается]);

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

  // Инициализация - проверяем статус при загрузке
  useEffect(() => {
    проверить_статус();
  }, [проверить_статус]);

  return {
    статус_микрофона,
    статус_камеры,
    запросить_микрофон,
    запросить_камеру,
    запросить_все,
    проверить_статус,
    сбросить_разрешения,
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