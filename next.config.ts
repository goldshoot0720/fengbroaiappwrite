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
        pathname: '/**',
      },
    ],
  },

  // 添加正確的 MIME type 給 .mjs 檔案
  async headers() {
    return [
      {
        source: '/pdf.worker.min.mjs',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
        ],
      },
    ];
  },
  
  // 其他配置
  experimental: {
    // 實驗性功能
  }
};

export default nextConfig;
