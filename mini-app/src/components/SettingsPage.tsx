'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useMediaPermissions, СтатусРазрешений } from '@/hooks/useMediaPermissions';

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

interface SettingsPageProps {
  на_закрыть: () => void;
  настройки: НастройкиПриложения;
  на_сохранить: (настройки: НастройкиПриложения) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  на_закрыть,
  настройки,
  на_сохранить
}) => {
  const [текущие_настройки, setТекущие_настройки] = useState<НастройкиПриложения>(настройки);
  const [доступные_микрофоны, setДоступные_микрофоны] = useState<MediaDeviceInfo[]>([]);
  const [тестирование_микрофона, setТестирование_микрофона] = useState(false);
  const [уровень_звука, setУровень_звука] = useState(0);
  const [активная_вкладка, setАктивная_вкладка] = useState<'микрофон' | 'общие'>('микрофон');
  
  const аудио_контекст = useRef<AudioContext | null>(null);
  const анализатор = useRef<AnalyserNode | null>(null);
  const микрофон_поток = useRef<MediaStream | null>(null);
  const анимация_ref = useRef<number>();

  // Хук для управления разрешениями
  const {
    статус_микрофона,
    статус_камеры,
    запросить_микрофон,
    запросить_камеру,
    проверить_статус,
    сбросить_статус_микрофона,
    поддерживается: медиа_поддерживается
  } = useMediaPermissions();

  // Загрузка доступных микрофонов
  useEffect(() => {
    загрузить_устройства();
  }, []);

  const загрузить_устройства = async () => {
    try {
      // Запрашиваем разрешения для получения полного списка устройств
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const устройства = await navigator.mediaDevices.enumerateDevices();
      const микрофоны = устройства.filter(device => device.kind === 'audioinput');
      setДоступные_микрофоны(микрофоны);
    } catch (error) {
      console.error('Ошибка получения устройств:', error);
    }
  };

  // Тестирование микрофона
  const переключить_тестирование = async () => {
    if (!тестирование_микрофона) {
      try {
        const поток = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: текущие_настройки.микрофон.выбранное_устройство_id 
              ? { exact: текущие_настройки.микрофон.выбранное_устройство_id }
              : undefined,
            echoCancellation: текущие_настройки.микрофон.эхо_подавление,
            noiseSuppression: текущие_настройки.микрофон.шумоподавление,
            autoGainControl: текущие_настройки.микрофон.автоматическая_регулировка_уровня,
          }
        });

        микрофон_поток.current = поток;
        аудио_контекст.current = new AudioContext();
        анализатор.current = аудио_контекст.current.createAnalyser();
        const источник = аудио_контекст.current.createMediaStreamSource(поток);
        
        анализатор.current.fftSize = 256;
        источник.connect(анализатор.current);

        setТестирование_микрофона(true);
        анимировать_уровень_звука();
      } catch (error) {
        console.error('Ошибка запуска тестирования:', error);
      }
    } else {
      остановить_тестирование();
    }
  };

  const остановить_тестирование = () => {
    if (микрофон_поток.current) {
      микрофон_поток.current.getTracks().forEach(track => track.stop());
      микрофон_поток.current = null;
    }
    if (аудио_контекст.current) {
      аудио_контекст.current.close();
      аудио_контекст.current = null;
    }
    if (анимация_ref.current) {
      cancelAnimationFrame(анимация_ref.current);
    }
    анализатор.current = null;
    setТестирование_микрофона(false);
    setУровень_звука(0);
  };

  const анимировать_уровень_звука = () => {
    if (!анализатор.current) return;

    const данные = new Uint8Array(анализатор.current.frequencyBinCount);
    анализатор.current.getByteFrequencyData(данные);
    
    const среднее = данные.reduce((a, b) => a + b) / данные.length;
    const нормализованное = Math.min(100, (среднее / 128) * 100);
    
    setУровень_звука(нормализованное);
    анимация_ref.current = requestAnimationFrame(анимировать_уровень_звука);
  };

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      остановить_тестирование();
    };
  }, []);

  const обновить_настройки = (раздел: keyof НастройкиПриложения, ключ: string, значение: any) => {
    setТекущие_настройки(prev => ({
      ...prev,
      [раздел]: {
        ...prev[раздел],
        [ключ]: значение
      }
    }));
  };

  const сохранить_и_закрыть = () => {
    остановить_тестирование();
    на_сохранить(текущие_настройки);
    на_закрыть();
  };

  const отменить_и_закрыть = () => {
    остановить_тестирование();
    на_закрыть();
  };

  // Функции для работы с разрешениями
  const получить_текст_статуса = (статус: СтатусРазрешений): string => {
    switch (статус) {
      case 'разрешено':
        return 'Разрешено';
      case 'отклонено':
        return 'Заблокировано';
      case 'запрашивается':
        return 'Запрашивается...';
      case 'недоступно':
        return 'Недоступно';
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

  const обработать_запрос_микрофона = async () => {
    try {
      const результат = await запросить_микрофон();
      if (результат) {
        // Перезагружаем список устройств после получения разрешения
        await загрузить_устройства();
      }
    } catch (error) {
      console.error('Ошибка запроса разрешения микрофона:', error);
    }
  };

  const показать_инструкцию_разрешений = () => {
    const инструкция = `
Для восстановления доступа к микрофону:

1. Нажмите на иконку 🔒 или ⓘ в адресной строке браузера
2. Найдите настройку "Микрофон" 
3. Выберите "Разрешить" или "Спрашивать"
4. Обновите страницу

Альтернативно в настройках браузера:
• Chrome: Настройки → Конфиденциальность → Настройки сайта → Микрофон
• Firefox: Настройки → Приватность → Разрешения → Микрофон  
• Safari: Настройки → Веб-сайты → Микрофон
`;
    
    alert(инструкция);
  };

  return (
    <div className="fixed inset-0 bg-[var(--bg-primary)] z-50 overflow-auto">
      {/* Заголовок */}
      <div className="sticky top-0 bg-[var(--bg-primary)] border-b border-[var(--border-color)] z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={отменить_и_закрыть}
              className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Настройки</h1>
          </div>
          <button
            onClick={сохранить_и_закрыть}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Сохранить
          </button>
        </div>

        {/* Вкладки */}
        <div className="flex border-b border-[var(--border-color)]">
          <button
            onClick={() => setАктивная_вкладка('микрофон')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              активная_вкладка === 'микрофон'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Микрофон
          </button>
          <button
            onClick={() => setАктивная_вкладка('общие')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              активная_вкладка === 'общие'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Общие
          </button>
        </div>
      </div>

      {/* Контент */}
      <div className="p-4 max-w-2xl mx-auto">
        {активная_вкладка === 'микрофон' && (
          <div className="space-y-6">
            {/* Статус разрешений */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">Разрешения</h3>
              
              {/* Микрофон */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[var(--bg-primary)] rounded-lg">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">Микрофон</div>
                      <div className="text-xs text-[var(--text-tertiary)]">Доступ к аудио</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${получить_цвет_статуса(статус_микрофона)}`}>
                      {получить_текст_статуса(статус_микрофона)}
                    </span>
                    {статус_микрофона === 'отклонено' && (
                      <button
                        onClick={показать_инструкцию_разрешений}
                        className="p-1 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                        title="Как разрешить доступ"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    )}
                    {статус_микрофона !== 'разрешено' && статус_микрофона !== 'запрашивается' && (
                      <div className="flex gap-1">
                        <button
                          onClick={обработать_запрос_микрофона}
                          disabled={статус_микрофона === 'запрашивается'}
                          className="px-3 py-1 text-xs bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-white rounded transition-opacity"
                        >
                          Разрешить
                        </button>
                        {статус_микрофона === 'отклонено' && (
                          <button
                            onClick={() => {
                              сбросить_статус_микрофона();
                              setTimeout(обработать_запрос_микрофона, 100);
                            }}
                            className="px-2 py-1 text-xs bg-[var(--warning)] hover:opacity-90 text-white rounded transition-opacity"
                            title="Принудительный сброс"
                          >
                            🔄
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {!медиа_поддерживается && (
                  <div className="p-3 bg-[var(--warning)] bg-opacity-10 border border-[var(--warning)] rounded-lg">
                    <p className="text-[var(--warning)] text-sm">
                      ⚠️ Ваш браузер не поддерживает доступ к микрофону или работает в небезопасном контексте
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Выбор устройства */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">Устройство ввода</h3>
              <select
                value={текущие_настройки.микрофон.выбранное_устройство_id}
                onChange={(e) => обновить_настройки('микрофон', 'выбранное_устройство_id', e.target.value)}
                className="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              >
                <option value="">По умолчанию</option>
                {доступные_микрофоны.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Микрофон ${device.deviceId.slice(0, 8)}...`}
                  </option>
                ))}
              </select>
            </div>

            {/* Тестирование микрофона */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Тестирование</h3>
                <button
                  onClick={переключить_тестирование}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    тестирование_микрофона
                      ? 'bg-[var(--danger)] text-white hover:opacity-90'
                      : 'bg-[var(--accent)] text-white hover:opacity-90'
                  }`}
                >
                  {тестирование_микрофона ? 'Остановить' : 'Тестировать'}
                </button>
              </div>
              
              {/* Визуализатор уровня звука */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">Уровень звука</span>
                  <span className="text-[var(--text-primary)]">{Math.round(уровень_звука)}%</span>
                </div>
                <div className="w-full bg-[var(--bg-primary)] rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-100 ${
                      уровень_звука > 70 ? 'bg-[var(--danger)]' : 
                      уровень_звука > 30 ? 'bg-[var(--warning)]' : 'bg-[var(--success)]'
                    }`}
                    style={{ width: `${уровень_звука}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Настройки качества */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">Качество звука</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Уровень громкости микрофона
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={текущие_настройки.микрофон.уровень_громкости}
                    onChange={(e) => обновить_настройки('микрофон', 'уровень_громкости', parseInt(e.target.value))}
                    className="w-full h-2 bg-[var(--bg-primary)] rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-1">
                    <span>0%</span>
                    <span>{текущие_настройки.микрофон.уровень_громкости}%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Чувствительность детекции голоса
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={текущие_настройки.микрофон.чувствительность_детекции_голоса}
                    onChange={(e) => обновить_настройки('микрофон', 'чувствительность_детекции_голоса', parseInt(e.target.value))}
                    className="w-full h-2 bg-[var(--bg-primary)] rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-1">
                    <span>Низкая</span>
                    <span>Высокая</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Качество записи
                  </label>
                  <select
                    value={текущие_настройки.микрофон.качество_звука}
                    onChange={(e) => обновить_настройки('микрофон', 'качество_звука', e.target.value)}
                    className="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  >
                    <option value="низкое">Низкое (экономия трафика)</option>
                    <option value="среднее">Среднее (баланс)</option>
                    <option value="высокое">Высокое (лучшее качество)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Переключатели */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">Обработка звука</h3>
              <div className="space-y-4">
                {[
                  {
                    ключ: 'шумоподавление',
                    название: 'Шумоподавление',
                    описание: 'Автоматическое удаление фонового шума'
                  },
                  {
                    ключ: 'эхо_подавление',
                    название: 'Подавление эха',
                    описание: 'Устранение эха и обратной связи'
                  },
                  {
                    ключ: 'автоматическая_регулировка_уровня',
                    название: 'Автоматическая регулировка уровня',
                    описание: 'Автоматическая настройка громкости микрофона'
                  }
                ].map(({ ключ, название, описание }) => (
                  <div key={ключ} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">{название}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">{описание}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={текущие_настройки.микрофон[ключ as keyof МикрофонНастройки] as boolean}
                        onChange={(e) => обновить_настройки('микрофон', ключ, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[var(--bg-primary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {активная_вкладка === 'общие' && (
          <div className="space-y-6">
            {/* Уведомления */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-medium text-[var(--text-primary)]">Уведомления</div>
                  <div className="text-sm text-[var(--text-tertiary)]">Получать уведомления от приложения</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={текущие_настройки.уведомления}
                    onChange={(e) => setТекущие_настройки(prev => ({ ...prev, уведомления: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[var(--bg-primary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
                </label>
              </div>
            </div>

            {/* Тема */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">Тема оформления</h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { значение: 'авто', название: 'Автоматическая', описание: 'Следует системной теме' },
                  { значение: 'светлая', название: 'Светлая', описание: 'Всегда светлая тема' },
                  { значение: 'темная', название: 'Темная', описание: 'Всегда темная тема' }
                ].map(({ значение, название, описание }) => (
                  <label key={значение} className="flex items-center justify-between p-3 bg-[var(--bg-primary)] rounded-lg cursor-pointer hover:bg-[var(--bg-hover)] transition-colors">
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">{название}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">{описание}</div>
                    </div>
                    <input
                      type="radio"
                      name="тема"
                      value={значение}
                      checked={текущие_настройки.тема === значение}
                      onChange={(e) => setТекущие_настройки(prev => ({ ...prev, тема: e.target.value as any }))}
                      className="w-4 h-4 text-[var(--accent)] bg-[var(--bg-secondary)] border-[var(--border-color)] focus:ring-[var(--accent)] focus:ring-2"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Язык */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">Язык</h3>
              <select
                value={текущие_настройки.язык}
                onChange={(e) => setТекущие_настройки(prev => ({ ...prev, язык: e.target.value as any }))}
                className="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              >
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};