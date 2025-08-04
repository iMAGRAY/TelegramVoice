// Утилита логирования с поддержкой production режима

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// Типы логов
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  showInProduction: boolean;
  showInDevelopment: boolean;
  prefix?: string;
  color?: string;
}

const LOG_CONFIGS: Record<LogLevel, LogConfig> = {
  debug: {
    showInProduction: false,
    showInDevelopment: true,
    prefix: '🔍',
    color: '#6B7280'
  },
  info: {
    showInProduction: false,
    showInDevelopment: true,
    prefix: 'ℹ️',
    color: '#3B82F6'
  },
  warn: {
    showInProduction: true,
    showInDevelopment: true,
    prefix: '⚠️',
    color: '#F59E0B'
  },
  error: {
    showInProduction: true,
    showInDevelopment: true,
    prefix: '❌',
    color: '#EF4444'
  }
};

class Logger {
  private shouldLog(level: LogLevel): boolean {
    const config = LOG_CONFIGS[level];
    
    if (IS_PRODUCTION) {
      return config.showInProduction;
    }
    
    if (IS_DEVELOPMENT) {
      return config.showInDevelopment;
    }
    
    return true; // Показываем все в других режимах
  }

  private formatMessage(level: LogLevel, component: string, message: string): string {
    const config = LOG_CONFIGS[level];
    const timestamp = new Date().toLocaleTimeString();
    return `${config.prefix} [${timestamp}] [${component}] ${message}`;
  }

  debug(component: string, message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', component, message), ...args);
    }
  }

  info(component: string, message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', component, message), ...args);
    }
  }

  warn(component: string, message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', component, message), ...args);
    }
  }

  error(component: string, message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', component, message), ...args);
    }
  }

  // Для совместимости с существующим кодом
  log(component: string, message: string, ...args: any[]): void {
    this.info(component, message, ...args);
  }
}

export const logger = new Logger();
export default logger;