"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { AlertTriangle, CheckSquare, ChevronDown, Copy, Download, Pencil, Plus, Search, Square, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataCard } from "@/components/ui/data-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { FriendlyAiCrudShell } from "@/components/ui/friendly-ai-crud-shell";
import { FaviconImage } from "@/components/ui/favicon-image";
import { useSubscriptions, getSubscriptionExpiryInfo } from "@/hooks/useSubscriptions";
import { fetchApi } from "@/hooks/useApi";
import { API_ENDPOINTS } from "@/lib/constants";
import { formatCurrency, formatCurrencyWithExchange, formatDate } from "@/lib/formatters";
import { getAppwriteConfig, getExportFilename } from "@/lib/utils";
import { Subscription, SubscriptionFormData } from "@/types";

const INITIAL_FORM: SubscriptionFormData = {
  name: "",
  site: "",
  price: 0,
  nextdate: "",
  note: "",
  account: "",
  currency: "TWD",
  continue: true,
};

function AccountComboBox({
  value,
  onChange,
  accounts,
}: {
  value: string;
  onChange: (value: string) => void;
  accounts: string[];
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  const updatePosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const filtered = accounts.filter((item) => item.toLowerCase().includes(inputValue.toLowerCase()));

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          placeholder="帳號 / Email"
          onFocus={() => {
            updatePosition();
            setOpen(true);
          }}
          onChange={(event) => {
            setInputValue(event.target.value);
            onChange(event.target.value);
            updatePosition();
            setOpen(true);
          }}
          className="pr-8"
        />
        <button
          type="button"
          onClick={() => {
            if (open) {
              setOpen(false);
            } else {
              updatePosition();
              setOpen(true);
            }
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {open && filtered.length > 0 && typeof document !== "undefined"
        ? ReactDOM.createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
          >
            {filtered.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setInputValue(item);
                  onChange(item);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-gray-700"
              >
                {item}
              </button>
            ))}
          </div>,
          document.body
        )
        : null}
    </div>
  );
}

function getDraftSummary(form: SubscriptionFormData) {
  const price = Number(form.price || 0);
  const currency = form.currency || "TWD";
  const dueInfo = form.nextdate
    ? getSubscriptionExpiryInfo({
      $id: "draft",
      name: form.name || "草稿",
      site: form.site,
      price,
      nextdate: form.nextdate,
      note: form.note,
      account: form.account,
      currency,
      continue: form.continue,
    })
    : null;

  return {
    amountLabel: formatCurrencyWithExchange(price, currency),
    dueLabel: dueInfo
      ? dueInfo.isExpired
        ? `已過期 ${Math.abs(dueInfo.daysRemaining)} 天`
        : dueInfo.daysRemaining === 0
          ? "今天扣款"
          : `${dueInfo.daysRemaining} 天後扣款`
      : "未設定扣款日",
    dueTone: dueInfo
      ? dueInfo.isExpired
        ? "text-red-600 dark:text-red-400"
        : dueInfo.daysRemaining <= 7
          ? "text-amber-600 dark:text-amber-400"
          : "text-emerald-600 dark:text-emerald-400"
      : "text-gray-500 dark:text-gray-400",
  };
}

