import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 動態模式配置 - 支援 API 路由和伺服器端功能
  
  // 圖片優化設定
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.google.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '/favicon.ico',
      },
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '/favicon.png',
      },
      {
        protocol: 'https',
        hostname: 'www.google.com',
        port: '',
        pathname: '/s2/favicons**',
      },
    ],
  },
  
  // 其他配置
  experimental: {
    // 實驗性功能
  }
};

export default nextConfig;
