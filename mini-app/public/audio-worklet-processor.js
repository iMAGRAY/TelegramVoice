// AudioWorklet процессор для анализа речи (замена ScriptProcessorNode)
class VoiceAnalyzerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.smoothingTimeConstant = 0.8;
    this.fftSize = 1024;
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.lastAnalysisTime = 0;
    this.analysisInterval = 100; // Анализируем каждые 100мс
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    if (input.length > 0) {
      const inputChannel = input[0];
      
      // Заполняем буфер
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex] = inputChannel[i];
        this.bufferIndex = (this.bufferIndex + 1) % this.bufferSize;
      }
      
      // Анализируем с интервалом
      const currentTime = Date.now();
      if (currentTime - this.lastAnalysisTime > this.analysisInterval) {
        const average = this.analyzeBuffer();
        
        // Отправляем результат в основной поток
        this.port.postMessage({
          type: 'analysis',
          average: average,
          timestamp: currentTime
        });
        
        this.lastAnalysisTime = currentTime;
      }
    }
    
    // Передаем аудио дальше без изменений
    if (outputs[0].length > 0) {
      outputs[0][0].set(input[0] || new Float32Array(128));
    }
    
    return true;
  }
  
  analyzeBuffer() {
    // Простой анализ громкости (RMS)
    let sum = 0;
    for (let i = 0; i < this.bufferSize; i++) {
      sum += this.buffer[i] * this.buffer[i];
    }
    const rms = Math.sqrt(sum / this.bufferSize);
    
    // Преобразуем в диапазон, аналогичный AnalyserNode
    return rms * 100;
  }
}

registerProcessor('voice-analyzer-processor', VoiceAnalyzerProcessor);