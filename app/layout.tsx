import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ServiceWorkerBootstrap } from "@/components/providers/ServiceWorkerBootstrap";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#c79541",
};

export const metadata: Metadata = {
  title: {
    default: "鋒兄控制台 · FengBro",
    template: "%s · FengBro",
  },
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
  return (
    <html
      lang="zh-TW"
      className={`scroll-smooth ${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
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
        {/* FOUC-safe theme + density boot */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ui-theme')||'system';var d=localStorage.getItem('ui-density')||'comfortable';var r=document.documentElement;r.classList.remove('light','dark');if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}r.classList.add(t);if(d==='compact'||d==='comfortable'){r.dataset.density=d;}else{r.dataset.density='comfortable';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="safe-area-inset antialiased font-sans">
        <ThemeProvider
          defaultTheme="system"
          defaultDensity="comfortable"
          storageKey="ui-theme"
          densityStorageKey="ui-density"
        >
          <ServiceWorkerBootstrap />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
