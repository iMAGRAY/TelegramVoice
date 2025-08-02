'use client';

import React, { useState } from 'react';
import { Комната, Пользователь } from '@/types';

interface RoomsListProps {
  комнаты: Комната[];
  пользователь: Пользователь;
  на_присоединение: (комната_id: string, пароль?: string) => void;
  на_создание_комнаты: (название: string, максимум: number, приватная: boolean, пароль?: string) => void;
  загружается: boolean;
}

export const SimpleRoomsList: React.FC<RoomsListProps> = ({
  комнаты,
  пользователь,
  на_присоединение,
  на_создание_комнаты,
  загружается
}) => {
  const [показать_создание, setПоказать_создание] = useState(false);
  const [название_комнаты, setНазвание_комнаты] = useState('');

  const обработать_создание = () => {
    if (!название_комнаты.trim()) return;
    на_создание_комнаты(название_комнаты, 10, false);
    setНазвание_комнаты('');
    setПоказать_создание(false);
  };

  if (загружается) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-300">Загрузка комнат...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          🎤 Голосовые комнаты
        </h1>
        <button
          onClick={() => setПоказать_создание(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          ➕ Создать
        </button>
      </div>

      <div className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 p-4 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">{пользователь.аватар || '👤'}</div>
          <div>
            <div className="font-medium text-gray-800 dark:text-white">
              Привет, {пользователь.имя}!
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Выберите комнату для голосового общения
            </div>
          </div>
        </div>
      </div>

      {показать_создание && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-700 space-y-3">
          <h3 className="font-bold text-gray-800 dark:text-white">Создать новую комнату</h3>
          
          <input
            type="text"
            placeholder="Название комнаты"
            value={название_комнаты}
            onChange={(e) => setНазвание_комнаты(e.target.value)}
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
            maxLength={50}
          />

          <div className="flex space-x-2">
            <button
              onClick={обработать_создание}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg transition-colors"
            >
              ✅ Создать
            </button>
            <button
              onClick={() => setПоказать_создание(false)}
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors"
            >
              ❌ Отмена
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {комнаты.length === 0 ? (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">
            <div className="text-4xl mb-2">🏠</div>
            <div>Пока нет доступных комнат</div>
            <div className="text-sm">Создайте первую комнату!</div>
          </div>
        ) : (
          комнаты.map(комната => (
            <div
              key={комната.id}
              className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-all cursor-pointer"
              onClick={() => на_присоединение(комната.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-gray-800 dark:text-white">
                      {комната.название}
                    </h3>
                    {комната.приватная && (
                      <span className="text-yellow-600 dark:text-yellow-400">🔒</span>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    👥 {комната.участники.length} / {комната.максимум_участников} участников
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-full text-sm">
                    🚪 Войти
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};