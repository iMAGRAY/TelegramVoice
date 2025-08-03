'use client';

import React from 'react';

interface PermissionBlockedHelpProps {
  открыт: boolean;
  на_закрыть: () => void;
}

export const PermissionBlockedHelp: React.FC<PermissionBlockedHelpProps> = ({
  открыт,
  на_закрыть
}) => {
  if (!открыт) return null;

  const скопировать_url = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-primary)] rounded-lg shadow-lg max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            🔒 Как разрешить доступ к микрофону
          </h3>
          <button
            onClick={на_закрыть}
            className="p-1 hover:bg-[var(--bg-hover)] rounded"
          >
            <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 text-sm">
          {/* Быстрый способ */}
          <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
            <h4 className="font-medium text-[var(--text-primary)] mb-2">🚀 Быстрый способ:</h4>
            <ol className="space-y-1 text-[var(--text-secondary)]">
              <li>1. Найдите иконку 🔒 или ⓘ в адресной строке браузера</li>
              <li>2. Нажмите на неё</li>
              <li>3. Найдите "Микрофон" и выберите "Разрешить"</li>
              <li>4. Обновите страницу (F5)</li>
            </ol>
          </div>

          {/* Для разных браузеров */}
          <div className="space-y-3">
            <h4 className="font-medium text-[var(--text-primary)]">📱 Инструкции по браузерам:</h4>
            
            {/* Chrome */}
            <details className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <summary className="font-medium text-[var(--text-primary)] cursor-pointer">
                🌐 Google Chrome
              </summary>
              <div className="mt-2 space-y-1 text-[var(--text-secondary)]">
                <p>• Нажмите на иконку замка 🔒 рядом с адресом</p>
                <p>• Или перейдите в: Настройки → Конфиденциальность → Настройки сайта → Микрофон</p>
                <p>• Найдите наш сайт в "Заблокированные" и переместите в "Разрешённые"</p>
              </div>
            </details>

            {/* Firefox */}
            <details className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <summary className="font-medium text-[var(--text-primary)] cursor-pointer">
                🦊 Mozilla Firefox
              </summary>
              <div className="mt-2 space-y-1 text-[var(--text-secondary)]">
                <p>• Нажмите на иконку щита 🛡️ в адресной строке</p>
                <p>• Или: Настройки → Приватность → Разрешения → Микрофон</p>
                <p>• Найдите наш сайт и измените разрешение на "Разрешить"</p>
              </div>
            </details>

            {/* Safari */}
            <details className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <summary className="font-medium text-[var(--text-primary)] cursor-pointer">
                🧭 Safari
              </summary>
              <div className="mt-2 space-y-1 text-[var(--text-secondary)]">
                <p>• Safari → Настройки → Веб-сайты → Микрофон</p>
                <p>• Найдите наш сайт и выберите "Разрешить"</p>
                <p>• Обновите страницу</p>
              </div>
            </details>

            {/* Mobile browsers */}
            <details className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <summary className="font-medium text-[var(--text-primary)] cursor-pointer">
                📱 Мобильные браузеры
              </summary>
              <div className="mt-2 space-y-1 text-[var(--text-secondary)]">
                <p><strong>Chrome Mobile:</strong> Нажмите на иконку замка → Разрешения → Микрофон</p>
                <p><strong>Safari iOS:</strong> Настройки → Safari → Микрофон</p>
                <p><strong>Firefox Mobile:</strong> Меню → Настройки → Разрешения сайтов</p>
              </div>
            </details>
          </div>

          {/* Дополнительная информация */}
          <div className="p-3 bg-[var(--warning)] bg-opacity-10 border border-[var(--warning)] rounded-lg">
            <h4 className="font-medium text-[var(--warning)] mb-2">⚠️ Важно:</h4>
            <ul className="space-y-1 text-[var(--text-secondary)] text-xs">
              <li>• Разрешения нужно давать каждому сайту отдельно</li>
              <li>• После изменения настроек обязательно обновите страницу</li>
              <li>• В режиме инкогнито разрешения не сохраняются</li>
              <li>• Некоторые корпоративные сети могут блокировать микрофон</li>
            </ul>
          </div>

          {/* Кнопка копирования URL */}
          <div className="flex items-center gap-2 p-3 bg-[var(--bg-secondary)] rounded-lg">
            <span className="text-[var(--text-secondary)] text-xs flex-1">
              Если ничего не помогает, скопируйте ссылку и откройте в другом браузере:
            </span>
            <button
              onClick={скопировать_url}
              className="px-3 py-1 bg-[var(--accent)] text-white text-xs rounded hover:opacity-90"
            >
              Копировать ссылку
            </button>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={на_закрыть}
            className="flex-1 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};