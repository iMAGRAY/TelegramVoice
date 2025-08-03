'use client';

import React from 'react';
import { Комната, Пользователь } from '@/types';
import { Users, Lock, Radio } from 'lucide-react';

interface RoomsListProps {
  комнаты: Комната[];
  пользователь: Пользователь;
  на_присоединение: (комната_id: string, пароль?: string) => void;
  загружается: boolean;
  на_открыть_настройки?: () => void;
}

export const SimpleRoomsList: React.FC<RoomsListProps> = ({
  комнаты,
  пользователь,
  на_присоединение,
  загружается,
  на_открыть_настройки
}) => {

  if (загружается) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[var(--text-secondary)]">Подключение...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Заголовок */}
      <header className="border-b border-[var(--border-color)] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Голосовые комнаты</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Выберите комнату для голосового общения
            </p>
          </div>
          {на_открыть_настройки && (
            <button
              onClick={на_открыть_настройки}
              className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
              title="Настройки"
            >
              <svg className="w-6 h-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Информация о пользователе */}
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center gap-3 p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)]">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-secondary)]">
            {пользователь.имя.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-[var(--text-primary)]">{пользователь.имя}</div>
            <div className="text-sm text-[var(--text-tertiary)]">В сети</div>
          </div>
        </div>
      </div>

      {/* Список комнат */}
      <div className="max-w-4xl mx-auto px-6">
        <div className="space-y-2">
          {комнаты.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-tertiary)]">
              <Radio className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <div>Подключение к серверу...</div>
            </div>
          ) : (
            комнаты.map(комната => (
              <button
                key={комната.id}
                onClick={() => на_присоединение(комната.id)}
                className="w-full group hover:bg-[var(--bg-hover)] p-4 rounded-lg border border-[var(--border-color)] 
                         hover:border-[var(--border-hover)] transition-all duration-200 text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-[var(--text-primary)]">
                        {комната.название}
                      </h3>
                      {комната.приватная && (
                        <Lock className="w-4 h-4 text-[var(--text-tertiary)]" />
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-[var(--text-secondary)] flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {комната.участники.length} / {комната.максимум_участников}
                      </span>
                    </div>
                  </div>
                  <div className="text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                    Войти →
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};