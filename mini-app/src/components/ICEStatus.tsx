'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';
import { диагностировать_ice_серверы, определить_тип_nat } from '@/utils/iceDiagnostics';

interface ICEStatusProps {
  показать_подробности?: boolean;
}

export const ICEStatus: React.FC<ICEStatusProps> = ({ показать_подробности = false }) => {
  const [состояние, setСостояние] = useState<'проверка' | 'отлично' | 'хорошо' | 'плохо'>('проверка');
  const [тип_nat, setТип_nat] = useState<string>('');
  const [рекомендации, setРекомендации] = useState<string[]>([]);
  const [развернуто, setРазвернуто] = useState(false);

  const запустить_проверку = async () => {
    try {
      const результат = await диагностировать_ice_серверы();
      setСостояние(результат.общее_состояние);
      setРекомендации(результат.рекомендации);
      
      // Определяем тип NAT
      const nat = await определить_тип_nat();
      setТип_nat(nat);
    } catch (error) {
      setСостояние('плохо');
      setРекомендации(['Не удалось проверить соединение']);
    }
  };

  useEffect(() => {
    // Запускаем диагностику только один раз при монтировании
    let отменено = false;
    
    const запуск = async () => {
      await запустить_проверку();
      if (!отменено) {
        // Повторяем диагностику каждые 30 секунд, только если компонент не отмонтирован
        const интервал = setInterval(async () => {
          if (!отменено) {
            await запустить_проверку();
          }
        }, 30000);
        
        return () => {
          clearInterval(интервал);
        };
      }
    };
    
    запуск();
    
    return () => {
      отменено = true;
    };
  }, []);


  const получить_иконку = () => {
    switch (состояние) {
      case 'отлично':
        return <CheckCircle className="w-4 h-4 text-[var(--success)]" />;
      case 'хорошо':
        return <Wifi className="w-4 h-4 text-[var(--warning)]" />;
      case 'плохо':
        return <WifiOff className="w-4 h-4 text-[var(--danger)]" />;
      default:
        return <AlertCircle className="w-4 h-4 text-[var(--text-tertiary)] animate-pulse" />;
    }
  };

  const получить_текст_состояния = () => {
    switch (состояние) {
      case 'отлично':
        return 'Отличное соединение';
      case 'хорошо':
        return 'Хорошее соединение';
      case 'плохо':
        return 'Проблемы с соединением';
      default:
        return 'Проверка соединения...';
    }
  };

  if (!показать_подробности) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        {получить_иконку()}
        <span>{получить_текст_состояния()}</span>
      </div>
    );
  }

  return (
    <div className="border border-[var(--border-color)] rounded-lg p-3 bg-[var(--bg-secondary)]">
      <button
        onClick={() => setРазвернуто(!развернуто)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          {получить_иконку()}
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {получить_текст_состояния()}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${развернуто ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {развернуто && (
        <div className="mt-3 space-y-2">
          {тип_nat && (
            <div className="text-xs text-[var(--text-secondary)]">
              <span className="font-medium">Тип NAT:</span> {тип_nat}
            </div>
          )}
          
          {рекомендации.length > 0 && (
            <div className="space-y-1">
              {рекомендации.map((рек, idx) => (
                <div key={idx} className="text-xs text-[var(--text-secondary)]">
                  {рек}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              setСостояние('проверка');
              запустить_проверку();
            }}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Проверить снова
          </button>
        </div>
      )}
    </div>
  );
};