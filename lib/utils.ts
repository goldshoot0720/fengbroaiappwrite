import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Appwrite 動態配置
export function getAppwriteConfig() {
  if (typeof window === 'undefined') {
    // Server-side: use environment variables
    return {
      endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '',
      projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '',
      databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '',
      bucketId: process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID || '',
      apiKey: process.env.NEXT_PUBLIC_APPWRITE_API_KEY || '',
    };
  }

  // Client-side: 檢查是否已經儲存過自定義配置
  const hasCustomConfig = localStorage.getItem('appwrite_custom_config_saved');
  
  if (hasCustomConfig === 'true') {
    // 如果已經儲存過，只使用 localStorage 的配置，不 fallback 到 .env
    const endpoint = localStorage.getItem('NEXT_PUBLIC_APPWRITE_ENDPOINT') || '';
    const projectId = localStorage.getItem('NEXT_PUBLIC_APPWRITE_PROJECT_ID') || '';
    const databaseId = localStorage.getItem('APPWRITE_DATABASE_ID') || '';
    const bucketId = localStorage.getItem('APPWRITE_BUCKET_ID') || '';
    const apiKey = localStorage.getItem('APPWRITE_API_KEY') || '';
    
    return {
      endpoint,
      projectId,
      databaseId,
      bucketId,
      apiKey,
    };
  }
  
  // 如果沒有儲存過，使用 .env 的預設配置（現在所有變數都有 NEXT_PUBLIC_ 前綴，瀏覽器可訪問）
  return {
    endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '',
    projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '',
    databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '',
    bucketId: process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID || '',
    apiKey: process.env.NEXT_PUBLIC_APPWRITE_API_KEY || '',
  };
}

// 獲取上傳用的 headers（包含 Appwrite 配置）
export function getAppwriteHeaders() {
  const config = getAppwriteConfig();
  return {
    'x-appwrite-endpoint': config.endpoint,
    'x-appwrite-project': config.projectId,
    'x-appwrite-bucket': config.bucketId,
    'x-appwrite-key': config.apiKey,
  };
}

/**
 * 獲取經過代理的媒體 URL，解決 Appwrite 直連無法跳轉時間軸的問題
 * @param url 原始媒體 URL
 * @returns 代理後的 URL
 */
export function getProxiedMediaUrl(url: string | undefined | null): string {
  if (!url) return '';
  
  // 如果已經是代理 URL，或者是 blob URL，則直接返回
  if (url.includes('/api/media-proxy') || url.startsWith('blob:')) {
    return url;
  }

  // 檢查是否為 Appwrite 的 Storage URL
  // 支持絕對路徑 (http...) 和相對路徑 (/v1/...)
  const isAppwriteStorage = url.includes('/storage/buckets/');
  
  if (!isAppwriteStorage) {
    return url;
  }

  const config = getAppwriteConfig();
  let absoluteUrl = url;

  // 如果是相對路徑，補全端點
  if (url.startsWith('/') && config.endpoint) {
    const baseUrl = config.endpoint.endsWith('/') ? config.endpoint.slice(0, -1) : config.endpoint;
    // 如果 URL 已經包含 /v1 且 endpoint 也包含 /v1，要避免重複
    if (url.startsWith('/v1/') && baseUrl.endsWith('/v1')) {
      absoluteUrl = `${baseUrl.slice(0, -3)}${url}`;
    } else {
      absoluteUrl = `${baseUrl}${url}`;
    }
  }

  const params = new URLSearchParams();
  params.set('url', absoluteUrl);
  
  // 只有當有 API Key 且不是 'undefined'/'null' 時才添加
  if (config.apiKey && config.apiKey !== 'undefined' && config.apiKey !== 'null') {
    params.set('_key', config.apiKey);
  }
  
  // Add project ID for public access fallback
  if (config.projectId && config.projectId !== 'undefined' && config.projectId !== 'null') {
    params.set('_project', config.projectId);
  }

  return `/api/media-proxy?${params.toString()}`;
}

/**
 * 獲取 Appwrite 的下載 URL（強制下載而非在瀏覽器預覽）
 * @param url 原始 URL
 * @returns 強制下載的 URL
 */
export function getAppwriteDownloadUrl(url: string | undefined | null): string {
  if (!url) return '';
  
  // 如果是 Appwrite Storage URL 且包含 /view，將其替換為 /download
  if (url.includes('/storage/buckets/') && url.includes('/view')) {
    return url.replace('/view', '/download');
  }
  
  return url;
}

/**
 * 獲取當前 Appwrite 帳號的友善顯示名稱
 * - 使用 .env 配置時返回 "appwrite-.env"
 * - 使用自定義配置時返回 "appwrite-{nickname}" 或 "appwrite-custom"
 */
export function getCurrentAccountLabel(): string {
  if (typeof window === 'undefined') {
    return 'appwrite-.env';
  }

  const hasCustomConfig = localStorage.getItem('appwrite_custom_config_saved');

  if (hasCustomConfig === 'true') {
    const nickname = localStorage.getItem('APPWRITE_ACCOUNT_NICKNAME') || '';
    if (nickname) {
      return `appwrite-${nickname}`;
    }
    return 'appwrite-custom';
  }

  return 'appwrite-.env';
}

// 清除所有快取（用於 Appwrite 帳號切換）
export function clearAllCaches() {
  if (typeof window === 'undefined') return;
  
  console.log('[clearAllCaches] 清除所有快取...');
  
  // 1. 清除 localStorage 中的所有快取相關 key
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.includes('_refresh_key') || 
      key.includes('crud_') ||
      key === 'appwrite_account_switched'
    )) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => {
    console.log(`[clearAllCaches] 清除 localStorage key: ${key}`);
    localStorage.removeItem(key);
  });
  
  // 2. 清除 useCrud 的內存快取
  if ((window as any).__crudCache) {
    console.log(`[clearAllCaches] 清除 __crudCache (${(window as any).__crudCache.size} 個項目)`);
    (window as any).__crudCache.clear();
  }
  
  // 3. 強制清除模組級快取（透過設定特殊 flag）
  const timestamp = Date.now().toString();
  localStorage.setItem('appwrite_account_switched', timestamp);
  console.log(`[clearAllCaches] 設定 appwrite_account_switched: ${timestamp}`);
  
  // 4. 強制所有 hooks 重新載入（設定 refresh keys）
  const modules = [
    'subscriptions',
    'foods', 
    'banks',
    'articles',
    'images',
    'music',
    'videos',
    'dashboard'
  ];
  
  modules.forEach(module => {
    const key = `${module}_refresh_key`;
    localStorage.setItem(key, timestamp);
    console.log(`[clearAllCaches] 設定 ${key}: ${timestamp}`);
  });
  
  console.log('[clearAllCaches] 快取清除完成，所有模組將在下次載入時重新取得資料');
}
