module.exports = {
  apps: [
    {
      name: 'websocket-server',
      script: 'npm',
      args: 'start',
      cwd: '/root/TelegramVoice/websocket-server',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/root/TelegramVoice/logs/websocket-server-error.log',
      out_file: '/root/TelegramVoice/logs/websocket-server-out.log',
      log_file: '/root/TelegramVoice/logs/websocket-server-combined.log',
      time: true,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'frontend',
      script: 'serve',
      args: '-s out -l 3000',
      cwd: '/root/TelegramVoice/mini-app',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/root/TelegramVoice/logs/frontend-error.log',
      out_file: '/root/TelegramVoice/logs/frontend-out.log',
      log_file: '/root/TelegramVoice/logs/frontend-combined.log',
      time: true,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
