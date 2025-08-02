'use client';

import React, { useState } from 'react';
import { Комната, Пользователь } from '@/types';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';

interface RoomsListProps {
  комнаты: Комната[];
  пользователь: Пользователь;
  на_присоединение: (комната_id: string, пароль?: string) => void;
  на_создание_комнаты: (название: string, максимум: number, приватная: boolean, пароль?: string) => void;
  загружается: boolean;
}

export const RoomsList: React.FC<RoomsListProps> = ({
  комнаты,
  пользователь,
  на_присоединение,
  на_создание_комнаты,
  загружается
}) => {
  const [показать_создание, setПоказать_создание] = useState(false);
  const [название_комнаты, setНазвание_комнаты] = useState('');
  const [максимум_участников, setМаксимум_участников] = useState(10);
  const [приватная, setПриватная] = useState(false);
  const [пароль, setПароль] = useState('');
  const [пароль_для_входа, setПароль_для_входа] = useState('');
  const [выбранная_комната, setВыбранная_комната] = useState<string | null>(null);

  const { вибрация, показатьУведомление } = useTelegramWebApp();

  const обработать_создание = () => {
    if (!название_комнаты.trim()) {
      показатьУведомление('Введите название комнаты');
      return;
    }

    if (максимум_участников < 2 || максимум_участников > 50) {
      показатьУведомление('Количество участников должно быть от 2 до 50');
      return;
    }

    if (приватная && !пароль.trim()) {
      показатьУведомление('Для приватной комнаты требуется пароль');
      return;
    }

    на_создание_комнаты(
      название_комнаты,
      максимум_участников,
      приватная,
      приватная ? пароль : undefined
    );

    // Сброс формы
    setНазвание_комнаты('');
    setМаксимум_участников(10);
    setПриватная(false);
    setПароль('');
    setПоказать_создание(false);
    вибрация();
  };

  const обработать_присоединение = (комната: Комната) => {
    if (комната.приватная && !пароль_для_входа.trim()) {
      setВыбранная_комната(комната.id);
      return;
    }

    на_присоединение(комната.id, комната.приватная ? пароль_для_входа : undefined);
    setВыбранная_комната(null);
    setПароль_для_входа('');
    вибрация();
  };

  const отменить_ввод_пароля = () => {
    setВыбранная_комната(null);
    setПароль_для_входа('');
  };

  if (загружается) {
    return (
      <div className=\"flex items-center justify-center h-64\">
        <div className=\"text-gray-600 dark:text-gray-300\">Загрузка комнат...</div>
      </div>
    );
  }

  return (
    <div className=\"p-4 space-y-4\">
      {/* Заголовок */}
      <div className=\"flex items-center justify-between\">
        <h1 className=\"text-2xl font-bold text-gray-800 dark:text-white\">
          🎤 Голосовые комнаты
        </h1>
        <button
          onClick={() => setПоказать_создание(true)}
          className=\"bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors\"
        >
          ➕ Создать
        </button>
      </div>

      {/* Приветствие пользователя */}
      <div className=\"bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 p-4 rounded-lg\">
        <div className=\"flex items-center space-x-3\">
          <div className=\"text-2xl\">{пользователь.аватар || '👤'}</div>
          <div>
            <div className=\"font-medium text-gray-800 dark:text-white\">
              Привет, {пользователь.имя}!
            </div>
            <div className=\"text-sm text-gray-600 dark:text-gray-300\">
              Выберите комнату для голосового общения
            </div>
          </div>
        </div>
      </div>

      {/* Форма создания комнаты */}
      {показать_создание && (
        <div className=\"bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-700 space-y-3\">
          <h3 className=\"font-bold text-gray-800 dark:text-white\">Создать новую комнату</h3>
          
          <input
            type=\"text\"
            placeholder=\"Название комнаты\"
            value={название_комнаты}
            onChange={(e) => setНазвание_комнаты(e.target.value)}
            className=\"w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white\"
            maxLength={50}
          />

          <div className=\"flex items-center space-x-4\">
            <label className=\"text-gray-700 dark:text-gray-300\">
              Макс. участников:
            </label>
            <input
              type=\"number\"
              min=\"2\"
              max=\"50\"
              value={максимум_участников}
              onChange={(e) => setМаксимум_участников(Number(e.target.value))}
              className=\"w-20 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white\"
            />
          </div>

          <div className=\"flex items-center space-x-2\">
            <input
              type=\"checkbox\"
              id=\"приватная\"
              checked={приватная}
              onChange={(e) => setПриватная(e.target.checked)}
              className=\"rounded\"
            />
            <label htmlFor=\"приватная\" className=\"text-gray-700 dark:text-gray-300\">
              Приватная комната (требует пароль)
            </label>
          </div>

          {приватная && (
            <input
              type=\"password\"
              placeholder=\"Пароль для комнаты\"
              value={пароль}
              onChange={(e) => setПароль(e.target.value)}
              className=\"w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white\"
            />
          )}

          <div className=\"flex space-x-2\">
            <button
              onClick={обработать_создание}
              className=\"flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg transition-colors\"
            >
              ✅ Создать
            </button>
            <button
              onClick={() => setПоказать_создание(false)}
              className=\"flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors\"
            >
              ❌ Отмена
            </button>
          </div>
        </div>
      )}

      {/* Ввод пароля для приватной комнаты */}
      {выбранная_комната && (
        <div className=\"bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg border-2 border-yellow-200 dark:border-yellow-700\">
          <h3 className=\"font-bold text-gray-800 dark:text-white mb-3\">
            🔒 Введите пароль для входа в комнату
          </h3>
          <input
            type=\"password\"
            placeholder=\"Пароль\"
            value={пароль_для_входа}
            onChange={(e) => setПароль_для_входа(e.target.value)}
            className=\"w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white mb-3\"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                const комната = комнаты.find(r => r.id === выбранная_комната);
                if (комната) обработать_присоединение(комната);
              }
            }}
          />
          <div className=\"flex space-x-2\">
            <button
              onClick={() => {
                const комната = комнаты.find(r => r.id === выбранная_комната);
                if (комната) обработать_присоединение(комната);
              }}
              className=\"flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition-colors\"
            >
              🚪 Войти
            </button>
            <button
              onClick={отменить_ввод_пароля}
              className=\"flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors\"
            >
              ❌ Отмена
            </button>
          </div>
        </div>
      )}

      {/* Список комнат */}
      <div className=\"space-y-3\">
        {комнаты.length === 0 ? (
          <div className=\"text-center py-8 text-gray-600 dark:text-gray-400\">
            <div className=\"text-4xl mb-2\">🏠</div>
            <div>Пока нет доступных комнат</div>
            <div className=\"text-sm\">Создайте первую комнату!</div>
          </div>
        ) : (
          комнаты.map(комната => (
            <div
              key={комната.id}
              className={`
                bg-white dark:bg-gray-800 p-4 rounded-lg border-2 transition-all cursor-pointer
                ${комната.участники.includes(пользователь.id) 
                  ? 'border-green-400 bg-green-50 dark:bg-green-900' 
                  : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                }
              `}
              onClick={() => обработать_присоединение(комната)}
            >
              <div className=\"flex items-center justify-between\">
                <div className=\"flex-1\">
                  <div className=\"flex items-center space-x-2\">
                    <h3 className=\"font-bold text-gray-800 dark:text-white\">
                      {комната.название}
                    </h3>
                    {комната.приватная && (
                      <span className=\"text-yellow-600 dark:text-yellow-400\">🔒</span>
                    )}
                    {комната.участники.includes(пользователь.id) && (
                      <span className=\"text-green-600 dark:text-green-400\">✅</span>
                    )}
                  </div>
                  
                  <div className=\"text-sm text-gray-600 dark:text-gray-300 mt-1\">
                    👥 {комната.участники.length} / {комната.максимум_участников} участников
                  </div>
                  
                  <div className=\"text-xs text-gray-500 dark:text-gray-400 mt-1\">
                    Создана: {new Date(комната.создана).toLocaleString('ru-RU')}
                  </div>
                </div>
                
                <div className=\"text-right\">
                  {комната.участники.length >= комната.максимум_участников ? (
                    <div className=\"bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-3 py-1 rounded-full text-sm\">
                      Переполнена
                    </div>
                  ) : (
                    <div className=\"bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-full text-sm\">
                      🚪 Войти
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};