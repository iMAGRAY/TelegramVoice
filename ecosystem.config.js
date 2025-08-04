module.exports = {
  apps: [
    {
      name: 'websocket-server',
      script: 'node',
      args: 'dist/index.js',
      cwd: '/root/TelegramVoice/websocket-server',
      env: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      error_file: '/root/TelegramVoice/logs/websocket-server-error.log',
      out_file: '/root/TelegramVoice/logs/websocket-server-out.log',
      log_file: '/root/TelegramVoice/logs/websocket-server-combined.log',
      time: true,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 3,
      min_uptime: '10s',
      restart_delay: 5000
    },
    {
      name: 'frontend',
      script: 'http-server',
      args: ['out', '-p', '3000'],
      cwd: '/root/TelegramVoice/mini-app',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/root/TelegramVoice/logs/frontend-error.log',
      out_file: '/root/TelegramVoice/logs/frontend-out.log',
      log_file: '/root/TelegramVoice/logs/frontend-combined.log',
      time: true,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 3,
      min_uptime: '10s',
      restart_delay: 5000
    }
  ]
};
