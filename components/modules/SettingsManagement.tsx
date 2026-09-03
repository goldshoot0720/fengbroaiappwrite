"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Settings, Moon, Sun, Bell, Shield, Database, Palette, Table2, Loader2, Plus, X, CheckCircle2, Key, HardDrive, Trash2, Mail, Send, Mic, Activity, AlertTriangle, Info } from "lucide-react";
import { Button, DataCard, SectionHeader } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/providers/theme-provider";
import { useVoicePreferences } from "@/hooks/useVoicePreferences";
import { clearAllCaches, getAppwriteConfig } from "@/lib/utils";
import { notifyAppwriteConfigChanged } from "@/hooks/useAppwriteSetup";
import { useWebPush } from "@/hooks/useWebPush";
import { formatFileSize } from "@/lib/formatters";
import {
  RESEND_SLOT_COUNT,
  RESEND_DEFAULT_VISIBLE_SLOT_COUNT,
  RESEND_VISIBLE_SLOT_OPTIONS,
  RESEND_DEFAULT_FROM,
  getResendSlotFields,
  createEmptyResendConfig,
} from "@/lib/notifications/resendConfig";
import {
  runNotificationSelfCheck,
  type SelfCheckReport,
  type CheckStatus,
} from "@/lib/notifications/selfCheck";
import { API_ENDPOINTS } from "@/lib/constants";
import packageJson from "@/package.json";

interface CollectionStats {
  name: string;
  columnCount: number;
  documentCount: number;
  collectionId?: string;
  error?: boolean;
  schemaMismatch?: boolean;
  schemaDetails?: {
    toAdd: any[];
    toUpdate: any[];
    conflicts: any[];
  };
}

interface DatabaseStats {
  totalColumns: number;
  totalCollections: number;
  collections: CollectionStats[];
  databaseId: string;
}

interface CreateProgress {
  tableName: string;
  totalColumns: number;
  currentColumn: number;
  percent: number;
  currentAttribute: string;
  message: string;
  isComplete: boolean;
  isError: boolean;
  collectionId?: string;
}

