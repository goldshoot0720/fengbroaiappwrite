"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Article, ArticleFormData } from "@/types";
import { API_ENDPOINTS } from "@/lib/constants";
import { fetchApi } from "@/hooks/useApi";
import { bumpRefreshKey, useRefreshKeyListener } from "@/hooks/useRefreshKey";
import { createWriteTracker, patchItem, removeItem, replaceItem, restoreItem } from "@/lib/optimisticList";
import { readEndpointCache, writeEndpointCache } from "@/lib/requestCache";

// 全域快取
let cachedArticles: Article[] | null = null;
let cacheTimestamp: number = 0;

export function useArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tracker = useRef(createWriteTracker()).current;

  const getRefreshKey = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('articles_refresh_key') || '';
  };

  // 寫入後本地狀態已是最新：只通知其他模組／分頁，自己不再整張表重抓一次 Appwrite。
  const selfBump = useRef(false);
  const setRefreshKey = () => {
    selfBump.current = true;
    try {
      bumpRefreshKey("articles_refresh_key");
    } finally {
      selfBump.current = false;
    }
  };

  /** 寫入後同步更新畫面、模組快取與 session 快取。 */
  const commitArticles = useCallback((updater: (prev: Article[]) => Article[]) => {
    setArticles((prev) => {
      const next = updater(prev).sort(
        (a, b) => new Date(b.newDate).getTime() - new Date(a.newDate).getTime()
      );
      cachedArticles = next;
      cacheTimestamp = Date.now() + 1;
      writeEndpointCache(API_ENDPOINTS.ARTICLE, next);
      return next;
    });
  }, []);

  // 載入文章資料（使用快取）
  const loadArticles = useCallback(async (forceRefresh = false) => {
    const storedRefreshKey = getRefreshKey();

    if (!forceRefresh && cachedArticles && (!storedRefreshKey || cacheTimestamp >= parseInt(storedRefreshKey))) {
      setArticles(cachedArticles);
      setLoading(false);
      return cachedArticles;
    }

    // 重新整理後先畫出上次存下的結果，再讓下面的請求在背景更新。
    const persisted = forceRefresh ? null : readEndpointCache<Article[]>(API_ENDPOINTS.ARTICLE);
    if (persisted && persisted.length) {
      setArticles(persisted);
      setLoading(false);
    } else {
      setLoading(true);
    }
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
      writeEndpointCache(API_ENDPOINTS.ARTICLE, data);

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

      // 分類：更新時允許送出空字串以清除既有分類
      if (formData.category !== undefined) dataToSend.category = formData.category.trim();

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
      setRefreshKey();
      commitArticles((prev) => [newArticle, ...prev.filter((a) => a.$id !== newArticle.$id)]);
      return newArticle;
    } catch (err) {
      console.error("新增文章失敗:", err);
      throw err;
    }
  }, [commitArticles]);

  // 更新文章
  const updateArticle = useCallback(async (id: string, formData: ArticleFormData): Promise<Article | null> => {
    const token = tracker.begin(id);
    let previous: Article | undefined;
    try {
      // 轉換日期格式為 ISO datetime
      const dateTime = new Date(formData.newDate).toISOString();

      // 準備數據，過濾空字串的 URL 和 file 欄位
      const dataToSend: any = {
        title: formData.title,
        content: formData.content,
        newDate: dateTime,
      };

      // 分類：更新時允許空白字串清除既有分類
      if (formData.category !== undefined) dataToSend.category = formData.category.trim();

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

      // 樂觀更新：先改畫面，伺服器回應後換成正式資料，失敗回滾。
      commitArticles((prev) => {
        const patched = patchItem(prev, id, dataToSend as Partial<Article>);
        previous = patched.previous;
        return patched.list;
      });

      const res = await fetchApi<Article>(`${API_ENDPOINTS.ARTICLE}/${id}`, {
        method: "PUT",
        body: JSON.stringify(dataToSend),
      });

      const updatedArticle: Article = res;
      setRefreshKey();
      if (tracker.isLatest(id, token)) commitArticles((prev) => replaceItem(prev, id, updatedArticle));
      return updatedArticle;
    } catch (err) {
      console.error("更新文章失敗:", err);
      if (tracker.isLatest(id, token)) commitArticles((prev) => replaceItem(prev, id, previous));
      throw err;
    } finally {
      tracker.finish(id, token);
    }
  }, [commitArticles, tracker]);

  // 刪除文章
  const deleteArticle = useCallback(async (id: string): Promise<boolean> => {
    // 樂觀刪除：先從畫面移除，失敗再放回去。
    let removed: Article | undefined;
    let index = -1;
    commitArticles((prev) => {
      const result = removeItem(prev, id);
      removed = result.removed;
      index = result.index;
      return result.list;
    });
    try {
      await fetchApi(`${API_ENDPOINTS.ARTICLE}/${id}`, { method: "DELETE" });
      setRefreshKey();
      return true;
    } catch (err) {
      console.error("刪除文章失敗:", err);
      commitArticles((prev) => restoreItem(prev, removed, index));
      throw err;
    }
  }, [commitArticles]);

  // 初始載入
  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const handleArticlesRefresh = useCallback(() => {
    if (selfBump.current) return;
    loadArticles(true);
  }, [loadArticles]);
  useRefreshKeyListener("articles_refresh_key", handleArticlesRefresh);

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
