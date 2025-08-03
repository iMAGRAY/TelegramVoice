module.exports = {
  apps: [
    {
      name: 'signaling-server',
      script: '/root/TelegramVoice/signaling-server/target/release/signaling-server',
      cwd: '/root/TelegramVoice/signaling-server',
      env: {
        RUST_LOG: 'info'
      },
      error_file: '/root/TelegramVoice/logs/signaling-server-error.log',
      out_file: '/root/TelegramVoice/logs/signaling-server-out.log',
      log_file: '/root/TelegramVoice/logs/signaling-server-combined.log',
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
