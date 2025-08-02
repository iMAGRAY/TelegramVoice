module.exports = {
  apps: [
    {
      name: 'rust-websocket',
      script: '/root/TelegramVoice/signaling-server/target/release/signaling-server',
      cwd: '/root/TelegramVoice/signaling-server',
      env: {
        RUST_LOG: 'info'
      },
      error_file: '/root/TelegramVoice/logs/rust-websocket-error.log',
      out_file: '/root/TelegramVoice/logs/rust-websocket-out.log',
      log_file: '/root/TelegramVoice/logs/rust-websocket-combined.log',
      time: true
    },
    {
      name: 'nextjs-static',
      script: 'serve',
      args: '-s out -l 3000',
      cwd: '/root/TelegramVoice/mini-app',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/root/TelegramVoice/logs/nextjs-error.log',
      out_file: '/root/TelegramVoice/logs/nextjs-out.log',
      log_file: '/root/TelegramVoice/logs/nextjs-combined.log',
      time: true
    }
  ]
};