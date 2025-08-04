'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Trash2, Download } from 'lucide-react';

interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

interface DebugModalProps {
  открыт: boolean;
  на_закрыть: () => void;
}

export const DebugModal: React.FC<DebugModalProps> = ({ открыт, на_закрыть }) => {
  const [логи, setЛоги] = useState<LogEntry[]>([]);
  const [авто_скролл, setАвто_скролл] = useState(true);
  const логи_контейнер_ref = useRef<HTMLDivElement>(null);
  const оригинальный_console_ref = useRef<{
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
  }>();

  // Перехватываем console методы
  useEffect(() => {
    // Сохраняем оригинальные методы
    if (!оригинальный_console_ref.current) {
      оригинальный_console_ref.current = {
        log: console.log,
        warn: console.warn,
        error: console.error
      };
    }

    const добавить_лог = (level: LogEntry['level'], args: any[]) => {
      const message = args
        .map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg))
        .join(' ');
      
      const новый_лог: LogEntry = {
        timestamp: Date.now(),
        level,
        message,
        data: args.length === 1 && typeof args[0] === 'object' ? args[0] : undefined
      };

      setЛоги(prev => [...prev.slice(-999), новый_лог]); // Ограничиваем до 1000 записей
    };

    // Перехватываем console методы
    console.log = (...args) => {
      оригинальный_console_ref.current!.log(...args);
      добавить_лог('info', args);
    };

    console.warn = (...args) => {
      оригинальный_console_ref.current!.warn(...args);
      добавить_лог('warn', args);
    };

    console.error = (...args) => {
      оригинальный_console_ref.current!.error(...args);
      добавить_лог('error', args);
    };

    return () => {
      // Восстанавливаем оригинальные методы при размонтировании
      if (оригинальный_console_ref.current) {
        console.log = оригинальный_console_ref.current.log;
        console.warn = оригинальный_console_ref.current.warn;
        console.error = оригинальный_console_ref.current.error;
      }
    };
  }, []);

  // Авто-скролл при добавлении новых логов
  useEffect(() => {
    if (авто_скролл && логи_контейнер_ref.current) {
      логи_контейнер_ref.current.scrollTop = логи_контейнер_ref.current.scrollHeight;
    }
  }, [логи, авто_скролл]);

  const скопировать_логи = async () => {
    const текст_логов = логи
      .map(лог => `[${new Date(лог.timestamp).toLocaleTimeString()}] ${лог.level.toUpperCase()}: ${лог.message}`)
      .join('\n');
    
    try {
      await navigator.clipboard.writeText(текст_логов);
      console.log('Логи скопированы в буфер обмена');
    } catch (error) {
      console.error('Ошибка копирования логов:', error);
    }
  };

  const скачать_логи = () => {
    const текст_логов = логи
      .map(лог => `[${new Date(лог.timestamp).toISOString()}] ${лог.level.toUpperCase()}: ${лог.message}`)
      .join('\n');
    
    const blob = new Blob([текст_логов], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telegram-voice-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const очистить_логи = () => {
    setЛоги([]);
  };

  const получить_цвет_уровня = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      default:
        return 'text-gray-300';
    }
  };

  const получить_фон_уровня = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'bg-red-900/20';
      case 'warn':
        return 'bg-yellow-900/20';
      default:
        return '';
    }
  };

  if (!открыт) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white">🐛 Debug Console</h2>
            <div className="text-sm text-gray-400">
              {логи.length} записей
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={авто_скролл}
                onChange={(e) => setАвто_скролл(e.target.checked)}
                className="rounded"
              />
              Авто-скролл
            </label>
            <button
              onClick={скопировать_логи}
              className="p-2 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors"
              title="Скопировать логи"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={скачать_логи}
              className="p-2 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors"
              title="Скачать логи"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={очистить_логи}
              className="p-2 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors"
              title="Очистить логи"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={на_закрыть}
              className="p-2 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Контент логов */}
        <div 
          ref={логи_контейнер_ref}
          className="flex-1 overflow-auto p-4 font-mono text-sm bg-black"
          style={{ maxHeight: 'calc(90vh - 120px)' }}
        >
          {логи.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              Логи появятся здесь...
            </div>
          ) : (
            <div className="space-y-1">
              {логи.map((лог, index) => (
                <div 
                  key={index} 
                  className={`p-2 rounded text-xs ${получить_фон_уровня(лог.level)}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 shrink-0">
                      {new Date(лог.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`font-bold shrink-0 ${получить_цвет_уровня(лог.level)}`}>
                      [{лог.level.toUpperCase()}]
                    </span>
                    <span className={получить_цвет_уровня(лог.level)} style={{ wordBreak: 'break-word' }}>
                      {лог.message}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Футер с информацией */}
        <div className="p-3 border-t border-gray-700 text-xs text-gray-400 bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              Нажмите F12 для закрытия • ESC для закрытия • Ctrl+C для копирования
            </div>
            <div>
              Telegram Mini App Debug Console
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};