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
      
      worklet_node_ref.current.disconnect();
      worklet_node_ref.current = null;
    }
    
    if (source_node_ref.current) {
      source_node_ref.current.disconnect();
      source_node_ref.current = null;
    }
    
    if (audio_context_ref.current && audio_context_ref.current.state !== 'closed') {
      audio_context_ref.current.close();
      audio_context_ref.current = null;
    }
  }, []);

  const setupAnalyzer = useCallback(async () => {
    if (!поток) return;

    try {
      // Создаем AudioContext
      const audio_context = new AudioContext();
      audio_context_ref.current = audio_context;

      // Загружаем AudioWorklet
      try {
        await audio_context.audioWorklet.addModule('/audio-worklet-processor.js');
      } catch (error) {
        // Fallback на простой AnalyserNode без ScriptProcessorNode
        setupAnalyserFallback(audio_context);
        return;
      }

      // Создаем узлы
      const source = audio_context.createMediaStreamSource(поток);
      const worklet_node = new AudioWorkletNode(audio_context, 'voice-analyzer-processor');
      
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

      // Подключаем узлы
      source.connect(worklet_node);
      worklet_node.connect(audio_context.destination);

    } catch (error) {
      // Fallback на простой AnalyserNode если не удалось создать AudioWorklet
      if (audio_context_ref.current) {
        setupAnalyserFallback(audio_context_ref.current);
      }
    }
  }, [поток, микрофон_включен, на_изменение_речи, порог_речи, cleanup]);

  // Современный fallback с AnalyserNode и requestAnimationFrame
  const setupAnalyserFallback = useCallback((audio_context: AudioContext) => {
    if (!поток) return;

    try {
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
    if (поток) {
      setupAnalyzer();
    } else {
      cleanup();
    }

    return cleanup;
  }, [поток, setupAnalyzer, cleanup]);

  // Очистка при размонтировании
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    cleanup
  };
};