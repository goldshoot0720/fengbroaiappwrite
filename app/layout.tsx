import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#3b82f6",
};

export const metadata: Metadata = {
  title: "鋒兄AI Appwrite",
  description: "鋒兄管理資訊系統，幫助您輕鬆管理食品庫存和訂閱服務，避免浪費並控制支出。",
  keywords: "食品管理, 訂閱管理, 庫存管理, 過期提醒, 支出控制, Next.js",
  authors: [{ name: "鋒兄塗哥公關資訊" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

  return (
    <html lang="zh-TW" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/apple-touch-icon.png" type="image/png" sizes="180x180" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="鋒兄AI Appwrite" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              var VAPID_PUBLIC_KEY = ${JSON.stringify(vapidPublicKey)};

              // 訂閱 Web Push（僅在已授權通知時執行）
              async function subscribeToPush(registration) {
                if (!('pushManager' in registration)) return;
                if (!('Notification' in window)) return;
                if (Notification.permission !== 'granted') return;
                if (!VAPID_PUBLIC_KEY) return;
                try {
                  var sub = await registration.pushManager.getSubscription();
                  if (!sub) {
                    sub = await registration.pushManager.subscribe({
                      userVisibleOnly: true,
                      applicationServerKey: VAPID_PUBLIC_KEY,
                    });
                  }
                  if (sub) {
                    await fetch('/api/push-subscribe', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(sub.toJSON()),
                    });
                  }
                } catch (e) {
                  console.error('[SW] Push subscribe error:', e);
                }
              }

              if ('serviceWorker' in navigator) {
                window.addEventListener('load', async function() {
                  try {
                    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

                    // 傳送 Appwrite config 給 Service Worker 供背景任務使用
                    function sendConfigToSW(registration) {
                      const config = {
                        endpoint: localStorage.getItem('NEXT_PUBLIC_APPWRITE_ENDPOINT') || '',
                        projectId: localStorage.getItem('NEXT_PUBLIC_APPWRITE_PROJECT_ID') || '',
                        databaseId: localStorage.getItem('APPWRITE_DATABASE_ID') || '',
                        apiKey: localStorage.getItem('APPWRITE_API_KEY') || '',
                      };
                      const sw = registration.active || registration.installing || registration.waiting;
                      if (sw) {
                        sw.postMessage({ type: 'SAVE_CONFIG', config });
                      }
                    }

                    // 等待 SW 激活後傳送 config 並訂閱 Web Push
                    if (reg.active) {
                      sendConfigToSW(reg);
                      subscribeToPush(reg);
                    } else {
                      reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (newWorker) {
                          newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'activated') {
                              sendConfigToSW(reg);
                              subscribeToPush(reg);
                            }
                          });
                        }
                      });
                    }

                    // 註冊 Periodic Background Sync（Android Chrome 支援）
                    // 讓 App 在背景定期檢查到期項目
                    if ('periodicSync' in reg) {
                      try {
                        const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
                        if (status.state === 'granted') {
                          await reg.periodicSync.register('check-expiry', {
                            minInterval: 12 * 60 * 60 * 1000, // 最少 12 小時執行一次
                          });
                        }
                      } catch (e) {
                        // Periodic Background Sync 不支援時忽略
                      }
                    }

                    // 註冊 Background Sync（連線恢復後觸發）
                    if ('sync' in reg) {
                      try {
                        await reg.sync.register('check-expiry-sync');
                      } catch (e) {
                        // Background Sync 不支援時忽略
                      }
                    }

                  } catch (e) {
                    console.error('SW registration failed:', e);
                  }
                });
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased safe-area-inset`}
      >
        <ThemeProvider
          defaultTheme="system"
          storageKey="ui-theme"
        >
          <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
