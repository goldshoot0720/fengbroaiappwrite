"use client";

import { useState, useEffect, useCallback } from "react";
import { Article, ArticleFormData } from "@/types";
import { API_ENDPOINTS } from "@/lib/constants";
import { fetchApi } from "@/hooks/useApi";

// 全域快取
let cachedArticles: Article[] | null = null;
let cacheTimestamp: number = 0;

export function useArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getRefreshKey = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('articles_refresh_key') || '';
  };

  const setRefreshKey = () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('articles_refresh_key', Date.now().toString());
  };

  // 載入文章資料（使用快取）
  const loadArticles = useCallback(async (forceRefresh = false) => {
    const storedRefreshKey = getRefreshKey();
    
    if (!forceRefresh && cachedArticles && (!storedRefreshKey || cacheTimestamp >= parseInt(storedRefreshKey))) {
      setArticles(cachedArticles);
      setLoading(false);
      return cachedArticles;
    }

    setLoading(true);
    setError(null);
    try {
      const cacheParam = (forceRefresh || storedRefreshKey) ? `?t=${storedRefreshKey || Date.now()}` : '';
      const resData = await fetchApi<Article[]>(API_ENDPOINTS.ARTICLE + cacheParam);
      let data: Article[] = Array.isArray(resData) ? resData : [];
      // 按日期排序（最新的在前）
      data = data.sort(
        (a, b) => new Date(b.newDate).getTime() - new Date(a.newDate).getTime()
      );
      
      cachedArticles = data;
      cacheTimestamp = Date.now();
      
      setArticles(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "載入文章資料失敗";
      setError(message);
      console.error("載入文章資料失敗:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 新增文章
  const createArticle = useCallback(async (formData: ArticleFormData): Promise<Article | null> => {
    try {
      // 轉換日期格式為 ISO datetime
      const dateTime = new Date(formData.newDate).toISOString();
      
      // 準備數據，過濾空字串的 URL 和 file 欄位
      const dataToSend: any = {
        title: formData.title,
        content: formData.content,
        newDate: dateTime,
      };
      
      // 只添加非空的 URL
      if (formData.url1 && formData.url1.trim()) dataToSend.url1 = formData.url1;
      if (formData.url2 && formData.url2.trim()) dataToSend.url2 = formData.url2;
      if (formData.url3 && formData.url3.trim()) dataToSend.url3 = formData.url3;
      
      // 只添加非空的 file 欄位
      if (formData.file1 && formData.file1.trim()) dataToSend.file1 = formData.file1;
      if (formData.file1name && formData.file1name.trim()) dataToSend.file1name = formData.file1name;
      if (formData.file1type && formData.file1type.trim()) dataToSend.file1type = formData.file1type;
      if (formData.file2 && formData.file2.trim()) dataToSend.file2 = formData.file2;
      if (formData.file2name && formData.file2name.trim()) dataToSend.file2name = formData.file2name;
      if (formData.file2type && formData.file2type.trim()) dataToSend.file2type = formData.file2type;
      if (formData.file3 && formData.file3.trim()) dataToSend.file3 = formData.file3;
      if (formData.file3name && formData.file3name.trim()) dataToSend.file3name = formData.file3name;
      if (formData.file3type && formData.file3type.trim()) dataToSend.file3type = formData.file3type;
      
      const res = await fetchApi<Article>(API_ENDPOINTS.ARTICLE, {
        method: "POST",
        body: JSON.stringify(dataToSend),
      });
      
      const newArticle: Article = res;
      setArticles((prev) => {
        const updated = [newArticle, ...prev];
        return updated.sort(
          (a, b) => new Date(b.newDate).getTime() - new Date(a.newDate).getTime()
        );
      });
      cachedArticles = null;
      setRefreshKey();
      return newArticle;
    } catch (err) {
      console.error("新增文章失敗:", err);
      throw err;
    }
  }, []);

  // 更新文章
  const updateArticle = useCallback(async (id: string, formData: ArticleFormData): Promise<Article | null> => {
    try {
      // 轉換日期格式為 ISO datetime
      const dateTime = new Date(formData.newDate).toISOString();
      
      // 準備數據，過濾空字串的 URL 和 file 欄位
      const dataToSend: any = {
        title: formData.title,
        content: formData.content,
        newDate: dateTime,
      };
      
      // 只添加非空的 URL
      if (formData.url1 && formData.url1.trim()) dataToSend.url1 = formData.url1;
      if (formData.url2 && formData.url2.trim()) dataToSend.url2 = formData.url2;
      if (formData.url3 && formData.url3.trim()) dataToSend.url3 = formData.url3;
      
      // 只添加非空的 file 欄位
      if (formData.file1 && formData.file1.trim()) dataToSend.file1 = formData.file1;
      if (formData.file1name && formData.file1name.trim()) dataToSend.file1name = formData.file1name;
      if (formData.file1type && formData.file1type.trim()) dataToSend.file1type = formData.file1type;
      if (formData.file2 && formData.file2.trim()) dataToSend.file2 = formData.file2;
      if (formData.file2name && formData.file2name.trim()) dataToSend.file2name = formData.file2name;
      if (formData.file2type && formData.file2type.trim()) dataToSend.file2type = formData.file2type;
      if (formData.file3 && formData.file3.trim()) dataToSend.file3 = formData.file3;
      if (formData.file3name && formData.file3name.trim()) dataToSend.file3name = formData.file3name;
      if (formData.file3type && formData.file3type.trim()) dataToSend.file3type = formData.file3type;
      
      const res = await fetchApi<Article>(`${API_ENDPOINTS.ARTICLE}/${id}`, {
        method: "PUT",
        body: JSON.stringify(dataToSend),
      });
      
      const updatedArticle: Article = res;
      setArticles((prev) => {
        const updated = prev.map((a) => (a.$id === id ? updatedArticle : a));
        return updated.sort(
          (a, b) => new Date(b.newDate).getTime() - new Date(a.newDate).getTime()
        );
      });
      cachedArticles = null;
      setRefreshKey();
      return updatedArticle;
    } catch (err) {
      console.error("更新文章失敗:", err);
      throw err;
    }
  }, []);

  // 刪除文章
  const deleteArticle = useCallback(async (id: string): Promise<boolean> => {
    try {
      await fetchApi(`${API_ENDPOINTS.ARTICLE}/${id}`, { method: "DELETE" });
      
      setArticles((prev) => prev.filter((a) => a.$id !== id));
      cachedArticles = null;
      setRefreshKey();
      return true;
    } catch (err) {
      console.error("刪除文章失敗:", err);
      throw err;
    }
  }, []);

  // 初始載入
  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  // 監聽 refresh key 變化（當其他頁面清除快取時重新載入）
  useEffect(() => {
    const checkRefreshKey = () => {
      const storedRefreshKey = getRefreshKey();
      if (storedRefreshKey && parseInt(storedRefreshKey) > cacheTimestamp) {
        console.log('[useArticles] 偵測到快取已清除，重新載入資料');
        loadArticles(true);
      }
    };

    const interval = setInterval(checkRefreshKey, 500);
    return () => clearInterval(interval);
  }, [loadArticles]);

  const stats = {
    total: Array.isArray(articles) ? articles.length : 0,
  };

  return {
    articles,
    loading,
    error,
    stats,
    loadArticles,
    createArticle,
    updateArticle,
    deleteArticle,
  };
}