function SubscriptionFormCard({
  title,
  form,
  onChange,
  onSave,
  onCancel,
  existingAccounts,
  tone,
  saveLabel,
}: {
  title: string;
  form: SubscriptionFormData;
  onChange: (next: SubscriptionFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  existingAccounts: string[];
  tone: "green" | "blue";
  saveLabel: string;
}) {
  const summary = getDraftSummary(form);
  const toneClass = tone === "green"
    ? "border-green-200 bg-green-50/70 dark:border-green-800 dark:bg-green-900/10"
    : "border-blue-200 bg-blue-50/70 dark:border-blue-800 dark:bg-blue-900/10";

  return (
    <DataCard className={`p-4 sm:p-5 ${toneClass}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">只保留目前 subscription 表實際存在的欄位。</p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
          <div className="text-xs text-gray-500 dark:text-gray-400">AI 提示</div>
          <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{summary.amountLabel}</div>
          <div className={`text-xs ${summary.dueTone}`}>{summary.dueLabel}</div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input
          placeholder="服務名稱"
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
        />
        <Input
          placeholder="網站 URL"
          value={form.site || ""}
          onChange={(event) => onChange({ ...form, site: event.target.value })}
        />
        <Input
          type="number"
          min="0"
          placeholder="價格"
          value={form.price ?? 0}
          onChange={(event) => onChange({ ...form, price: Number(event.target.value) || 0 })}
        />
        <Input
          type="date"
          value={form.nextdate || ""}
          onChange={(event) => onChange({ ...form, nextdate: event.target.value })}
        />
        <AccountComboBox
          value={form.account || ""}
          onChange={(value) => onChange({ ...form, account: value })}
          accounts={existingAccounts}
        />
        <Input
          placeholder="幣別"
          value={form.currency || "TWD"}
          onChange={(event) => onChange({ ...form, currency: event.target.value.toUpperCase() })}
        />
        <Select
          value={form.continue === false ? "false" : "true"}
          onValueChange={(value) => onChange({ ...form, continue: value !== "false" })}
        >
          <SelectTrigger>
            <SelectValue placeholder="是否續訂" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">續訂中</SelectItem>
            <SelectItem value="false">不續訂</SelectItem>
          </SelectContent>
        </Select>
        <div className="md:col-span-2 xl:col-span-4">
          <Textarea
            placeholder="備註"
            value={form.note || ""}
            onChange={(event) => onChange({ ...form, note: event.target.value })}
            rows={3}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onSave}>{saveLabel}</Button>
        <Button variant="outline" onClick={onCancel}>取消</Button>
      </div>
    </DataCard>
  );
}

export default function SubscriptionManagement() {
  const {
    subscriptions,
    loading,
    error,
    stats,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    loadSubscriptions,
  } = useSubscriptions();
  const [initializingTable, setInitializingTable] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [renewalFilter, setRenewalFilter] = useState<"all" | "renewing" | "stopped">("all");
  const [dueFilter, setDueFilter] = useState<"all" | "expired" | "7days" | "30days" | "nodate">("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditForm, setInlineEditForm] = useState<SubscriptionFormData>(INITIAL_FORM);
  const [isInlineAdding, setIsInlineAdding] = useState(false);
  const [inlineAddForm, setInlineAddForm] = useState<SubscriptionFormData>(INITIAL_FORM);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importPreview, setImportPreview] = useState<{ data: SubscriptionFormData[]; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const importInputRef = useRef<HTMLInputElement>(null);

  const CSV_HEADERS = ["name", "site", "price", "nextdate", "note", "account", "currency", "continue"];
  const EXPECTED_COLUMN_COUNT = CSV_HEADERS.length;

  const monthOptions = useMemo(() => {
    const values = new Set<string>();
    subscriptions.forEach((sub) => {
      if (!sub.nextdate) return;
      const date = new Date(sub.nextdate);
      values.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    });
    return Array.from(values).sort();
  }, [subscriptions]);

  const existingAccounts = useMemo(() => {
    const values = subscriptions
      .map((sub) => sub.account)
      .filter((value): value is string => !!value && value.trim() !== "");
    return [...new Set(values)].sort();
  }, [subscriptions]);

  const expiredSubscriptions = useMemo(
    () => subscriptions.filter((sub) => sub.nextdate && getSubscriptionExpiryInfo(sub).daysRemaining < 0),
    [subscriptions]
  );

  const dueSoonSubscriptions = useMemo(
    () => subscriptions.filter((sub) => sub.nextdate && getSubscriptionExpiryInfo(sub).daysRemaining >= 0 && getSubscriptionExpiryInfo(sub).daysRemaining <= 7),
    [subscriptions]
  );

  const noDateSubscriptions = useMemo(
    () => subscriptions.filter((sub) => !sub.nextdate),
    [subscriptions]
  );

  const stoppedSubscriptions = useMemo(
    () => subscriptions.filter((sub) => sub.continue === false),
    [subscriptions]
  );

  const filteredSubscriptions = useMemo(() => {
    let result = subscriptions;

    if (renewalFilter === "renewing") {
      result = result.filter((sub) => sub.continue !== false);
    } else if (renewalFilter === "stopped") {
      result = result.filter((sub) => sub.continue === false);
    }

    if (dueFilter !== "all") {
      result = result.filter((sub) => {
        if (!sub.nextdate) return dueFilter === "nodate";
        const days = getSubscriptionExpiryInfo(sub).daysRemaining;
        if (dueFilter === "expired") return days < 0;
        if (dueFilter === "7days") return days >= 0 && days <= 7;
        if (dueFilter === "30days") return days >= 0 && days <= 30;
        return true;
      });
    }

    if (monthFilter !== "all") {
      result = result.filter((sub) => {
        if (!sub.nextdate) return false;
        const date = new Date(sub.nextdate);
        const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        return ym === monthFilter;
      });
    }

    if (!searchQuery.trim()) return result;
    const query = searchQuery.toLowerCase();
    return result.filter((sub) =>
      sub.$id?.toLowerCase().includes(query) ||
      sub.name?.toLowerCase().includes(query) ||
      sub.site?.toLowerCase().includes(query) ||
      sub.account?.toLowerCase().includes(query) ||
      sub.note?.toLowerCase().includes(query) ||
      sub.currency?.toLowerCase().includes(query)
    );
  }, [subscriptions, renewalFilter, dueFilter, monthFilter, searchQuery]);

  const isAllSelected = filteredSubscriptions.length > 0 && filteredSubscriptions.every((sub) => selectedIds.has(sub.$id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredSubscriptions.map((sub) => sub.$id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetInlineStates = () => {
    setInlineEditingId(null);
    setInlineEditForm(INITIAL_FORM);
    setIsInlineAdding(false);
    setInlineAddForm(INITIAL_FORM);
  };

  const handleInitializeSubscriptionTable = async () => {
    const confirmed = confirm("確定要立即初始化 subscription 表嗎？");
    if (!confirmed) return;

    setInitializingTable(true);
    try {
      const config = getAppwriteConfig();
      const params = new URLSearchParams({ table: "subscription" });
      if (config.endpoint) params.set("_endpoint", config.endpoint);
      if (config.projectId) params.set("_project", config.projectId);
      if (config.databaseId) params.set("_database", config.databaseId);
      if (config.apiKey) params.set("_key", config.apiKey);

      await new Promise<void>((resolve, reject) => {
        const eventSource = new EventSource(`/api/create-table?${params.toString()}`);
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "complete") {
              eventSource.close();
              resolve();
            } else if (data.type === "error") {
              eventSource.close();
              reject(new Error(data.message || "初始化失敗"));
            }
          } catch (error) {
            eventSource.close();
            reject(error);
          }
        };
        eventSource.onerror = () => {
          eventSource.close();
          reject(new Error("初始化連線中斷"));
        };
      });

      await loadSubscriptions();
      alert("subscription 表初始化完成");
    } catch (initError) {
      alert(`初始化失敗：${initError instanceof Error ? initError.message : "未知錯誤"}`);
    } finally {
      setInitializingTable(false);
    }
  };

  const handleInlineAddSave = async () => {
    if (!inlineAddForm.name?.trim()) {
      alert("請輸入服務名稱");
      return;
    }
    try {
      await createSubscription({
        ...inlineAddForm,
        price: Number(inlineAddForm.price || 0),
        currency: inlineAddForm.currency || "TWD",
        continue: inlineAddForm.continue !== false,
      });
      setIsInlineAdding(false);
      setInlineAddForm(INITIAL_FORM);
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : "新增失敗");
    }
  };

  const handleInlineEdit = (sub: Subscription) => {
    setInlineEditingId(sub.$id);
    setInlineEditForm({
      name: sub.name,
      site: sub.site || "",
      price: Number(sub.price || 0),
      nextdate: sub.nextdate ? formatDate(sub.nextdate) : "",
      note: sub.note || "",
      account: sub.account || "",
      currency: sub.currency || "TWD",
      continue: sub.continue !== false,
    });
    setIsInlineAdding(false);
  };

  const handleInlineSave = async () => {
    if (!inlineEditingId) return;
    if (!inlineEditForm.name?.trim()) {
      alert("請輸入服務名稱");
      return;
    }
    try {
      await updateSubscription(inlineEditingId, {
        ...inlineEditForm,
        price: Number(inlineEditForm.price || 0),
        currency: inlineEditForm.currency || "TWD",
        continue: inlineEditForm.continue !== false,
      });
      setInlineEditingId(null);
      setInlineEditForm(INITIAL_FORM);
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : "更新失敗");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("確定刪除這筆訂閱嗎？")) return;
    try {
      await deleteSubscription(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : "刪除失敗");
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`確定刪除 ${selectedIds.size} 筆訂閱嗎？`)) return;
    for (const id of selectedIds) {
      await fetchApi(`${API_ENDPOINTS.SUBSCRIPTION}/${id}`, { method: "DELETE" });
    }
    setSelectedIds(new Set());
    await loadSubscriptions();
  };

  const exportToCSV = () => {
    const escapeCSV = (value: string | number | boolean | null | undefined) => {
      if (value === null || value === undefined) return "";
      const stringValue = String(value);
      if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rows = [CSV_HEADERS.join(",")];
    subscriptions.forEach((sub) => {
      rows.push([
        escapeCSV(sub.name),
        escapeCSV(sub.site || ""),
        escapeCSV(sub.price || 0),
        escapeCSV(sub.nextdate ? formatDate(sub.nextdate) : ""),
        escapeCSV(sub.note || ""),
        escapeCSV(sub.account || ""),
        escapeCSV(sub.currency || "TWD"),
        escapeCSV(sub.continue !== false),
      ].join(","));
    });

    const blob = new Blob([`\uFEFF${rows.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = getExportFilename("subscription");
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const parseFullCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    const cleanText = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    let currentRow: string[] = [];
    let currentField = "";
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      if (inQuotes) {
        if (char === '"') {
          if (cleanText[i + 1] === '"') {
            currentField += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ",") {
          currentRow.push(currentField);
          currentField = "";
        } else if (char === "\n") {
          currentRow.push(currentField);
          if (currentRow.some((field) => field.trim())) rows.push(currentRow);
          currentRow = [];
          currentField = "";
        } else {
          currentField += char;
        }
      }
    }

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some((field) => field.trim())) rows.push(currentRow);
    }

    return rows;
  };

  const parseCSV = (text: string): { data: SubscriptionFormData[]; errors: string[] } => {
    const errors: string[] = [];
    const data: SubscriptionFormData[] = [];
    const rows = parseFullCSV(text);

    if (rows.length < 2) {
      errors.push("CSV 檔案至少需要表頭和一行資料");
      return { data, errors };
    }

    const headerValues = rows[0].map((value) => value.trim());
    if (headerValues.length !== EXPECTED_COLUMN_COUNT) {
      errors.push(`表頭欄位數量錯誤: 預期 ${EXPECTED_COLUMN_COUNT} 欄，實際 ${headerValues.length} 欄`);
      return { data, errors };
    }

    for (let i = 0; i < CSV_HEADERS.length; i++) {
      if (headerValues[i] !== CSV_HEADERS[i]) {
        errors.push(`表頭第 ${i + 1} 欄錯誤: 預期 "${CSV_HEADERS[i]}"，實際 "${headerValues[i]}"`);
      }
    }
    if (errors.length > 0) return { data, errors };

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      const lineNum = i + 1;
      if (values.length !== EXPECTED_COLUMN_COUNT) {
        errors.push(`第 ${lineNum} 行: 欄位數量錯誤`);
        continue;
      }
      if (!values[0]?.trim()) {
        errors.push(`第 ${lineNum} 行: name 欄位不能為空`);
        continue;
      }
      const continueValue = values[7]?.trim().toLowerCase();
      data.push({
        name: values[0].trim(),
        site: values[1]?.trim() || "",
        price: Number(values[2]) || 0,
        nextdate: values[3]?.trim() || "",
        note: values[4]?.trim() || "",
        account: values[5]?.trim() || "",
        currency: values[6]?.trim().toUpperCase() || "TWD",
        continue: continueValue === "false" ? false : true,
      });
    }

    return { data, errors };
  };

  const handleCsvFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      alert("請選擇 CSV 檔案");
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      setImportPreview(parseCSV(loadEvent.target?.result as string));
    };
    reader.readAsText(file, "UTF-8");
    event.target.value = "";
  };

  const executeImport = async () => {
    if (!importPreview || importPreview.data.length === 0) return;

    setImporting(true);
    setImportProgress({ current: 0, total: importPreview.data.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < importPreview.data.length; i++) {
      const formData = importPreview.data[i];
      setImportProgress({ current: i + 1, total: importPreview.data.length });
      try {
        const existing = subscriptions.find((sub) =>
          sub.name === formData.name && (sub.account || "") === (formData.account || "")
        ) || subscriptions.find((sub) => sub.name === formData.name);

        if (existing) {
          await fetchApi(`${API_ENDPOINTS.SUBSCRIPTION}/${existing.$id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
        } else {
          await fetchApi(API_ENDPOINTS.SUBSCRIPTION, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
        }
        successCount++;
      } catch {
        failCount++;
      }
    }

    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportPreview(null);
    await loadSubscriptions();
    alert(`匯入完成！\n成功: ${successCount} 筆\n失敗: ${failCount} 筆`);
  };

  const handleCopy = (sub: Subscription) => {
    setIsInlineAdding(true);
    setInlineEditingId(null);
    setInlineAddForm({
      name: `${sub.name} (複製)`,
      site: sub.site || "",
      price: Number(sub.price || 0),
      nextdate: sub.nextdate ? formatDate(sub.nextdate) : "",
      note: sub.note || "",
      account: sub.account || "",
      currency: sub.currency || "TWD",
      continue: sub.continue !== false,
    });
  };

  const renderSubscriptionRow = (sub: Subscription) => {
    const expiry = getSubscriptionExpiryInfo(sub);
    const isEditing = inlineEditingId === sub.$id;
    const renewalLabel = sub.continue === false ? "不續訂" : "續訂中";
    const dueLabel = !sub.nextdate
      ? "未設定"
      : expiry.isExpired
        ? `已過期 ${Math.abs(expiry.daysRemaining)} 天`
        : expiry.daysRemaining === 0
          ? "今天扣款"
          : `${expiry.daysRemaining} 天後`;

    if (isEditing) {
      return (
        <TableRow key={sub.$id} className="bg-blue-50/60 dark:bg-blue-900/10">
          <TableCell colSpan={8}>
            <SubscriptionFormCard
              title={`編輯 ${sub.name}`}
              form={inlineEditForm}
              onChange={setInlineEditForm}
              onSave={handleInlineSave}
              onCancel={() => {
                setInlineEditingId(null);
                setInlineEditForm(INITIAL_FORM);
              }}
              existingAccounts={existingAccounts}
              tone="blue"
              saveLabel="儲存修改"
            />
          </TableCell>
        </TableRow>
      );
    }

    return (
      <TableRow key={sub.$id}>
        <TableCell className="w-10">
          <button type="button" onClick={() => toggleSelect(sub.$id)} className="text-gray-500 hover:text-blue-600">
            {selectedIds.has(sub.$id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </button>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3">
            <FaviconImage siteUrl={sub.site || ""} siteName={sub.name} size={18} />
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">{sub.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{sub.$id}</div>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-sm text-gray-600 dark:text-gray-300">{sub.account || "-"}</TableCell>
        <TableCell className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatCurrencyWithExchange(sub.price || 0, sub.currency || "TWD")}</TableCell>
        <TableCell>
          <div className="text-sm text-gray-900 dark:text-gray-100">{sub.nextdate ? formatDate(sub.nextdate) : "-"}</div>
          <div className={`text-xs ${!sub.nextdate ? "text-gray-400" : expiry.isExpired ? "text-red-600 dark:text-red-400" : expiry.daysRemaining <= 7 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {dueLabel}
          </div>
        </TableCell>
        <TableCell>
          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${sub.continue === false ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"}`}>
            {renewalLabel}
          </span>
        </TableCell>
        <TableCell className="max-w-[260px] text-sm text-gray-600 dark:text-gray-300">{sub.note || "-"}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => handleInlineEdit(sub)} className="rounded-lg">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => handleCopy(sub)} className="rounded-lg">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(sub.$id)} className="rounded-lg text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  if (loading) return <FullPageLoading text="載入訂閱資料中..." />;

  return (
    <div className="space-y-4 lg:space-y-6">
      {error && (
        <DataCard className="border-red-200 bg-red-50 p-4 text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5" />
              <div>{error}</div>
            </div>
            {error.includes("Table subscription 不存在") && (
              <Button onClick={handleInitializeSubscriptionTable} disabled={initializingTable}>
                {initializingTable ? "初始化中..." : "立即初始化 subscription 表"}
              </Button>
            )}
          </div>
        </DataCard>
      )}

      <FriendlyAiCrudShell
        title="鋒兄訂閱"
        description="以目前 Appwrite `subscription` 表的真實欄位為準：服務名稱、網站、價格、下次扣款、備註、帳號、幣別、是否續訂。重點是先看出快到期與不續訂項目，再快速新增與批次清理。"
        searchPlaceholder="搜尋 ID、服務名稱、網站、帳號、備註、幣別..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeMode={dueFilter}
        onModeChange={(mode) => setDueFilter(mode as typeof dueFilter)}
        modeItems={[
          { key: "all", label: "全部", count: subscriptions.length },
          { key: "expired", label: "已過期", count: expiredSubscriptions.length },
          { key: "7days", label: "7 天內", count: dueSoonSubscriptions.length },
          { key: "nodate", label: "未排扣款", count: noDateSubscriptions.length },
        ]}
        summaries={[
          { label: "訂閱總數", value: stats.total, tone: "blue" },
          { label: "本月月費", value: formatCurrency(stats.totalMonthlyFee), tone: "green" },
          { label: "下月月費", value: formatCurrency(stats.nextMonthFee), tone: "neutral" },
          { label: "不續訂", value: stoppedSubscriptions.length, detail: "需留意是否還要保留資料", tone: stoppedSubscriptions.length > 0 ? "amber" : "neutral" },
        ]}
        suggestions={[
          expiredSubscriptions.length > 0
            ? { title: "先處理已過期", body: `目前有 ${expiredSubscriptions.length} 筆已過期訂閱，先確認是否已停用或只是還沒更新下次扣款日。`, tone: "red" }
            : { title: "到期狀態正常", body: "目前沒有已過期訂閱，重點可放在 7 天內的項目。", tone: "green" },
          dueSoonSubscriptions.length > 0
            ? { title: "短期決策區", body: `有 ${dueSoonSubscriptions.length} 筆 7 天內要扣款，最適合先做續訂或停用決策。`, tone: "amber" }
            : { title: "短期壓力低", body: "接下來 7 天沒有即將扣款的壓力，可先補帳號與備註。", tone: "blue" },
          noDateSubscriptions.length > 0
            ? { title: "資料待補", body: `有 ${noDateSubscriptions.length} 筆沒有下次扣款日期，提醒與排序都會不準。`, tone: "neutral" }
            : { title: "日期完整度", body: "扣款日期完整度不錯，之後最值得強化的是搜尋與批次整理。", tone: "green" },
        ]}
        toolbar={
          <>
            <input ref={importInputRef} type="file" accept=".csv" onChange={handleCsvFileSelect} className="hidden" />
            <Button variant="outline" onClick={() => importInputRef.current?.click()} className="rounded-xl">
              <Upload className="mr-1 h-4 w-4" />
              匯入 CSV
            </Button>
            <Button variant="outline" onClick={exportToCSV} className="rounded-xl">
              <Download className="mr-1 h-4 w-4" />
              匯出 CSV
            </Button>
            <Button variant="outline" onClick={toggleSelectAll} className="rounded-xl">
              {isAllSelected ? "取消全選" : "全選"}
            </Button>
            {selectedIds.size > 0 && (
              <Button onClick={handleDeleteSelected} className="rounded-xl bg-red-600 hover:bg-red-700 text-white">
                刪除選取 ({selectedIds.size})
              </Button>
            )}
            <Button
              onClick={() => {
                resetInlineStates();
                setIsInlineAdding(true);
              }}
              className="rounded-xl bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-1 h-4 w-4" />
              新增訂閱
            </Button>
          </>
        }
      />

      <DataCard className="p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <Select value={renewalFilter} onValueChange={(value: "all" | "renewing" | "stopped") => setRenewalFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="續訂狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部續訂狀態</SelectItem>
              <SelectItem value="renewing">續訂中</SelectItem>
              <SelectItem value="stopped">不續訂</SelectItem>
            </SelectContent>
          </Select>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger>
              <SelectValue placeholder="扣款月份" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部月份</SelectItem>
              {monthOptions.map((month) => (
                <SelectItem key={month} value={month}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => {
            setRenewalFilter("all");
            setDueFilter("all");
            setMonthFilter("all");
            setSearchQuery("");
          }}>
            清除篩選
          </Button>
        </div>
      </DataCard>

      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="border-b border-gray-200 p-6 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">匯入預覽</h3>
              <p className="mt-1 text-sm text-gray-500">請確認 subscription CSV 內容是否正確</p>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-6">
              {importPreview.errors.length > 0 && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                  <h4 className="mb-2 font-semibold text-red-600 dark:text-red-400">格式錯誤</h4>
                  <ul className="space-y-1 text-sm text-red-600 dark:text-red-400">
                    {importPreview.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
              {importPreview.data.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300">將匯入 {importPreview.data.length} 筆資料</h4>
                  {importPreview.data.map((item, index) => {
                    const existing = subscriptions.find((sub) =>
                      sub.name === item.name && (sub.account || "") === (item.account || "")
                    ) || subscriptions.find((sub) => sub.name === item.name);
                    return (
                      <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {item.account || "無帳號"} / {formatCurrencyWithExchange(item.price || 0, item.currency || "TWD")}
                          </div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${existing ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"}`}>
                          {existing ? "更新" : "新增"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 p-6 dark:border-gray-700">
              {importing ? (
                <div className="flex items-center gap-3">
                  <div className="h-2 w-48 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    匯入中 {importProgress.current}/{importProgress.total}
                  </span>
                </div>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setImportPreview(null)}>取消</Button>
                  <Button onClick={executeImport} disabled={importPreview.data.length === 0 || importPreview.errors.length > 0}>
                    確認匯入 ({importPreview.data.length} 筆)
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isInlineAdding && (
        <SubscriptionFormCard
          title="快速新增"
          form={inlineAddForm}
          onChange={setInlineAddForm}
          onSave={handleInlineAddSave}
          onCancel={() => {
            setIsInlineAdding(false);
            setInlineAddForm(INITIAL_FORM);
          }}
          existingAccounts={existingAccounts}
          tone="green"
          saveLabel="建立訂閱"
        />
      )}

      {filteredSubscriptions.length === 0 ? (
        <EmptyState
          icon={<Search className="h-10 w-10" />}
          title={subscriptions.length === 0 ? "尚無訂閱資料" : "無搜尋結果"}
          description={subscriptions.length === 0 ? "從上方快速新增第一筆訂閱資料。" : `找不到符合「${searchQuery}」與目前篩選條件的訂閱。`}
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <DataCard className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">選取</TableHead>
                    <TableHead>服務</TableHead>
                    <TableHead>帳號</TableHead>
                    <TableHead>價格</TableHead>
                    <TableHead>下次扣款</TableHead>
                    <TableHead>續訂</TableHead>
                    <TableHead>備註</TableHead>
                    <TableHead className="w-[150px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map(renderSubscriptionRow)}
                </TableBody>
              </Table>
            </DataCard>
          </div>

          <div className="space-y-3 lg:hidden">
            {filteredSubscriptions.map((sub) => {
              const expiry = getSubscriptionExpiryInfo(sub);
              const isEditing = inlineEditingId === sub.$id;

              if (isEditing) {
                return (
                  <SubscriptionFormCard
                    key={sub.$id}
                    title={`編輯 ${sub.name}`}
                    form={inlineEditForm}
                    onChange={setInlineEditForm}
                    onSave={handleInlineSave}
                    onCancel={() => {
                      setInlineEditingId(null);
                      setInlineEditForm(INITIAL_FORM);
                    }}
                    existingAccounts={existingAccounts}
                    tone="blue"
                    saveLabel="儲存修改"
                  />
                );
              }

              return (
                <DataCard key={sub.$id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <button type="button" onClick={() => toggleSelect(sub.$id)} className="mt-1 text-gray-500 hover:text-blue-600">
                        {selectedIds.has(sub.$id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <FaviconImage siteUrl={sub.site || ""} siteName={sub.name} size={18} />
                          <div className="font-semibold text-gray-900 dark:text-gray-100">{sub.name}</div>
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub.$id}</div>
                      </div>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${sub.continue === false ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"}`}>
                      {sub.continue === false ? "不續訂" : "續訂中"}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-500 dark:text-gray-400">價格</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrencyWithExchange(sub.price || 0, sub.currency || "TWD")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-500 dark:text-gray-400">下次扣款</span>
                      <span className={!sub.nextdate ? "text-gray-400" : expiry.isExpired ? "text-red-600 dark:text-red-400" : expiry.daysRemaining <= 7 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                        {!sub.nextdate ? "未設定" : `${formatDate(sub.nextdate)} / ${expiry.isExpired ? `已過期 ${Math.abs(expiry.daysRemaining)} 天` : expiry.daysRemaining === 0 ? "今天" : `${expiry.daysRemaining} 天後`}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-500 dark:text-gray-400">帳號</span>
                      <span className="text-gray-900 dark:text-gray-100">{sub.account || "-"}</span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{sub.note || "無備註"}</div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => handleInlineEdit(sub)} className="rounded-lg">
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      編輯
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => handleCopy(sub)} className="rounded-lg">
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      複製
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(sub.$id)} className="rounded-lg text-red-600">
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      刪除
                    </Button>
                  </div>
                </DataCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
