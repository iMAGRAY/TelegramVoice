import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Убираем статический экспорт для корректной работы React хуков
  // output: 'export', // ОТКЛЮЧЕНО - мешает инициализации  
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Настройки для Telegram Mini App
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://web.telegram.org",
          },
        ],
      },
    ];
  },
  // Поддержка HTTPS для Telegram Mini App
  experimental: {
    forceSwcTransforms: true,
  },
};

export default nextConfig;
