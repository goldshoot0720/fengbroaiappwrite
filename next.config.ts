import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 動態模式配置 - 支援 API 路由和伺服器端功能

  // face-api is browser-only (media tools). Do NOT transpile
  // @huggingface/transformers — Next Client SSR would pick transformers.node.mjs
  // and fail resolving onnxruntime WASM/WebGPU assets under Turbopack.
  transpilePackages: ["@vladmandic/face-api"],

  // Prefer browser build if anything still resolves the package during bundling.
  turbopack: {
    resolveAlias: {
      "@huggingface/transformers":
        "./node_modules/@huggingface/transformers/dist/transformers.web.js",
    },
  },

  // Keep ffmpeg/ffprobe installer binaries in the youtube convert serverless bundle.
  outputFileTracingIncludes: {
    "/api/youtube-bilibili-convert": [
      "./node_modules/@ffmpeg-installer/**/*",
      "./node_modules/@ffprobe-installer/**/*",
      "./.vendor/yt-dlp/**/*",
      "./.vendor/ffmpeg/**/*",
    ],
  },

  // 圖片優化設定
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.google.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**",
        port: "",
        pathname: "/**",
      },
    ],
  },

  // 添加正確的 MIME type 給 .mjs 檔案
  async headers() {
    return [
      {
        source: "/pdf.worker.min.mjs",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
    ];
  },

  // 其他配置
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
