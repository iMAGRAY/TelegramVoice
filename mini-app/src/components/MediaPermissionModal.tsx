'use client';

import React, { useState, useEffect } from 'react';
import { useMediaPermissions, СтатусРазрешений } from '@/hooks/useMediaPermissions';

interface MediaPermissionModalProps {
  открыт: boolean;
  на_закрыть: () => void;
  на_разрешение_получено: () => void;
  на_разрешение_отклонено: () => void;
  требуется_микрофон?: boolean;
  требуется_камера?: boolean;
  заголовок?: string;
  описание?: string;
}

export const MediaPermissionModal: React.FC<MediaPermissionModalProps> = ({
  открыт,
  на_закрыть,
  на_разрешение_получено,
  на_разрешение_отклонено,
  требуется_микрофон = true,
  требуется_камера = false,
  заголовок = 'Доступ к микрофону',
  описание = 'Для участия в голосовом общении необходимо разрешить доступ к микрофону'
}) => {
  const {
    статус_микрофона,
    статус_камеры,
    запросить_микрофон,
    запросить_камеру,
    запросить_все,
    поддерживается
  } = useMediaPermissions();

  const [загружается, setЗагружается] = useState(false);
  const [ошибка, setОшибка] = useState<string | null>(null);

  // Проверяем, есть ли уже все необходимые разрешения
  useEffect(() => {
    if (!открыт) return;

    const микрофон_ок = !требуется_микрофон || статус_микрофона === 'разрешено';
    const камера_ок = !требуется_камера || статус_камеры === 'разрешено';

    if (микрофон_ок && камера_ок) {
      на_разрешение_получено();
    }
  }, [открыт, статус_микрофона, статус_камеры, требуется_микрофон, требуется_камера, на_разрешение_получено]);

  const обработать_запрос = async () => {
    if (загружается) return;

    try {
      setЗагружается(true);
      setОшибка(null);

      let успех = true;

      if (требуется_микрофон && статус_микрофона !== 'разрешено') {
        const результат = await запросить_микрофон();
        if (!результат) успех = false;
      }

      if (требуется_камера && статус_камеры !== 'разрешено') {
        const результат = await запросить_камеру();
        if (!результат) успех = false;
      }

      if (успех) {
        на_разрешение_получено();
      } else {
        на_разрешение_отклонено();
      }
    } catch (error) {
      console.error('Ошибка запроса разрешений:', error);
      setОшибка('Произошла ошибка при запросе разрешений');
      на_разрешение_отклонено();
    } finally {
      setЗагружается(false);
    }
  };

  const обработать_настройки_браузера = () => {
    // Показываем инструкцию по настройке разрешений в браузере
    const инструкция = `
Для предоставления доступа к микрофону:

1. Нажмите на иконку замка в адресной строке
2. Выберите "Разрешить" для микрофона
3. Обновите страницу

Или в настройках браузера:
• Chrome: Настройки → Конфиденциальность → Настройки сайта → Микрофон
• Firefox: Настройки → Приватность → Разрешения → Микрофон
• Safari: Настройки → Веб-сайты → Микрофон
`;
    
    alert(инструкция);
  };

  const получить_текст_статуса = (статус: СтатусРазрешений): string => {
    switch (статус) {
      case 'разрешено':
        return 'Разрешено ✅';
      case 'отклонено':
        return 'Заблокировано ❌';
      case 'запрашивается':
        return 'Запрашивается...';
      case 'недоступно':
        return 'Устройство недоступно';
      default:
        return 'Не определено';
    }
  };

  const получить_цвет_статуса = (статус: СтатусРазрешений): string => {
    switch (статус) {
      case 'разрешено':
        return 'text-[var(--success)]';
      case 'отклонено':
        return 'text-[var(--danger)]';
      case 'запрашивается':
        return 'text-[var(--warning)]';
      case 'недоступно':
        return 'text-[var(--text-tertiary)]';
      default:
        return 'text-[var(--text-secondary)]';
    }
  };

  if (!открыт) return null;

  // Если браузер не поддерживает медиа API
  if (!поддерживается) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-[var(--bg-primary)] rounded-lg shadow-lg max-w-md w-full p-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-[var(--danger)] bg-opacity-10 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              Микрофон недоступен
            </h3>
            <p className="text-[var(--text-secondary)] mb-6">
              Ваш браузер не поддерживает доступ к микрофону или устройство недоступно
            </p>
            <button
              onClick={на_закрыть}
              className="w-full px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg transition-colors"
            >
              Понятно
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-primary)] rounded-lg shadow-lg max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-[var(--accent)] bg-opacity-10 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            {заголовок}
          </h3>
          <p className="text-[var(--text-secondary)]">
            {описание}
          </p>
        </div>

        {/* Статус разрешений */}
        <div className="space-y-3 mb-6">
          {требуется_микрофон && (
            <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span className="text-[var(--text-primary)]">Микрофон</span>
              </div>
              <span className={получить_цвет_статуса(статус_микрофона)}>
                {получить_текст_статуса(статус_микрофона)}
              </span>
            </div>
          )}

          {требуется_камера && (
            <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-[var(--text-primary)]">Камера</span>
              </div>
              <span className={получить_цвет_статуса(статус_камеры)}>
                {получить_текст_статуса(статус_камеры)}
              </span>
            </div>
          )}
        </div>

        {/* Ошибка */}
        {ошибка && (
          <div className="mb-4 p-3 bg-[var(--danger)] bg-opacity-10 border border-[var(--danger)] rounded-lg">
            <p className="text-[var(--danger)] text-sm">{ошибка}</p>
          </div>
        )}

        {/* Кнопки */}
        <div className="space-y-3">
          {/* Показываем кнопку запроса, если есть неразрешенные устройства */}
          {((требуется_микрофон && статус_микрофона !== 'разрешено') || 
            (требуется_камера && статус_камеры !== 'разрешено')) && (
            <button
              onClick={обработать_запрос}
              disabled={загружается || 
                       (требуется_микрофон && статус_микрофона === 'запрашивается') ||
                       (требуется_камера && статус_камеры === 'запрашивается')}
              className="w-full px-4 py-3 bg-[var(--accent)] hover:bg-opacity-90 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
            >
              {загружается ? 'Запрашиваем доступ...' : 'Разрешить доступ'}
            </button>
          )}

          {/* Кнопка настроек браузера для заблокированных разрешений */}
          {((требуется_микрофон && статус_микрофона === 'отклонено') || 
            (требуется_камера && статус_камеры === 'отклонено')) && (
            <button
              onClick={обработать_настройки_браузера}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg transition-colors"
            >
              Настройки браузера
            </button>
          )}

          {/* Кнопки отмены */}
          <div className="flex gap-3">
            <button
              onClick={на_закрыть}
              className="flex-1 px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={() => {
                на_разрешение_отклонено();
                на_закрыть();
              }}
              className="flex-1 px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg transition-colors"
            >
              Продолжить без микрофона
            </button>
          </div>
        </div>

        {/* Подсказка */}
        <div className="mt-4 p-3 bg-[var(--bg-secondary)] rounded-lg">
          <p className="text-xs text-[var(--text-tertiary)]">
            💡 Разрешения сохраняются для этого сайта. Вы можете изменить их в любое время в настройках браузера или через кнопку 🔒 в адресной строке.
          </p>
        </div>
      </div>
    </div>
  );
};