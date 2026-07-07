import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#c79541",
};

export const metadata: Metadata = {
  title: "FengBro AI Appwrite Console",
  description:
    "AI 驅動的家庭數位中控台，整合食材、訂閱、影音、文件與常用帳號管理。",
  keywords: [
    "Appwrite",
    "Next.js",
    "dashboard",
    "subscription management",
    "food management",
    "personal console",
  ],
  authors: [{ name: "FengBro" }],
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
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

  return (
    <html lang="zh-TW" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/apple-touch-icon.png" type="image/png" sizes="180x180" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FengBro Console" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              var VAPID_PUBLIC_KEY = ${JSON.stringify(vapidPublicKey)};

              function getRuntimeVapidPublicKey() {
                try {
                  return localStorage.getItem('NEXT_PUBLIC_VAPID_PUBLIC_KEY') || VAPID_PUBLIC_KEY || '';
                } catch (_) {
                  return VAPID_PUBLIC_KEY || '';
                }
              }

              function urlBase64ToUint8Array(base64String) {
                var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
                var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
                var rawData = window.atob(base64);
                return Uint8Array.from(rawData, function(char) {
                  return char.charCodeAt(0);
                });
              }

              function isSameApplicationServerKey(subscription, vapidPublicKey) {
                if (!subscription || !subscription.options || !subscription.options.applicationServerKey) return true;
                try {
                  var expected = urlBase64ToUint8Array(vapidPublicKey);
                  var current = new Uint8Array(subscription.options.applicationServerKey);
                  if (expected.length !== current.length) return false;
                  for (var i = 0; i < expected.length; i++) {
                    if (expected[i] !== current[i]) return false;
                  }
                  return true;
                } catch (_) {
                  return true;
                }
              }

              async function subscribeToPush(registration) {
                if (!('pushManager' in registration)) return;
                if (!('Notification' in window)) return;
                if (Notification.permission !== 'granted') return;
                var runtimeVapidPublicKey = getRuntimeVapidPublicKey();
                if (!runtimeVapidPublicKey) return;
                try {
                  var sub = await registration.pushManager.getSubscription();
                  if (sub && !isSameApplicationServerKey(sub, runtimeVapidPublicKey)) {
                    await sub.unsubscribe();
                    sub = null;
                  }
                  if (!sub) {
                    sub = await registration.pushManager.subscribe({
                      userVisibleOnly: true,
                      applicationServerKey: urlBase64ToUint8Array(runtimeVapidPublicKey),
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
                    const swVersion = 'v10';
                    let reloadedForSw = sessionStorage.getItem('fengbro_sw_reloaded') === swVersion;

                    navigator.serviceWorker.addEventListener('controllerchange', function() {
                      if (reloadedForSw) return;
                      reloadedForSw = true;
                      sessionStorage.setItem('fengbro_sw_reloaded', swVersion);
                      window.location.reload();
                    });

                    const reg = await navigator.serviceWorker.register('/sw.js?v=' + swVersion, {
                      scope: '/',
                      updateViaCache: 'none',
                    });
                    await reg.update();

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

                    function hasAppwriteConfig() {
                      return Boolean(
                        localStorage.getItem('NEXT_PUBLIC_APPWRITE_ENDPOINT') &&
                        localStorage.getItem('NEXT_PUBLIC_APPWRITE_PROJECT_ID') &&
                        localStorage.getItem('APPWRITE_DATABASE_ID') &&
                        localStorage.getItem('APPWRITE_API_KEY')
                      );
                    }

                    if (reg.active) {
                      sendConfigToSW(reg);
                      if (hasAppwriteConfig()) {
                        subscribeToPush(reg);
                      }
                    } else {
                      reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (newWorker) {
                          newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'activated') {
                              sendConfigToSW(reg);
                              if (hasAppwriteConfig()) {
                                subscribeToPush(reg);
                              }
                            }
                          });
                        }
                      });
                    }

                    if (hasAppwriteConfig() && 'periodicSync' in reg) {
                      try {
                        const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
                        if (status.state === 'granted') {
                          await reg.periodicSync.register('check-expiry', {
                            minInterval: 12 * 60 * 60 * 1000,
                          });
                        }
                      } catch (e) {}
                    }

                    if (hasAppwriteConfig() && 'sync' in reg) {
                      try {
                        await reg.sync.register('check-expiry-sync');
                      } catch (e) {}
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
      <body className="safe-area-inset antialiased">
        <ThemeProvider defaultTheme="system" storageKey="ui-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
