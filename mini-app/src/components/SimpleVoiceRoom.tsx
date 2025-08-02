'use client';

import React, { useState } from 'react';
import { Пользователь, Комната } from '@/types';

interface VoiceRoomProps {
  комната: Комната;
  текущий_пользователь: Пользователь;
  socket: any;
  на_покинуть_комнату: () => void;
}

export const SimpleVoiceRoom: React.FC<VoiceRoomProps> = ({
  комната,
  текущий_пользователь,
  socket,
  на_покинуть_комнату
}) => {
  const [микрофон_включен, setМикрофон_включен] = useState(true);
  const [участники] = useState<Пользователь[]>([текущий_пользователь]);

  const обработать_переключение_микрофона = () => {
    setМикрофон_включен(!микрофон_включен);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 shadow-md p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">{комната.название}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {участники.length} / {комната.максимум_участников} участников
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={на_покинуть_комнату}
              className="p-2 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-lg"
            >
              ❌
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-4">
          {участники.map(участник => (
            <div
              key={участник.id}
              className="relative p-4 rounded-xl bg-white dark:bg-gray-800 shadow-md"
            >
              <div className="text-center">
                <div className="text-2xl mb-2">
                  {участник.аватар || '👤'}
                </div>
                <div className="font-medium text-gray-800 dark:text-white text-sm">
                  {участник.имя}
                  {участник.id === текущий_пользователь.id && ' (Вы)'}
                </div>
                
                <div className="mt-2 flex justify-center">
                  <span className={`text-lg ${участник.микрофон_включен ? 'text-green-500' : 'text-red-500'}`}>
                    {участник.микрофон_включен ? '🎤' : '🔇'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 border-t">
        <div className="flex justify-center">
          <button
            onClick={обработать_переключение_микрофона}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all duration-200 ${
              микрофон_включен 
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white'
            } shadow-lg hover:shadow-xl`}
          >
            {микрофон_включен ? '🎤' : '🔇'}
          </button>
        </div>
        
        <div className="mt-2 text-center text-xs text-gray-600 dark:text-gray-400">
          Нажмите для {микрофон_включен ? 'выключения' : 'включения'} микрофона
        </div>
      </div>
    </div>
  );
};