export default function SettingsManagement() {
  const { theme, setTheme } = useTheme();
  const { preferences: voicePreferences, updatePreferences: updateVoicePreferences } = useVoicePreferences();
  const {
    notificationPermission,
    pushSubscribed,
    pushLoading,
    enablePush,
    disablePush,
  } = useWebPush({
    envVapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [progress, setProgress] = useState<CreateProgress | null>(null);
  const [recentlyCreated, setRecentlyCreated] = useState<Set<string>>(new Set()); // Track recently created tables
  const [appwriteConfig, setAppwriteConfig] = useState({
    nickname: '',
    endpoint: '',
    projectId: '',
    databaseId: '',
    bucketId: '',
    apiKey: ''
  });
  const [configSaved, setConfigSaved] = useState(false);
  const [pushConfig, setPushConfig] = useState({
    publicKey: ''
  });
  const [resendConfig, setResendConfig] = useState<Record<string, string>>(createEmptyResendConfig);
  const [resendVisibleSlotCount, setResendVisibleSlotCount] = useState(RESEND_DEFAULT_VISIBLE_SLOT_COUNT);
  const [resendTestLoading, setResendTestLoading] = useState(false);
  const [selfCheckLoading, setSelfCheckLoading] = useState(false);
  const [selfCheckReport, setSelfCheckReport] = useState<SelfCheckReport | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkIsUpdate, setBulkIsUpdate] = useState(false);
  const [bulkQueue, setBulkQueue] = useState<string[]>([]);
  const bulkQueueRef = useRef<string[]>([]);
  const bulkModeRef = useRef(false);
  const bulkIsUpdateRef = useRef(false);
  const [storageStats, setStorageStats] = useState<any>(null);
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    stage: string;
    current: number;
    total: number;
    message: string;
  } | null>(null);
  const [deleteProgress, setDeleteProgress] = useState<{
    stage: string;
    current: number;
    total: number;
    message: string;
    deleted?: number;
    failed?: number;
  } | null>(null);

  const configuredResendSlotCount = useMemo(() => {
    return Array.from({ length: RESEND_SLOT_COUNT }, (_, index) => {
      const fields = getResendSlotFields(index + 1);
      const apiKey = (resendConfig[fields.apiKey] || '').trim();
      const toEmail = (resendConfig[fields.toEmail] || '').trim();
      return apiKey && toEmail;
    }).filter(Boolean).length;
  }, [resendConfig]);

  // 計算待處理表格數量
  const missingTablesCount = useMemo(() =>
    dbStats?.collections?.filter(col => col.error).length || 0,
    [dbStats]
  );

  const mismatchTablesCount = useMemo(() =>
    dbStats?.collections?.filter(col => col.schemaMismatch && !col.error && !recentlyCreated.has(col.name)).length || 0,
    [dbStats, recentlyCreated]
  );


  // 載入 Appwrite 設定
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = {
      nickname: localStorage.getItem('APPWRITE_ACCOUNT_NICKNAME') || '',
      endpoint: localStorage.getItem('NEXT_PUBLIC_APPWRITE_ENDPOINT') || '',
      projectId: localStorage.getItem('NEXT_PUBLIC_APPWRITE_PROJECT_ID') || '',
      databaseId: localStorage.getItem('APPWRITE_DATABASE_ID') || '',
      bucketId: localStorage.getItem('APPWRITE_BUCKET_ID') || '',
      apiKey: localStorage.getItem('APPWRITE_API_KEY') || ''
    };
    setAppwriteConfig(saved);
    setPushConfig({
      publicKey: localStorage.getItem('NEXT_PUBLIC_VAPID_PUBLIC_KEY') || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
    });
    const savedResendConfig: Record<string, string> = {
      fromEmail: localStorage.getItem('RESEND_FROM_EMAIL') || RESEND_DEFAULT_FROM
    };
    for (let slot = 1; slot <= RESEND_SLOT_COUNT; slot++) {
      const fields = getResendSlotFields(slot);
      savedResendConfig[fields.apiKey] = localStorage.getItem(fields.envApiKey) || '';
      savedResendConfig[fields.toEmail] = localStorage.getItem(fields.envToEmail) || '';
    }
    setResendConfig(savedResendConfig);
  }, []);

  const handleSaveConfig = () => {
    if (typeof window === 'undefined') return;
    
    // 驗證所有欄位已填寫
    if (!appwriteConfig.endpoint || !appwriteConfig.projectId || !appwriteConfig.databaseId || !appwriteConfig.bucketId || !appwriteConfig.apiKey) {
      alert('⚠️ 請填寫所有 Appwrite 設定欄位');
      return;
    }

    // 儲存新設定
    if (appwriteConfig.nickname) {
      localStorage.setItem('APPWRITE_ACCOUNT_NICKNAME', appwriteConfig.nickname);
    } else {
      localStorage.removeItem('APPWRITE_ACCOUNT_NICKNAME');
    }
    localStorage.setItem('NEXT_PUBLIC_APPWRITE_ENDPOINT', appwriteConfig.endpoint);
    localStorage.setItem('NEXT_PUBLIC_APPWRITE_PROJECT_ID', appwriteConfig.projectId);
    localStorage.setItem('APPWRITE_DATABASE_ID', appwriteConfig.databaseId);
    localStorage.setItem('APPWRITE_BUCKET_ID', appwriteConfig.bucketId);
    localStorage.setItem('APPWRITE_API_KEY', appwriteConfig.apiKey);
    
    // 設定標記：已經儲存過自定義配置，不再使用 .env
    localStorage.setItem('appwrite_custom_config_saved', 'true');
    
    // 清除所有快取
    clearAllCaches();
    notifyAppwriteConfigChanged();
    
    setConfigSaved(true);
    
    // 顯示提示並自動重新整理頁面
    alert('✅ Appwrite 帳號設定已儲存！\n所有快取已清除。\n\n頁面將自動重新載入以套用新設定。');
    
    // 延遲 500ms 後自動重新整理頁面
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleSavePushConfig = () => {
    if (typeof window === 'undefined') return;
    const publicKey = pushConfig.publicKey.trim();
    if (publicKey) {
      localStorage.setItem('NEXT_PUBLIC_VAPID_PUBLIC_KEY', publicKey);
    } else {
      localStorage.removeItem('NEXT_PUBLIC_VAPID_PUBLIC_KEY');
    }
    alert('✅ 推播公鑰設定已儲存。\n重新整理後會套用新的推播設定。');
    window.location.reload();
  };

  const handleNotificationSelfCheck = async (sendTestOsNotification = false) => {
    setSelfCheckLoading(true);
    try {
      const report = await runNotificationSelfCheck({
        includeServer: true,
        sendTestOsNotification,
        appwrite: {
          endpoint: appwriteConfig.endpoint,
          projectId: appwriteConfig.projectId,
          databaseId: appwriteConfig.databaseId,
          apiKey: appwriteConfig.apiKey,
        },
      });
      setSelfCheckReport(report);
    } catch (err) {
      setSelfCheckReport({
        checkedAt: new Date().toISOString(),
        overall: "fail",
        summary: { pass: 0, warn: 0, fail: 1, info: 0 },
        items: [
          {
            id: "selfcheck.error",
            channel: "client",
            label: "自我檢測",
            status: "fail",
            detail: err instanceof Error ? err.message : "未知錯誤",
          },
        ],
      });
    } finally {
      setSelfCheckLoading(false);
    }
  };

  const selfCheckStatusClass = (status: CheckStatus) => {
    if (status === "pass") return "text-green-600 dark:text-green-400";
    if (status === "warn") return "text-amber-600 dark:text-amber-400";
    if (status === "fail") return "text-red-600 dark:text-red-400";
    return "text-sky-600 dark:text-sky-400";
  };

  const selfCheckStatusLabel = (status: CheckStatus) => {
    if (status === "pass") return "通過";
    if (status === "warn") return "警告";
    if (status === "fail") return "失敗";
    return "資訊";
  };

  const handleSaveResendConfig = () => {
    if (typeof window === 'undefined') return;
    const nextConfig: Record<string, string> = {};
    for (let slot = 1; slot <= RESEND_SLOT_COUNT; slot++) {
      const fields = getResendSlotFields(slot);
      const apiKey = (resendConfig[fields.apiKey] || '').trim();
      const toEmail = (resendConfig[fields.toEmail] || '').trim();
      nextConfig[fields.apiKey] = apiKey;
      nextConfig[fields.toEmail] = toEmail;
      if (apiKey) localStorage.setItem(fields.envApiKey, apiKey);
      else localStorage.removeItem(fields.envApiKey);
      if (toEmail) localStorage.setItem(fields.envToEmail, toEmail);
      else localStorage.removeItem(fields.envToEmail);
    }
    const fromEmail = resendConfig.fromEmail.trim() || RESEND_DEFAULT_FROM;

    localStorage.setItem('RESEND_FROM_EMAIL', fromEmail);
    setResendConfig({ ...nextConfig, fromEmail });
    alert(`✅ Resend Email 通知設定已儲存。部署環境請同步設定 RESEND_API_KEY / RESEND_TO_EMAIL，最多可使用 RESEND_API_KEY${RESEND_SLOT_COUNT} / RESEND_TO_EMAIL${RESEND_SLOT_COUNT}。`);
  };

  const handleTestResendNotification = async () => {
    const resendPayload: Record<string, string> = {};
    const hasCompleteResendSlot = Array.from({ length: RESEND_SLOT_COUNT }, (_, index) => {
      const fields = getResendSlotFields(index + 1);
      const apiKey = (resendConfig[fields.apiKey] || '').trim();
      const toEmail = (resendConfig[fields.toEmail] || '').trim();
      resendPayload[fields.bodyApiKey] = apiKey;
      resendPayload[fields.bodyToEmail] = toEmail;
      return Boolean(apiKey && toEmail);
    }).some(Boolean);
    if (!hasCompleteResendSlot) {
      alert('請至少填寫一組 RESEND API Key 與通知收件 Email');
      return;
    }

    setResendTestLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.RESEND_EXPIRY_NOTIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...resendPayload,
          resendFrom: resendConfig.fromEmail.trim() || RESEND_DEFAULT_FROM,
          endpoint: appwriteConfig.endpoint,
          projectId: appwriteConfig.projectId,
          databaseId: appwriteConfig.databaseId,
          appwriteApiKey: appwriteConfig.apiKey,
        }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || 'Resend 測試失敗');
      alert(result.sent ? `✅ Email 通知已送出：訂閱 ${result.subscriptions}、食品 ${result.foods}` : '✅ 檢查完成，目前沒有符合通知條件的項目');
    } catch (error) {
      alert(`❌ Resend 測試失敗：${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      setResendTestLoading(false);
    }
  };

  const handleBulkCreate = () => {
    if (!dbStats?.collections) return;
    const missingTables = dbStats.collections
      .filter(col => col.error)
      .map(col => col.name);
    
    if (missingTables.length === 0) {
      alert("所有表格皆已存在。");
      return;
    }

    if (!confirm(`確定要一次建立 ${missingTables.length} 個表格嗎？\n\n[${missingTables.join(', ')}]`)) {
      return;
    }

    setBulkMode(true);
    setBulkIsUpdate(false);
    const queue = [...missingTables];
    const first = queue.shift();
    setBulkQueue(queue);
    
    // 同步更新 Ref 以確保 handleCreateTable 回呼能讀取到最新狀態
    bulkModeRef.current = true;
    bulkIsUpdateRef.current = false;
    bulkQueueRef.current = queue;

    if (first) handleCreateTable(first, false);
  };

  const handleBulkRebuild = () => {
    if (!dbStats?.collections) return;
    const mismatchTables = dbStats.collections
      .filter(col => col.schemaMismatch && !col.error)
      .map(col => col.name);
    
    if (mismatchTables.length === 0) {
      alert("所有表格結構皆一致。");
      return;
    }

    if (!confirm(`⚠️ 警告：一次重建 ${mismatchTables.length} 個表格將會刪除所有相關資料！

[${mismatchTables.join(', ')}]

確定要繼續嗎？`)) {
      return;
    }

    setBulkMode(true);
    setBulkIsUpdate(true);
    const queue = [...mismatchTables];
    const first = queue.shift();
    setBulkQueue(queue);
    
    // 同步更新 Ref 以確保 handleCreateTable 回呼能讀取到最新狀態
    bulkModeRef.current = true;
    bulkIsUpdateRef.current = true;
    bulkQueueRef.current = queue;

    if (first) handleCreateTable(first, true);
  };

  const handleResetToDefault = () => {
    if (typeof window === 'undefined') return;
    
    if (!confirm('確定要重置為預設值嗎？\n\n這將清除所有自定義 Appwrite 配置，恢復使用 .env 檔案的設定。')) {
      return;
    }
    
    // 清除所有 localStorage 中的 Appwrite 配置
    localStorage.removeItem('APPWRITE_ACCOUNT_NICKNAME');
    localStorage.removeItem('NEXT_PUBLIC_APPWRITE_ENDPOINT');
    localStorage.removeItem('NEXT_PUBLIC_APPWRITE_PROJECT_ID');
    localStorage.removeItem('APPWRITE_DATABASE_ID');
    localStorage.removeItem('APPWRITE_BUCKET_ID');
    localStorage.removeItem('APPWRITE_API_KEY');
    localStorage.removeItem('NEXT_PUBLIC_VAPID_PUBLIC_KEY');
    for (let slot = 1; slot <= RESEND_SLOT_COUNT; slot++) {
      const fields = getResendSlotFields(slot);
      localStorage.removeItem(fields.envApiKey);
      localStorage.removeItem(fields.envToEmail);
    }
    localStorage.removeItem('RESEND_FROM_EMAIL');
    localStorage.removeItem('appwrite_custom_config_saved');
    
    // 清除所有快取
    clearAllCaches();
    notifyAppwriteConfigChanged();
    
    alert('✅ 已重置為預設值！\n現在將使用 .env 檔案的 Appwrite 配置。\n\n頁面將自動重新載入。');
    
    // 延遲 500ms 後自動重新整理頁面
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleCopyEnvTemplate = () => {
    const envTemplate = `# Appwrite Configuration
NEXT_PUBLIC_APPWRITE_ENDPOINT=${appwriteConfig.endpoint}
NEXT_PUBLIC_APPWRITE_PROJECT_ID=${appwriteConfig.projectId}
APPWRITE_DATABASE_ID=${appwriteConfig.databaseId}
APPWRITE_BUCKET_ID=${appwriteConfig.bucketId}
APPWRITE_API_KEY=${appwriteConfig.apiKey}
VAPID_PUBLIC_KEY=${pushConfig.publicKey}
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${pushConfig.publicKey}
${Array.from({ length: RESEND_SLOT_COUNT }, (_, index) => {
  const fields = getResendSlotFields(index + 1);
  return `${fields.envApiKey}=${resendConfig[fields.apiKey] || ''}\n${fields.envToEmail}=${resendConfig[fields.toEmail] || ''}`;
}).join('\n')}
RESEND_FROM_EMAIL=${resendConfig.fromEmail}`;
    
    navigator.clipboard.writeText(envTemplate).then(() => {
      alert('✅ .env 設定已複製到剪貼簿！\n\n請執行以下步驟：\n1. 在專案根目錄建立或開啟 .env 檔案\n2. 貼上複製的內容\n3. 儲存檔案\n4. 重新啟動開發伺服器 (npm run dev)');
    }).catch(() => {
      alert('複製失敗，請手動複製以下內容：\n\n' + envTemplate);
    });
  };

  const fetchStats = () => {
    // 添加 Appwrite 配置參數到 URL
    const config = getAppwriteConfig();
    const params = new URLSearchParams();
    if (config.endpoint) params.set('_endpoint', config.endpoint);
    if (config.projectId) params.set('_project', config.projectId);
    if (config.databaseId) params.set('_database', config.databaseId);
    if (config.apiKey) params.set('_key', config.apiKey);
    
    const url = `/api/database-stats?${params.toString()}`;
    
    fetch(url, { cache: "no-store" })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          console.error("Database stats error:", data.error);
          if (String(data.error).includes('Bandwidth limit') || String(data.error).includes('bandwidth') || String(data.error).includes('exceeded')) {
            alert('⚠️ Appwrite 頻寬超出限制\n\n無法取得資料庫狀態。\n請至 Appwrite Console → Organization → Billing 升級方案或調整預算上限。');
          }
        }
        setDbStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch database stats:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handlePatchSchema = async (tableName: string) => {
    if (!confirm(`要為「${tableName}」補上缺少的欄位嗎？這不會刪除現有資料。`)) return;

    setCreating(tableName);
    try {
      const config = getAppwriteConfig();
      const params = new URLSearchParams();
      if (config.endpoint) params.set("_endpoint", config.endpoint);
      if (config.projectId) params.set("_project", config.projectId);
      if (config.databaseId) params.set("_database", config.databaseId);
      if (config.apiKey) params.set("_key", config.apiKey);

      const response = await fetch(`/api/update-schema?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName }),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        throw new Error(result.message || result.error || "補欄位失敗");
      }
      alert(`✅ ${result.message || `${tableName} 已補上缺少欄位`}`);
      fetchStats();
    } catch (error) {
      alert(`❌ 補欄位失敗：${error instanceof Error ? error.message : "未知錯誤"}`);
    } finally {
      setCreating(null);
    }
  };

  const handleCreateTable = async (tableName: string, isUpdate = false) => {
    const additiveSetup =
      tableName === "trialpurchase" || tableName === "reinstall" || tableName === "quota" || tableName === "shoppinglist";
    // 如果是更新操作且不在批次模式中，顯示警告
    if (isUpdate && !additiveSetup && !bulkModeRef.current) {
      const confirmed = confirm(
        `⚠️ 警告：更新 ${tableName} 表結構需要重建表格\n\n` +
        `這個操作將：\n` +
        `1. 刪除現有表格\n` +
        `2. 創建新的表格結構\n` +
        `3. 所有資料將會遺失\n\n` +
        `建議：請先在 Appwrite 控制台備份資料\n\n` +
        `✅ 完成後請刷新頁面確認結果\n\n` +
        `確定要繼續嗎？`
      );
      if (!confirmed) return;
    }

    setCreating(tableName);
    setProgress({
      tableName,
      totalColumns: 0,
      currentColumn: 0,
      percent: 0,
      currentAttribute: '',
      message: '正在連線...',
      isComplete: false,
      isError: false
    });

    try {
      // 添加 Appwrite 配置參數到 URL
      const config = getAppwriteConfig();
      const params = new URLSearchParams();
      params.set('table', tableName);
      if (config.endpoint) params.set('_endpoint', config.endpoint);
      if (config.projectId) params.set('_project', config.projectId);
      if (config.databaseId) params.set('_database', config.databaseId);
      if (config.apiKey) params.set('_key', config.apiKey);
      
      const eventSource = new EventSource(`/api/create-table?${params.toString()}`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'start':
            setProgress(prev => prev ? {
              ...prev,
              totalColumns: data.totalColumns,
              message: `開始建立 ${data.tableName} (${data.totalColumns} 欄位)`
            } : null);
            break;
          case 'progress':
            if (data.step === 'attribute') {
              setProgress(prev => prev ? {
                ...prev,
                currentColumn: data.current,
                percent: data.percent,
                currentAttribute: data.attribute,
                message: data.message
              } : null);
            } else {
              setProgress(prev => prev ? {
                ...prev,
                message: data.message,
                collectionId: data.collectionId
              } : null);
            }
            break;
          case 'complete':
            setProgress(prev => prev ? {
              ...prev,
              percent: 100,
              isComplete: true,
              message: data.message,
              collectionId: data.collectionId
            } : null);
            eventSource.close();
            // Mark this table as recently created
            setRecentlyCreated(prev => new Set(prev).add(tableName));
            // Auto-remove from recently created after 10 seconds
            setTimeout(() => {
              setRecentlyCreated(prev => {
                const newSet = new Set(prev);
                newSet.delete(tableName);
                return newSet;
              });
            }, 10000);
            clearAllCaches(); // 清除所有模組快取
            
            // 如果是在批次模式中，且還有後續表格，處理下一個而不重新整理
            if (bulkModeRef.current && bulkQueueRef.current.length > 0) {
              const nextQueue = [...bulkQueueRef.current];
              const nextTable = nextQueue.shift();
              setBulkQueue(nextQueue);
              bulkQueueRef.current = nextQueue;
              if (nextTable) {
                setTimeout(() => {
                  handleCreateTable(nextTable, bulkIsUpdateRef.current); 
                }, 1000);
                return;
              }
            }

            // 批次或單一操作結束後的清理與確認
            setTimeout(() => {
              fetchStats(); // 重新載入資料庫統計
              setCreating(null);
              const wasInBulk = bulkModeRef.current; // 保存當前狀態
              setBulkMode(false); // 重設批次模式
              bulkModeRef.current = false;
              
              // 完成後自動刷新頁面以確保顯示最新狀態
              setTimeout(() => {
                const finishMsg = wasInBulk 
                  ? `✅ 批次處理已全部完成！` 
                  : `✅ ${tableName} 表格已成功處理！`;
                
                if (confirm(`${finishMsg}\n\n點擊「確定」自動刷新頁面以確認最終結果。`)) {
                  window.location.reload();
                }
              }, 1000);
            }, 2000); 
            break;
          case 'error':
            setProgress(prev => prev ? {
              ...prev,
              isError: true,
              message: `錯誤: ${data.message}`
            } : null);
            eventSource.close();
            break;
        }
      };

      eventSource.onerror = () => {
        setProgress(prev => prev ? {
          ...prev,
          isError: true,
          message: '連線失敗'
        } : null);
        eventSource.close();
      };

    } catch (err) {
      setProgress(prev => prev ? {
        ...prev,
        isError: true,
        message: `錯誤: ${err}`
      } : null);
    }
  };

  const closeProgressDialog = () => {
    setProgress(null);
    setCreating(null);
    setBulkMode(false);
    bulkModeRef.current = false;
  };

  const handleCountOrphanedFiles = async () => {
    setCleaningStorage(true);
    setScanProgress({ stage: '準備中', current: 0, total: 100, message: '正在連接到 Appwrite...' });
    
    try {
      const config = getAppwriteConfig();
      const params = new URLSearchParams();
      if (config.endpoint) params.set('_endpoint', config.endpoint);
      if (config.projectId) params.set('_project', config.projectId);
      if (config.databaseId) params.set('_database', config.databaseId);
      if (config.bucketId) params.set('_bucket', config.bucketId);
      if (config.apiKey) params.set('_key', config.apiKey);
      params.set('action', 'count');

      // Simulate progress stages
      setScanProgress({ stage: '步驟 1/3', current: 10, total: 100, message: '獲取 Storage 檔案列表...' });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setScanProgress({ stage: '步驟 2/3', current: 40, total: 100, message: '掃描資料庫引用...' });
      
      const response = await fetch(`/api/storage-stats?${params.toString()}`);
      
      setScanProgress({ stage: '步驟 3/3', current: 70, total: 100, message: '比對檔案並分類...' });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '統計失敗');
      }

      setScanProgress({ stage: '完成', current: 100, total: 100, message: '統計完成！' });
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setStorageStats(data);
      // Statistics are now displayed in the UI below, no need for alert
    } catch (error) {
      setScanProgress({ stage: '錯誤', current: 0, total: 100, message: '統計失敗' });
      alert('❗ 統計失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
    } finally {
      setCleaningStorage(false);
      setTimeout(() => setScanProgress(null), 1000);
    }
  };

  const handleDeleteOrphanedFiles = async () => {
    if (!storageStats || storageStats.orphanedFiles === 0) {
      alert('⚠️ 請先執行「統計多餘檔案」以確認數量！');
      return;
    }

    const confirmed = confirm(
      `⚠️ 警告：即將刪除 ${storageStats.orphanedFiles} 個多餘檔案！\n\n` +
      `分類明細：\n` +
      `- 圖片：${storageStats.orphanedByType?.images || 0} 個\n` +
      `- 影片：${storageStats.orphanedByType?.videos || 0} 個\n` +
      `- 音樂：${storageStats.orphanedByType?.music || 0} 個\n` +
      `- 文件：${storageStats.orphanedByType?.documents || 0} 個\n` +
      `- 播客：${storageStats.orphanedByType?.podcasts || 0} 個\n\n` +
      `推估可釋放空間：${formatFileSize(storageStats.orphanedSize || 0)}\n\n` +
      `這個操作不可逆轉！確定要繼續嗎？`
    );

    if (!confirmed) return;

    setCleaningStorage(true);
    setDeleteProgress({ 
      stage: '準備刪除', 
      current: 0, 
      total: storageStats.orphanedFiles, 
      message: '正在連接到 Appwrite...', 
      deleted: 0, 
      failed: 0 
    });
    
    try {
      const config = getAppwriteConfig();
      const params = new URLSearchParams();
      if (config.endpoint) params.set('_endpoint', config.endpoint);
      if (config.projectId) params.set('_project', config.projectId);
      if (config.databaseId) params.set('_database', config.databaseId);
      if (config.bucketId) params.set('_bucket', config.bucketId);
      if (config.apiKey) params.set('_key', config.apiKey);
      params.set('action', 'delete');

      setDeleteProgress({ 
        stage: '刪除中', 
        current: 0, 
        total: storageStats.orphanedFiles, 
        message: `正在刪除 0/${storageStats.orphanedFiles} 個檔案...`, 
        deleted: 0, 
        failed: 0 
      });

      const response = await fetch(`/api/storage-stats?${params.toString()}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '刪除失敗');
      }

      setDeleteProgress({ 
        stage: '完成', 
        current: data.deletedCount, 
        total: storageStats.orphanedFiles, 
        message: `刪除完成！成功 ${data.deletedCount} 個，失敗 ${data.failedCount} 個`, 
        deleted: data.deletedCount, 
        failed: data.failedCount 
      });
      
      await new Promise(resolve => setTimeout(resolve, 1500));

      alert(`✅ 刪除完成！\n\n` +
        `成功刪除：${data.deletedCount} 個檔案\n` +
        `失敗：${data.failedCount} 個\n` +
        `推估釋放空間：${formatFileSize(data.orphanedSize || 0)}`);
      
      setStorageStats(null);
    } catch (error) {
      setDeleteProgress({ 
        stage: '錯誤', 
        current: 0, 
        total: storageStats.orphanedFiles, 
        message: '刪除失敗', 
        deleted: 0, 
        failed: 0 
      });
      alert('❗ 刪除失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
    } finally {
      setCleaningStorage(false);
      setTimeout(() => setDeleteProgress(null), 1000);
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <SectionHeader
        title="鋒兄設定"
        subtitle="應用程式設定與偏好"
        showAccountLabel={true}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Appwrite 帳號切換 - 第一欄位 */}
        <DataCard className="p-6 md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <Key size={20} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Appwrite 帳號切換{appwriteConfig.nickname && <span className="ml-2 text-sm font-normal text-orange-600 dark:text-orange-400">({appwriteConfig.nickname})</span>}</h3>
              <p className="text-xs text-gray-400">基於使用者輸入資訊，儲存於瀏覽器 localStorage</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">帳號暱稱（選填）</label>
              <Input
                type="text"
                placeholder="例如：鋒兄正式帳號、測試帳號"
                value={appwriteConfig.nickname}
                onChange={(e) => setAppwriteConfig({...appwriteConfig, nickname: e.target.value})}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">NEXT_PUBLIC_APPWRITE_ENDPOINT</label>
              <Input 
                type="text" 
                placeholder="https://fra.cloud.appwrite.io/v1"
                value={appwriteConfig.endpoint}
                onChange={(e) => setAppwriteConfig({...appwriteConfig, endpoint: e.target.value})}
                className="font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">NEXT_PUBLIC_APPWRITE_PROJECT_ID</label>
              <Input 
                type="text" 
                placeholder="Project ID"
                value={appwriteConfig.projectId}
                onChange={(e) => setAppwriteConfig({...appwriteConfig, projectId: e.target.value})}
                className="font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">APPWRITE_DATABASE_ID</label>
              <Input 
                type="text" 
                placeholder="Database ID"
                value={appwriteConfig.databaseId}
                onChange={(e) => setAppwriteConfig({...appwriteConfig, databaseId: e.target.value})}
                className="font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">APPWRITE_BUCKET_ID</label>
              <Input 
                type="text" 
                placeholder="Bucket ID"
                value={appwriteConfig.bucketId}
                onChange={(e) => setAppwriteConfig({...appwriteConfig, bucketId: e.target.value})}
                className="font-mono text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">APPWRITE_API_KEY</label>
              <Input 
                type="password" 
                placeholder="API Key"
                value={appwriteConfig.apiKey}
                onChange={(e) => setAppwriteConfig({...appwriteConfig, apiKey: e.target.value})}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <Button 
              onClick={handleSaveConfig} 
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {configSaved ? (
                <><CheckCircle2 size={16} /> 已儲存，請重新整理網頁</>
              ) : (
                <>🔄 儲存 Appwrite 設定</>
              )}
            </Button>
            <Button 
              onClick={handleResetToDefault}
              variant="outline"
              className="w-full flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              🔄 重置為預設值（.env）
            </Button>
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                <span className="text-base">💡</span>
                <span>
                  <strong>動態切換：</strong>設定儲存後，重新整理網頁即可套用新的 Appwrite 帳號。所有功能（包含檔案上傳）都會使用新設定。
                </span>
              </p>
            </div>
          </div>
        </DataCard>

        {/* 資料庫欄位統計 - 第二欄位 */}
        <DataCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <Table2 size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg">資料庫欄位統計</h3>
              <p className="text-xs text-gray-400">單一 Table text 上限 15000</p>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : dbStats ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl mb-4">
                <div className="flex flex-col">
                  <span className="text-gray-600 dark:text-gray-300">總欄位數</span>
                  <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{dbStats.totalColumns || 0}</span>
                </div>
                <div className="flex gap-2">
                  {missingTablesCount > 0 && (
                    <Button 
                      onClick={handleBulkCreate}
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1"
                      title="一次建立所有不存在的表格"
                    >
                      <Plus size={14} /> 一鍵全建立
                    </Button>
                  )}
                  {mismatchTablesCount > 0 && (
                    <Button 
                      onClick={handleBulkRebuild}
                      size="sm"
                      variant="outline"
                      className="text-orange-600 border-orange-200 hover:bg-orange-50 flex items-center gap-1"
                      title="一次重建所有結構不一致的表格"
                    >
                      🔄 一鍵全重建
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {dbStats.collections && dbStats.collections.map(col => {
                  // 綠燈: 有資料, 黃燈: 無資料, 紅燈: Table不存在
                  const statusColor = col.error 
                    ? "bg-red-500" 
                    : col.documentCount > 0 
                      ? "bg-green-500" 
                      : "bg-yellow-500";
                  const statusTitle = col.error 
                    ? "Table 不存在" 
                    : col.documentCount > 0 
                      ? "Table 存在且有資料" 
                      : "Table 存在但無資料";
                  return (
                    <div key={col.name} className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-1 w-2.5 h-2.5 rounded-full ${statusColor}`}
                          title={statusTitle}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-gray-600 dark:text-gray-400">{col.name}</span>
                            {col.schemaMismatch && !col.error && (
                              <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded" title="結構不一致">
                                ❗
                              </span>
                            )}
                          </div>
                          {col.name === "subscription" && col.collectionId && (
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              ID: <span className="font-mono">{col.collectionId}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">{col.columnCount} 欄位</span>
                        <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{col.documentCount} 筆</span>
                        {col.error && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs text-red-600 border-red-300 hover:bg-red-50"
                            onClick={() => handleCreateTable(col.name)}
                            disabled={creating === col.name}
                          >
                            {creating === col.name ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <><Plus size={12} /> 建立</>
                            )}
                          </Button>
                        )}
                        {(col.name === "trialpurchase" || col.name === "reinstall" || col.name === "quota" || col.name === "shoppinglist") && col.schemaMismatch && !col.error && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCreateTable(col.name, true)}
                            disabled={creating !== null}
                            title="只補齊缺少欄位，保留既有帳號與序號"
                          >
                            {creating === col.name ? <Loader2 size={12} className="animate-spin" /> : "補齊欄位"}
                          </Button>
                        )}
                        {false && col.schemaMismatch && !col.error && !recentlyCreated.has(col.name) && (
                          <>
                            <span className="text-xs bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded" title="結構不一致">
                              ❗
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              onClick={() => handlePatchSchema(col.name)}
                              disabled={creating === col.name}
                              title="只補缺少欄位，不刪資料"
                            >
                              {creating === col.name ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                "補欄位"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs text-orange-600 border-orange-300 hover:bg-orange-50"
                              onClick={() => handleCreateTable(col.name, true)}
                              disabled={creating === col.name}
                              title="結構不一致，需要重建（會刪除資料）"
                            >
                              {creating === col.name ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                "重建"
                              )}
                            </Button>
                          </>
                        )}
                        {!col.schemaMismatch && !col.error && (
                          <span className="text-xs text-green-600 dark:text-green-400" title="結構一致">
                            ✔️
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400">無法取得資料</div>
          )}
        </DataCard>

        {/* 資料庫資訊 */}
        <DataCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Database size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-bold text-lg">資料庫</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Appwrite 雲端資料庫連線資訊
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">端點</span>
              <span className="font-mono text-xs">fra.cloud.appwrite.io</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Collections</span>
              <span className="font-medium">{dbStats?.totalCollections || 5}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">狀態</span>
              <span className="text-green-600 font-medium">已連線</span>
            </div>
          </div>
        </DataCard>

        {/* 主題設定 */}
        <DataCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Palette size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-bold text-lg">主題設定</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            選擇您喜歡的介面主題
          </p>
          <div className="flex gap-3">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => setTheme("light")}
              className="flex items-center gap-2"
            >
              <Sun size={16} />
              淺色
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => setTheme("dark")}
              className="flex items-center gap-2"
            >
              <Moon size={16} />
              深色
            </Button>
            <Button
              variant={theme === "system" ? "default" : "outline"}
              onClick={() => setTheme("system")}
              className="flex items-center gap-2"
            >
              <Settings size={16} />
              系統
            </Button>
          </div>
        </DataCard>

        {/* 語音設定 */}
        <DataCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <Mic size={20} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg">語音控制</h3>
              <p className="text-xs text-gray-400">全域語音 · Ctrl+Shift+V</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            調整語音指令的提示音與確認節奏，偏好會存在此瀏覽器。
          </p>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white/70 p-3 dark:border-gray-800 dark:bg-gray-950/40">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-gray-300"
                checked={voicePreferences.successSound}
                onChange={(event) => updateVoicePreferences({ successSound: event.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">安全操作成功音</span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">搜尋、重新整理等直接執行時播放輕提示音</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white/70 p-3 dark:border-gray-800 dark:bg-gray-950/40">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-gray-300"
                checked={voicePreferences.autoStartGlobal}
                onChange={(event) => updateVoicePreferences({ autoStartGlobal: event.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">開啟全域語音時自動開始聽</span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">關閉後只會打開面板，需再按「開始說話」</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white/70 p-3 dark:border-gray-800 dark:bg-gray-950/40">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-gray-300"
                checked={voicePreferences.confirmSafeActions}
                onChange={(event) => updateVoicePreferences({ confirmSafeActions: event.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">安全操作也要確認</span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">開啟後搜尋／切頁等也會先顯示摘要，較適合謹慎操作</span>
              </span>
            </label>
          </div>
        </DataCard>

        {/* 安全設定 */}
        <DataCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Shield size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-bold text-lg">安全性</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            帳號安全與隱私設定
          </p>
          <div className="text-sm text-gray-400">
            即將推出...
          </div>
        </DataCard>

        {/* 推播通知設定 */}
        <DataCard className="p-6 md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Bell size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg">推播通知</h3>
              <p className="text-xs text-gray-400">APP 關閉時仍可收到到期提醒</p>
            </div>
          </div>
          <div className="space-y-4">
            {notificationPermission === 'unsupported' ? (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-500">
                此瀏覽器不支援推播通知
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                  <span className="text-gray-600 dark:text-gray-400">通知權限</span>
                  <span className={`font-medium ${
                    notificationPermission === 'granted' ? 'text-green-600 dark:text-green-400' :
                    notificationPermission === 'denied' ? 'text-red-600 dark:text-red-400' :
                    'text-yellow-600 dark:text-yellow-400'
                  }`}>
                    {notificationPermission === 'granted' ? '已授權' :
                     notificationPermission === 'denied' ? '已拒絕' : '尚未設定'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                  <span className="text-gray-600 dark:text-gray-400">推播訂閱狀態</span>
                  <span className={`font-medium ${pushSubscribed ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                    {pushSubscribed ? '已啟用' : '未啟用'}
                  </span>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400 block">NEXT_PUBLIC_VAPID_PUBLIC_KEY</label>
                  <Input
                    value={pushConfig.publicKey}
                    onChange={(e) => setPushConfig({ publicKey: e.target.value })}
                    placeholder="請貼上 Web Push VAPID 公鑰"
                    className="font-mono text-sm"
                  />
                  <div className="flex gap-3">
                    <Button
                      onClick={handleSavePushConfig}
                      variant="outline"
                      className="flex-1"
                    >
                      儲存推播設定
                    </Button>
                  </div>
                </div>
                {notificationPermission === 'denied' && (
                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-xs text-red-700 dark:text-red-300">
                      通知權限已被拒絕。請至瀏覽器設定手動開啟通知權限，再重新整理頁面。
                    </p>
                  </div>
                )}
                <div className="flex gap-3">
                  {!pushSubscribed ? (
                    <Button
                      onClick={enablePush}
                      disabled={pushLoading || notificationPermission === 'denied'}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {pushLoading ? (
                        <><Loader2 size={16} className="animate-spin" /> 處理中...</>
                      ) : (
                        <><Bell size={16} /> 啟用推播通知</>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={disablePush}
                      disabled={pushLoading}
                      variant="outline"
                      className="flex-1 flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400"
                    >
                      {pushLoading ? (
                        <><Loader2 size={16} className="animate-spin" /> 處理中...</>
                      ) : (
                        <><Bell size={16} /> 取消推播通知</>
                      )}
                    </Button>
                  )}
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                    <span className="text-base">💡</span>
                    <span>
                      <strong>先儲存推播公鑰，再啟用推播通知。</strong> 每天 05:06（台灣時間）會自動推播到期提醒，即使 APP 完全關閉也能收到通知。
                    </span>
                  </p>
                </div>

                <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Activity size={18} className="text-indigo-600 dark:text-indigo-400" />
                      <div>
                        <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">通知自我檢測</p>
                        <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80">
                          檢查權限、SW、VAPID、Appwrite、到期掃描與 Email 設定
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        onClick={() => void handleNotificationSelfCheck(false)}
                        disabled={selfCheckLoading}
                        variant="outline"
                        className="flex items-center justify-center gap-2"
                      >
                        {selfCheckLoading ? (
                          <><Loader2 size={16} className="animate-spin" /> 檢測中...</>
                        ) : (
                          <><Activity size={16} /> 執行檢測</>
                        )}
                      </Button>
                      <Button
                        onClick={() => void handleNotificationSelfCheck(true)}
                        disabled={selfCheckLoading}
                        className="flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        {selfCheckLoading ? (
                          <><Loader2 size={16} className="animate-spin" /> 檢測中...</>
                        ) : (
                          <><Bell size={16} /> 檢測 + 測試 OS 通知</>
                        )}
                      </Button>
                    </div>
                  </div>

                  {selfCheckReport && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-indigo-900 dark:text-indigo-100">總評：</span>
                        <span className={`font-bold ${selfCheckStatusClass(selfCheckReport.overall)}`}>
                          {selfCheckStatusLabel(selfCheckReport.overall)}
                        </span>
                        <span className="text-xs text-indigo-700/70 dark:text-indigo-300/70">
                          通過 {selfCheckReport.summary.pass} · 警告 {selfCheckReport.summary.warn} · 失敗 {selfCheckReport.summary.fail} · 資訊 {selfCheckReport.summary.info}
                        </span>
                        <span className="text-xs text-indigo-600/60 dark:text-indigo-400/60">
                          {new Date(selfCheckReport.checkedAt).toLocaleString("zh-TW")}
                        </span>
                      </div>
                      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                        {selfCheckReport.items.map((row) => (
                          <div
                            key={row.id}
                            className="flex items-start gap-2 rounded-lg border border-indigo-100 bg-white/80 px-3 py-2 text-sm dark:border-indigo-900/60 dark:bg-gray-950/50"
                          >
                            {row.status === "pass" ? (
                              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
                            ) : row.status === "fail" ? (
                              <X size={16} className="mt-0.5 shrink-0 text-red-600" />
                            ) : row.status === "warn" ? (
                              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                            ) : (
                              <Info size={16} className="mt-0.5 shrink-0 text-sky-600" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-gray-800 dark:text-gray-100">{row.label}</span>
                                <span className={`text-xs font-semibold ${selfCheckStatusClass(row.status)}`}>
                                  {selfCheckStatusLabel(row.status)}
                                </span>
                                <span className="text-[10px] uppercase tracking-wide text-gray-400">{row.channel}</span>
                              </div>
                              <p className="mt-0.5 break-words text-xs text-gray-600 dark:text-gray-400">{row.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </DataCard>

        {/* Resend Email 通知設定 */}
        <DataCard className="p-6 md:col-span-2">
          <div className="flex flex-col gap-4 mb-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/30">
                <Mail size={20} className="text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Resend Email 通知</h3>
                <p className="text-xs text-gray-400">訂閱到期前一天、食品到期前一周各提醒一次</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50/60 px-3 py-2 dark:border-rose-900/50 dark:bg-rose-950/30">
              <label htmlFor="resend-slot-count" className="text-sm text-rose-700 dark:text-rose-300">
                顯示組數
              </label>
              <select
                id="resend-slot-count"
                value={resendVisibleSlotCount}
                onChange={(event) => setResendVisibleSlotCount(Number(event.target.value))}
                className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:border-rose-800 dark:bg-gray-950 dark:text-rose-200 dark:focus:ring-rose-900"
              >
                {RESEND_VISIBLE_SLOT_OPTIONS.map((count) => (
                  <option key={count} value={count}>
                    {count} 組
                  </option>
                ))}
              </select>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-rose-500 shadow-sm dark:bg-gray-950 dark:text-rose-300">
                已設定 {configuredResendSlotCount}/{RESEND_SLOT_COUNT}
              </span>
            </div>
          </div>
          <div className="space-y-4">
            {Array.from({ length: resendVisibleSlotCount }, (_, index) => {
              const slot = index + 1;
              const fields = getResendSlotFields(slot);
              return (
                <div key={slot} className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400 block">{fields.envApiKey}</label>
                    <Input
                      type="password"
                      value={resendConfig[fields.apiKey] || ''}
                      onChange={(e) => setResendConfig({ ...resendConfig, [fields.apiKey]: e.target.value })}
                      placeholder="re_..."
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400 block">通知收件 Email {slot === 1 ? '' : slot}</label>
                    <Input
                      type="email"
                      value={resendConfig[fields.toEmail] || ''}
                      onChange={(e) => setResendConfig({ ...resendConfig, [fields.toEmail]: e.target.value })}
                      placeholder={slot === 1 ? "you@example.com" : `you${slot}@example.com`}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              );
            })}
            <div className="space-y-2">
              <label className="text-sm text-gray-600 dark:text-gray-400 block">寄件人</label>
              <Input
                value={resendConfig.fromEmail}
                onChange={(e) => setResendConfig({ ...resendConfig, fromEmail: e.target.value })}
                placeholder="FengBro <onboarding@resend.dev>"
                className="font-mono text-sm"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleSaveResendConfig} variant="outline" className="flex-1">
                儲存 Resend 設定
              </Button>
              <Button
                onClick={handleTestResendNotification}
                disabled={resendTestLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white"
              >
                {resendTestLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> 測試中...</>
                ) : (
                  <><Send size={16} /> 測試到期 Email</>
                )}
              </Button>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950 rounded-lg border border-rose-200 dark:border-rose-800">
              <p className="text-xs text-rose-700 dark:text-rose-300">
                {`Vercel Cron 每天 05:16（台灣時間）檢查一次；部署環境至少需設定一組 RESEND_API_KEY / RESEND_TO_EMAIL，最多共 ${RESEND_SLOT_COUNT} 組，可設定到 RESEND_API_KEY${RESEND_SLOT_COUNT} / RESEND_TO_EMAIL${RESEND_SLOT_COUNT}。`}
              </p>
            </div>
          </div>
        </DataCard>

        {/* Appwrite Storage 清理 */}
        <DataCard className="p-6 md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <HardDrive size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Appwrite Storage 管理</h3>
              <p className="text-xs text-gray-400">統計與清理未引用的儲存檔案</p>
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              系統會掃描 Appwrite Storage 中的所有檔案，找出資料庫中未引用的多餘檔案（圖片、影片、音樂、文件、播客）。分段影片會連同 manifest 與所有 PART 一起納入引用判斷。
            </p>
            
            {/* 進度条 - 掃描 */}
            {scanProgress && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {scanProgress.stage}
                  </span>
                  <span className="text-xs text-blue-700 dark:text-blue-300">
                    {scanProgress.current}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2 mb-2">
                  <div 
                    className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${scanProgress.current}%` }}
                  />
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {scanProgress.message}
                </p>
              </div>
            )}
            
            {/* 進度条 - 刪除 */}
            {deleteProgress && (
              <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-red-900 dark:text-red-100">
                    {deleteProgress.stage}
                  </span>
                  <span className="text-xs text-red-700 dark:text-red-300">
                    {deleteProgress.current}/{deleteProgress.total}
                  </span>
                </div>
                <div className="w-full bg-red-200 dark:bg-red-900 rounded-full h-2 mb-2">
                  <div 
                    className="bg-red-600 dark:bg-red-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(deleteProgress.current / deleteProgress.total) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-red-700 dark:text-red-300">
                    {deleteProgress.message}
                  </p>
                  {deleteProgress.deleted !== undefined && deleteProgress.failed !== undefined && (
                    <span className="text-xs text-red-700 dark:text-red-300">
                      ✅ {deleteProgress.deleted} | ❌ {deleteProgress.failed}
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {storageStats && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">總檔案數</span>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{storageStats.totalFiles}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">已引用</span>
                    <p className="text-lg font-bold text-green-600">{storageStats.referencedFiles}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">多餘檔案</span>
                    <p className="text-lg font-bold text-red-600">{storageStats.orphanedFiles}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">推估可釋放</span>
                    <p className="text-lg font-bold text-red-600">{formatFileSize(storageStats.orphanedSize || 0)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Storage 總量</span>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatFileSize(storageStats.totalSize || 0)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">已引用空間</span>
                    <p className="text-lg font-bold text-green-600">{formatFileSize(storageStats.referencedSize || 0)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">多餘占比</span>
                    <p className="text-lg font-bold text-red-600">{(storageStats.orphanedSizePercentage || 0).toFixed(1)}%</p>
                  </div>
                </div>
                {storageStats.orphanedSizeByType && (
                  <div className="border-t border-amber-200 dark:border-amber-800 pt-3">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">多餘檔案推估空間：</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      {[
                        ['圖片', 'images'],
                        ['影片', 'videos'],
                        ['音樂', 'music'],
                        ['文件', 'documents'],
                        ['播客', 'podcasts'],
                        ['其他', 'other'],
                      ].map(([label, key]) => (
                        <div key={key} className="flex items-center justify-between px-2 py-1 bg-white dark:bg-gray-800 rounded">
                          <span className="text-gray-600 dark:text-gray-400">
                            {label} {storageStats.orphanedByType?.[key] || 0} 個
                          </span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {formatFileSize(storageStats.orphanedSizeByType?.[key] || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {storageStats.collectionCounts && (
                  <div className="border-t border-amber-200 dark:border-amber-800 pt-3">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">表格引用明細：</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      {Object.entries(storageStats.collectionCounts as Record<string, number>).map(([collection, count]) => (
                        <div key={collection} className="flex items-center justify-between px-2 py-1 bg-white dark:bg-gray-800 rounded">
                          <span className="text-gray-600 dark:text-gray-400">{collection}</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{count} 筆</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <Button
                onClick={handleCountOrphanedFiles}
                disabled={cleaningStorage}
                className="flex-1 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white"
              >
                {cleaningStorage ? (
                  <><Loader2 size={16} className="animate-spin" /> 統計中...</>
                ) : (
                  <><HardDrive size={16} /> 統計多餘檔案</>
                )}
              </Button>
              <Button
                onClick={handleDeleteOrphanedFiles}
                disabled={cleaningStorage || !storageStats || storageStats.orphanedFiles === 0}
                variant="outline"
                className="flex-1 flex items-center justify-center gap-2 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                {cleaningStorage ? (
                  <><Loader2 size={16} className="animate-spin" /> 刪除中...</>
                ) : (
                  <><Trash2 size={16} /> 刪除多餘檔案</>
                )}
              </Button>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                <span className="text-base">💡</span>
                <span>
                  <strong>使用步驟：</strong>1. 點擊「統計多餘檔案」查看數量  2. 確認後點擊「刪除多餘檔案」清理儲存空間
                </span>
              </p>
            </div>
          </div>
        </DataCard>
      </div>

      {/* 版本資訊 */}
      <DataCard className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg mb-1">應用程式版本</h3>
            <p className="text-sm text-gray-500">鋒兄管理系統 v{packageJson.version}</p>
          </div>
          <div className="text-right text-sm text-gray-400">
            <p>Next.js {packageJson.dependencies.next.replace(/^\^/, "")}</p>
            <p>React {packageJson.dependencies.react.replace(/^\^/, "")}</p>
          </div>
        </div>
      </DataCard>

      {/* 建立進度對話框 */}
      {progress && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-bold text-lg flex items-center gap-2">
                {progress.isComplete ? (
                  <CheckCircle2 size={20} className="text-green-500" />
                ) : progress.isError ? (
                  <X size={20} className="text-red-500" />
                ) : (
                  <Loader2 size={20} className="text-blue-500 animate-spin" />
                )}
                建立 {progress.tableName} Table
              </h3>
              {(progress.isComplete || progress.isError) && (
                <Button variant="ghost" size="sm" onClick={closeProgressDialog}>
                  <X size={18} />
                </Button>
              )}
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">進度</span>
                  <span className="font-mono font-bold text-blue-600">{progress.percent}%</span>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      progress.isError ? 'bg-red-500' : progress.isComplete ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
              
              {/* Current Status */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">{progress.message}</p>
                {progress.currentAttribute && !progress.isComplete && (
                  <p className="text-xs text-gray-400 mt-1 font-mono">
                    欄位: {progress.currentAttribute}
                  </p>
                )}
                {progress.collectionId && (
                  <p className="text-xs text-gray-400 mt-1 font-mono">
                    ID: {progress.collectionId}
                  </p>
                )}
              </div>

              {/* Column Counter */}
              {progress.totalColumns > 0 && (
                <div className="flex justify-center">
                  <span className="text-3xl font-bold text-gray-800 dark:text-gray-200">
                    {progress.currentColumn}
                  </span>
                  <span className="text-lg text-gray-400 self-end mb-1">
                    /{progress.totalColumns} 欄位
                  </span>
                </div>
              )}

              {/* Close Button */}
              {(progress.isComplete || progress.isError) && (
                <Button 
                  className="w-full" 
                  onClick={closeProgressDialog}
                  variant={progress.isError ? "destructive" : "default"}
                >
                  {progress.isError ? '關閉' : '完成'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
