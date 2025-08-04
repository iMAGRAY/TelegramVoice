'use client';

import React from 'react';
import { Mic, MicOff, AlertTriangle, RefreshCw } from 'lucide-react';

interface MicrophoneErrorProps {
  ошибка: string;
  на_повторить: () => void;
  на_показать_разрешения: () => void;
  на_покинуть: () => void;
}

export const MicrophoneError: React.FC<MicrophoneErrorProps> = ({
  ошибка,
  на_повторить,
  на_показать_разрешения,
  на_покинуть
}) => {
  const получить_иконку_и_цвет = () => {
    if (ошибка.includes('ЗАПРЕЩЕН') || ошибка.includes('разрешения')) {
      return { icon: MicOff, color: 'text-[var(--danger)]' };
    }
    if (ошибка.includes('НЕ НАЙДЕН')) {
      return { icon: AlertTriangle, color: 'text-[var(--warning)]' };
    }
    return { icon: MicOff, color: 'text-[var(--danger)]' };
  };

  const { icon: Icon, color } = получить_иконку_и_цвет();

  const получить_рекомендации = () => {
    if (ошибка.includes('ЗАПРЕЩЕН') || ошибка.includes('разрешения')) {
      return [
        'Нажмите на иконку замка в адресной строке браузера',
        'Разрешите доступ к микрофону для этого сайта',
        'Обновите страницу после изменения разрешений'
      ];
    }
    if (ошибка.includes('НЕ НАЙДЕН')) {
      return [
        'Подключите микрофон или гарнитуру к устройству',
        'Проверьте настройки звука в системе',
        'Убедитесь что микрофон не отключен'
      ];
    }
    if (ошибка.includes('ЗАНЯТ')) {
      return [
        'Закройте другие приложения использующие микрофон',
        'Завершите видеозвонки в других вкладках браузера',
        'Перезапустите браузер если проблема сохраняется'
      ];
    }
    return [
      'Проверьте подключение микрофона',
      'Обновите браузер до последней версии',
      'Попробуйте использовать другой браузер'
    ];
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-color)]">
        {/* Иконка и заголовок */}
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--bg-primary)] mb-4 ${color}`}>
            <Icon className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Проблема с микрофоном
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Для участия в голосовом общении необходим доступ к микрофону
          </p>
        </div>

        {/* Описание ошибки */}
        <div className="bg-[var(--bg-primary)] rounded-lg p-4 mb-6">
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            {ошибка}
          </p>
        </div>

        {/* Рекомендации */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">
            Что можно попробовать:
          </h3>
          <ul className="space-y-2">
            {получить_рекомендации().map((рекомендация, индекс) => (
              <li key={индекс} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                <span className="text-[var(--accent)] mt-1">•</span>
                <span>{рекомендация}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Кнопки действий */}
        <div className="space-y-3">
          <button
            onClick={на_повторить}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            Попробовать снова
          </button>
          
          <button
            onClick={на_показать_разрешения}
            className="w-full px-4 py-3 bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors border border-[var(--border-color)]"
          >
            Настроить разрешения
          </button>
          
          <button
            onClick={на_покинуть}
            className="w-full px-4 py-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Вернуться назад
          </button>
        </div>
      </div>
    </div>
  );
};