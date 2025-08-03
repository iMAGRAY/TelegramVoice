'use client';

import { useState, useEffect } from 'react';

interface МикрофонНастройки {
  выбранное_устройство_id: string;
  уровень_громкости: number;
  шумоподавление: boolean;
  автоматическая_регулировка_уровня: boolean;
  эхо_подавление: boolean;
  чувствительность_детекции_голоса: number;
  качество_звука: 'низкое' | 'среднее' | 'высокое';
}

interface НастройкиПриложения {
  микрофон: МикрофонНастройки;
  уведомления: boolean;
  тема: 'авто' | 'светлая' | 'темная';
  язык: 'ru' | 'en';
}

const настройки_по_умолчанию: НастройкиПриложения = {
  микрофон: {
    выбранное_устройство_id: '',
    уровень_громкости: 75,
    шумоподавление: true,
    автоматическая_регулировка_уровня: true,
    эхо_подавление: true,
    чувствительность_детекции_голоса: 50,
    качество_звука: 'среднее',
  },
  уведомления: true,
  тема: 'авто',
  язык: 'ru',
};

const КЛЮЧ_НАСТРОЕК = 'telegram-voice-settings';

export const useSettings = () => {
  const [настройки, setНастройки] = useState<НастройкиПриложения>(настройки_по_умолчанию);
  const [загружено, setЗагружено] = useState(false);

  // Загрузка настроек из localStorage
  useEffect(() => {
    try {
      const сохраненные_настройки = localStorage.getItem(КЛЮЧ_НАСТРОЕК);
      if (сохраненные_настройки) {
        const parsed = JSON.parse(сохраненные_настройки);
        setНастройки({
          ...настройки_по_умолчанию,
          ...parsed,
          микрофон: {
            ...настройки_по_умолчанию.микрофон,
            ...parsed.микрофон,
          },
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
    } finally {
      setЗагружено(true);
    }
  }, []);

  // Сохранение настроек в localStorage
  const сохранить_настройки = (новые_настройки: НастройкиПриложения) => {
    try {
      localStorage.setItem(КЛЮЧ_НАСТРОЕК, JSON.stringify(новые_настройки));
      setНастройки(новые_настройки);
      
      // Применение темы
      применить_тему(новые_настройки.тема);
    } catch (error) {
      console.error('Ошибка сохранения настроек:', error);
    }
  };

  // Применение темы
  const применить_тему = (тема: НастройкиПриложения['тема']) => {
    const root = document.documentElement;
    
    if (тема === 'авто') {
      // Определяем тему по системным настройкам
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', systemDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', тема === 'темная' ? 'dark' : 'light');
    }
  };

  // Применение темы при загрузке
  useEffect(() => {
    if (загружено) {
      применить_тему(настройки.тема);
    }
  }, [загружено, настройки.тема]);

  // Слушатель изменения системной темы
  useEffect(() => {
    if (настройки.тема === 'авто') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        применить_тему('авто');
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [настройки.тема]);

  // Получение настроек микрофона в формате для WebRTC
  const получить_настройки_микрофона = (): MediaStreamConstraints['audio'] => {
    const { микрофон } = настройки;
    
    const constraints: MediaTrackConstraints = {
      echoCancellation: микрофон.эхо_подавление,
      noiseSuppression: микрофон.шумоподавление,
      autoGainControl: микрофон.автоматическая_регулировка_уровня,
    };

    if (микрофон.выбранное_устройство_id) {
      constraints.deviceId = { exact: микрофон.выбранное_устройство_id };
    }

    // Настройка качества звука
    switch (микрофон.качество_звука) {
      case 'низкое':
        constraints.sampleRate = 22050;
        constraints.channelCount = 1;
        break;
      case 'высокое':
        constraints.sampleRate = 48000;
        constraints.channelCount = 2;
        break;
      default: // среднее
        constraints.sampleRate = 44100;
        constraints.channelCount = 1;
        break;
    }

    return constraints;
  };

  // Сброс настроек к значениям по умолчанию
  const сбросить_настройки = () => {
    сохранить_настройки(настройки_по_умолчанию);
  };

  return {
    настройки,
    загружено,
    сохранить_настройки,
    получить_настройки_микрофона,
    сбросить_настройки,
  };
};