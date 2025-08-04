import { useEffect, useRef, useCallback } from 'react';

interface VoiceAnalyzerOptions {
  поток: MediaStream | null;
  микрофон_включен: boolean;
  на_изменение_речи: (говорит: boolean) => void;
  порог_речи?: number;
}

export const useVoiceAnalyzer = ({
  поток,
  микрофон_включен,
  на_изменение_речи,
  порог_речи = 30
}: VoiceAnalyzerOptions) => {
  const audio_context_ref = useRef<AudioContext | null>(null);
  const worklet_node_ref = useRef<AudioWorkletNode | null>(null);
  const source_node_ref = useRef<MediaStreamAudioSourceNode | null>(null);
  const говорит_ref = useRef(false);

  const cleanup = useCallback(() => {
    // Очищаем ресурсы
    if (worklet_node_ref.current) {
      // Проверяем есть ли ID анимации для fallback
      const анимация_id = (worklet_node_ref.current as any)._animationId;
      if (анимация_id) {
        cancelAnimationFrame(анимация_id);
      }
      
      try {
        worklet_node_ref.current.disconnect();
      } catch (e) {
        // Игнорируем ошибки отключения
      }
      worklet_node_ref.current = null;
    }
    
    if (source_node_ref.current) {
      try {
        source_node_ref.current.disconnect();
      } catch (e) {
        // Игнорируем ошибки отключения
      }
      source_node_ref.current = null;
    }
    
    if (audio_context_ref.current && audio_context_ref.current.state !== 'closed') {
      audio_context_ref.current.close().catch(() => {
        // Игнорируем ошибки закрытия
      });
      audio_context_ref.current = null;
    }
  }, []);

  const setupAnalyzer = useCallback(async () => {
    if (!поток) return;

    // Очищаем предыдущие ресурсы перед созданием новых
    cleanup();

    try {
      // Проверяем состояние существующего контекста
      if (audio_context_ref.current && audio_context_ref.current.state === 'closed') {
        audio_context_ref.current = null;
      }
      
      // Создаем AudioContext только если его нет
      if (!audio_context_ref.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) {
          console.warn('[VoiceAnalyzer] AudioContext не поддерживается, переходим к fallback');
          setupAnalyserFallback(null as any);
          return;
        }
        
        try {
          const audio_context = new AudioContext();
          audio_context_ref.current = audio_context;
          
          // Обработчик изменения состояния контекста
          audio_context.addEventListener('statechange', () => {
            console.log(`[VoiceAnalyzer] AudioContext состояние изменилось: ${audio_context.state}`);
            
            if (audio_context.state === 'suspended') {
              console.log('[VoiceAnalyzer] AudioContext приостановлен, попытка возобновления...');
              audio_context.resume().catch(error => {
                console.error('[VoiceAnalyzer] Не удалось возобновить AudioContext:', error);
              });
            }
          });
          
        } catch (error) {
          console.error('[VoiceAnalyzer] Ошибка создания AudioContext:', error);
          setupAnalyserFallback(null as any);
          return;
        }
      }
      
      // Проверяем что контекст не закрыт
      if (audio_context_ref.current.state === 'closed') {
        console.warn('[VoiceAnalyzer] AudioContext закрыт, не можем анализировать аудио');
        return;
      }
      
      // Попытка возобновить приостановленный контекст
      if (audio_context_ref.current.state === 'suspended') {
        console.log('[VoiceAnalyzer] AudioContext приостановлен, попытка возобновления...');
        try {
          await audio_context_ref.current.resume();
          console.log('[VoiceAnalyzer] AudioContext успешно возобновлен');
        } catch (error) {
          console.error('[VoiceAnalyzer] Не удалось возобновить AudioContext:', error);
          return;
        }
      }

      // Загружаем AudioWorklet
      try {
        await audio_context_ref.current.audioWorklet.addModule('/audio-worklet-processor.js');
      } catch (error) {
        // Fallback на простой AnalyserNode без ScriptProcessorNode
        setupAnalyserFallback(audio_context_ref.current);
        return;
      }

      // Создаем узлы
      const source = audio_context_ref.current.createMediaStreamSource(поток);
      const worklet_node = new AudioWorkletNode(audio_context_ref.current, 'voice-analyzer-processor');
      
      source_node_ref.current = source;
      worklet_node_ref.current = worklet_node;

      // Обработчик сообщений от worklet
      worklet_node.port.onmessage = (event) => {
        if (event.data.type === 'analysis') {
          const average = event.data.average;
          const новое_состояние_речи = микрофон_включен && average > порог_речи;
          
          if (новое_состояние_речи !== говорит_ref.current) {
            говорит_ref.current = новое_состояние_речи;
            на_изменение_речи(новое_состояние_речи);
          }
        }
      };

      // Подключаем узлы - ИСПРАВЛЕНИЕ: НЕ подключаем к destination чтобы избежать петли обратной связи
      source.connect(worklet_node);
      // worklet_node НЕ подключаем к destination - только анализируем аудио без воспроизведения

    } catch (error) {
      // Fallback на простой AnalyserNode если не удалось создать AudioWorklet
      if (audio_context_ref.current) {
        setupAnalyserFallback(audio_context_ref.current);
      }
    }
  }, [поток, микрофон_включен, на_изменение_речи, порог_речи, cleanup]);

  // Современный fallback с AnalyserNode и requestAnimationFrame
  const setupAnalyserFallback = useCallback((audio_context: AudioContext | null) => {
    if (!поток) return;

    try {
      // Если контекст null, создаем новый для fallback
      if (!audio_context) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) {
          console.warn('[VoiceAnalyzer] Fallback: AudioContext не поддерживается совсем');
          return;
        }
        
        try {
          audio_context = new AudioContext();
          audio_context_ref.current = audio_context;
        } catch (error) {
          console.error('[VoiceAnalyzer] Fallback: Не удалось создать AudioContext:', error);
          return;
        }
      }
      
      // Проверяем что контекст не закрыт
      if (audio_context.state === 'closed') {
        console.warn('[VoiceAnalyzer] Fallback: AudioContext закрыт');
        return;
      }
      
      // Попытка возобновить приостановленный контекст
      if (audio_context.state === 'suspended') {
        console.log('[VoiceAnalyzer] Fallback: AudioContext приостановлен, попытка возобновления...');
        audio_context.resume().catch(error => {
          console.error('[VoiceAnalyzer] Fallback: Не удалось возобновить AudioContext:', error);
        });
      }
      
      const source = audio_context.createMediaStreamSource(поток);
      const analyser = audio_context.createAnalyser();
      
      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;
      
      source.connect(analyser);
      
      source_node_ref.current = source;
      worklet_node_ref.current = analyser as any; // Для совместимости с cleanup
      
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let анимация_id: number;
      
      const analyzeAudio = () => {
        if (!analyser) return;
        
        analyser.getByteFrequencyData(buffer);
        const average = buffer.reduce((a, b) => a + b) / buffer.length;
        const новое_состояние_речи = микрофон_включен && average > порог_речи;
        
        if (новое_состояние_речи !== говорит_ref.current) {
          говорит_ref.current = новое_состояние_речи;
          на_изменение_речи(новое_состояние_речи);
        }
        
        // Используем requestAnimationFrame вместо ScriptProcessorNode
        анимация_id = requestAnimationFrame(analyzeAudio);
        
        // Обновляем сохраненный ID для очистки
        (analyser as any)._animationId = анимация_id;
      };
      
      analyzeAudio();
      
    } catch (error) {
      // Ничего не делаем - анализ речи просто не будет работать
    }
  }, [поток, микрофон_включен, на_изменение_речи, порог_речи]);

  // Настраиваем анализатор при изменении потока
  useEffect(() => {
    let таймаут: NodeJS.Timeout;
    
    if (поток) {
      // Добавляем небольшую задержку чтобы избежать множественных вызовов
      таймаут = setTimeout(() => {
        setupAnalyzer();
      }, 100);
    } else {
      cleanup();
    }

    return () => {
      clearTimeout(таймаут);
      cleanup();
    };
  }, [поток]); // Убираем setupAnalyzer и cleanup из зависимостей

  return {
    cleanup
  };
};