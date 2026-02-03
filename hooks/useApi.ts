"use client";

import { useState, useCallback } from "react";

interface UseApiOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (...args: unknown[]) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T>(
  apiFunction: (...args: unknown[]) => Promise<T>,
  options: UseApiOptions<T> = {}
): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await apiFunction(...args);
        setData(result);
        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiFunction, options]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}

// 通用 fetch 函數
export async function fetchApi<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  // 添加 Appwrite 配置到 URL (從 localStorage)
  const urlWithConfig = addAppwriteConfigToUrl(url);
  
  const response = await fetch(urlWithConfig, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    // 嘗試讀取錯誤訊息
    let errorMessage = `HTTP error! status: ${response.status}`;
    let errorData: any = null;
    
    try {
      const text = await response.text();
      if (text) {
        try {
          errorData = JSON.parse(text);
          if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
          console.error('[fetchApi] Error response:', errorData);
        } catch {
          // Not JSON, use text as error message
          errorMessage = text;
          console.error('[fetchApi] Error text:', text);
        }
      } else {
        console.error('[fetchApi] Empty error response body');
      }
    } catch (parseErr) {
      console.error('[fetchApi] Could not read error response:', parseErr);
    }

    if (response.status === 404) {
      // 頻寬超限時不顯示 Table 不存在
      const isBandwidth = errorMessage.includes('Bandwidth') || errorMessage.includes('bandwidth') || errorMessage.includes('exceeded');
      if (!isBandwidth) {
        // 嘗試從 URL 提取 table 名稱
        let tableName = url.split('/api/')[1]?.split('/')[0]?.split('?')[0] || 'table';
        if (errorMessage === `HTTP error! status: 404`) {
          errorMessage = `Table ${tableName} 不存在，請至「鋒兄設定」中初始化。`;
        }
      }
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
}

// 添加 Appwrite 配置到 URL
function addAppwriteConfigToUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  
  const endpoint = localStorage.getItem('NEXT_PUBLIC_APPWRITE_ENDPOINT');
  const projectId = localStorage.getItem('NEXT_PUBLIC_APPWRITE_PROJECT_ID');
  const databaseId = localStorage.getItem('APPWRITE_DATABASE_ID');
  const apiKey = localStorage.getItem('APPWRITE_API_KEY');
  const bucketId = localStorage.getItem('APPWRITE_BUCKET_ID');
  
  // 如果沒有自定義配置，返回原 URL
  if (!endpoint && !projectId && !databaseId) {
    return url;
  }
  
  const separator = url.includes('?') ? '&' : '?';
  const params = new URLSearchParams();
  
  if (endpoint) params.set('_endpoint', endpoint);
  if (projectId) params.set('_project', projectId);
  if (databaseId) params.set('_database', databaseId);
  if (apiKey) params.set('_key', apiKey);
  if (bucketId) params.set('_bucket', bucketId);
  
  const paramString = params.toString();
  return paramString ? `${url}${separator}${paramString}` : url;
}

// CRUD 操作 hooks
export function useCrud<T extends { $id: string }>(baseUrl: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 全域快取 - 使用 Map 依據 baseUrl 儲存不同的快取
  const getCacheKey = () => baseUrl.replace(/\//g, '_');
  
  if (typeof window !== 'undefined') {
    if (!(window as any).__crudCache) {
      (window as any).__crudCache = new Map<string, { data: any[], timestamp: number }>();
    }
  }

  const getCache = () => {
    if (typeof window === 'undefined') return null;
    return (window as any).__crudCache?.get(getCacheKey());
  };

  const setCache = (data: T[]) => {
    if (typeof window === 'undefined') return;
    (window as any).__crudCache?.set(getCacheKey(), { data, timestamp: Date.now() });
  };

  const clearCache = () => {
    if (typeof window === 'undefined') return;
    (window as any).__crudCache?.delete(getCacheKey());
  };

  const getRefreshKey = () => {
    if (typeof window === 'undefined') return '';
    const key = `crud_${baseUrl.replace(/\//g, '_')}_refresh_key`;
    return localStorage.getItem(key) || '';
  };

  const setRefreshKeyValue = () => {
    if (typeof window === 'undefined') return;
    const key = `crud_${baseUrl.replace(/\//g, '_')}_refresh_key`;
    localStorage.setItem(key, Date.now().toString());
  };

  const fetchAll = useCallback(async (forceRefresh = false) => {
    const storedRefreshKey = getRefreshKey();
    const cache = getCache();
    
    // 如果有快取且沒有 CRUD 操作，直接使用快取
    if (!forceRefresh && cache && (!storedRefreshKey || cache.timestamp >= parseInt(storedRefreshKey))) {
      setItems(cache.data);
      setLoading(false);
      return cache.data;
    }

    setLoading(true);
    try {
      const cacheParam = (forceRefresh || storedRefreshKey) ? `?t=${storedRefreshKey || Date.now()}` : '';
      const data = await fetchApi<T[]>(baseUrl + cacheParam);
      
      // 更新快取
      setCache(data);
      
      setItems(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
      return [];
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  const create = useCallback(
    async (item: Omit<T, "$id">): Promise<T | null> => {
      try {
        const newItem = await fetchApi<T>(baseUrl, {
          method: "POST",
          body: JSON.stringify(item),
        });
        setItems((prev) => [...prev, newItem]);
        clearCache();
        setRefreshKeyValue();
        return newItem;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Create failed");
        return null;
      }
    },
    [baseUrl]
  );

  const update = useCallback(
    async (id: string, item: Partial<T>): Promise<T | null> => {
      try {
        const updatedItem = await fetchApi<T>(`${baseUrl}/${id}`, {
          method: "PUT",
          body: JSON.stringify(item),
        });
        setItems((prev) =>
          prev.map((i) => (i.$id === id ? updatedItem : i))
        );
        clearCache();
        setRefreshKeyValue();
        return updatedItem;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
        return null;
      }
    },
    [baseUrl]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await fetchApi(`${baseUrl}/${id}`, { method: "DELETE" });
        setItems((prev) => prev.filter((i) => i.$id !== id));
        clearCache();
        setRefreshKeyValue();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
        return false;
      }
    },
    [baseUrl]
  );

  return {
    items,
    setItems,
    loading,
    error,
    fetchAll,
    create,
    update,
    remove,
    refresh: () => setRefreshKeyValue(),
  };
}
