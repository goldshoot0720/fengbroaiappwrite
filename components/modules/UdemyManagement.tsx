"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Download,
  GraduationCap,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { BulkDeleteDialog } from "@/components/ui/bulk-delete-dialog";
import { BulkSelectionControls, SelectionCheckbox } from "@/components/ui/bulk-selection-controls";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ManagementDeleteDialog } from "@/components/ui/management-delete-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchApi } from "@/hooks/useApi";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { API_ENDPOINTS } from "@/lib/constants";
import { emptyUdemyCourseForm, toUdemyCourseForm } from "@/lib/managementRecords";
import { buildUdemyCsv, parseUdemyCsv, splitUdemyTags, udemyImportKey, udemyWatchedPercent } from "@/lib/udemyCsv";
import { deleteByIds } from "@/lib/bulkSelection";
import { getExportFilename } from "@/lib/utils";
import type { UdemyCourse, UdemyCourseFormData } from "@/types";

type TagField = "instructor" | "language" | "framework" | "technology";
type GroupMode = TagField | "name" | "status";
type StatusFilter = "all" | "completed" | "incomplete";

const GROUP_MODES: ReadonlyArray<{ value: GroupMode; label: string }> = [
  { value: "instructor", label: "講師" },
  { value: "name", label: "課程名稱" },
  { value: "language", label: "程式語言" },
  { value: "framework", label: "框架" },
  { value: "technology", label: "技術名稱" },
  { value: "status", label: "收看狀態" },
];

/** 依欄位分類時，空白欄位歸到這一群（排在最後） */
const UNSET_LABEL: Record<TagField, string> = {
  instructor: "未填講師",
  language: "未填程式語言",
  framework: "未填框架",
  technology: "未填技術名稱",
};

const NO_INSTRUCTOR = UNSET_LABEL.instructor;

type CourseGroup = { key: string; title: string; courses: UdemyCourse[] };

/** 講師是單一名稱；程式語言／框架／技術名稱可多值，同一門課會出現在每個值的群組。 */
function groupValues(course: UdemyCourse, field: TagField): string[] {
  if (field === "instructor") return course.instructor?.trim() ? [course.instructor.trim()] : [];
  return splitUdemyTags(course[field]);
}

function compareText(a?: string, b?: string) {
  return String(a || "").localeCompare(String(b || ""), "zh-Hant");
}

function compareByName(a: UdemyCourse, b: UdemyCourse) {
  return compareText(a.name, b.name);
}

function groupCourses(courses: UdemyCourse[], mode: GroupMode): CourseGroup[] {
  const sorted = [...courses].sort(compareByName);
  if (mode === "name") return [{ key: "all", title: "", courses: sorted }];
  if (mode === "status") {
    return [
      { key: "incomplete", title: "課程尚未完整收看", courses: sorted.filter((course) => course.completed !== true) },
      { key: "completed", title: "課程已經完整收看", courses: sorted.filter((course) => course.completed === true) },
    ].filter((group) => group.courses.length > 0);
  }
  const unset = UNSET_LABEL[mode];
  const byValue = new Map<string, UdemyCourse[]>();
  for (const course of sorted) {
    const values = groupValues(course, mode);
    for (const value of values.length ? values : [unset]) {
      byValue.set(value, [...(byValue.get(value) || []), course]);
    }
  }
  return [...byValue.entries()]
    .sort(([a], [b]) => (a === unset ? 1 : b === unset ? -1 : compareText(a, b)))
    .map(([value, list]) => ({ key: value, title: value, courses: list }));
}

/** 群組合計：已觀看／總堂數與比重（已完整收看的課程以總堂數計） */
function summarize(courses: UdemyCourse[]) {
  let watched = 0;
  let total = 0;
  let hours = 0;
  for (const course of courses) {
    const courseTotal = Number(course.totalLectures) || 0;
    total += courseTotal;
    watched += course.completed ? courseTotal : Math.min(Number(course.watchedLectures) || 0, courseTotal || Infinity);
    hours += Number(course.totalHours) || 0;
  }
  return {
    watched,
    total,
    hours: Math.round(hours * 10) / 10,
    percent: total > 0 ? Math.round((watched / total) * 100) : 0,
    completedCount: courses.filter((course) => course.completed === true).length,
  };
}

function formatHours(value?: number) {
  const hours = Number(value) || 0;
  return hours ? `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小時` : "—";
}

function formatUpdated(value?: string) {
  return value ? value.slice(0, 7).replace("-", "/") : "未填";
}

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={`h-full rounded-full transition-[width] ${percent >= 100 ? "bg-success" : "bg-accent"}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-[var(--line-soft)] bg-[color:var(--panel-soft)] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            value === option.value
              ? "bg-[color:var(--panel-strong)] text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function UdemyManagement() {
  const [courses, setCourses] = useState<UdemyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("instructor");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UdemyCourseFormData>(() => emptyUdemyCourseForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UdemyCourse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const importCloseTimer = useRef<number | null>(null);
  const [importPreview, setImportPreview] = useState<{ data: UdemyCourseFormData[]; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ successCount: number; failCount: number } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteInput, setBulkDeleteInput] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const revision = useRef(0);
  const mounted = useRef(false);

  const loadCourses = async (silent = false) => {
    const requestRevision = ++revision.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await fetchApi<UdemyCourse[]>(`${API_ENDPOINTS.UDEMY}?t=${Date.now()}`, { cache: "no-store" });
      if (mounted.current && requestRevision === revision.current) {
        setCourses(Array.isArray(result) ? result : []);
      }
    } catch (err) {
      if (mounted.current && requestRevision === revision.current) {
        setError(err instanceof Error ? err.message : "載入失敗，請重新整理。");
      }
    } finally {
      if (mounted.current && requestRevision === revision.current) setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    void loadCourses();
    return () => {
      mounted.current = false;
      revision.current += 1;
    };
  }, []);

  const busy = saving || deletingId !== null || importing || bulkDeleting;

  // 輸入建議：各欄位已用過的值
  const suggestions = useMemo(() => {
    const collect = (field: TagField) =>
      [...new Set(courses.flatMap((course) => groupValues(course, field)))].sort(compareText);
    return {
      instructor: collect("instructor"),
      language: collect("language"),
      framework: collect("framework"),
      technology: collect("technology"),
    };
  }, [courses]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-Hant");
    return courses.filter((course) => {
      if (statusFilter === "completed" && course.completed !== true) return false;
      if (statusFilter === "incomplete" && course.completed === true) return false;
      return !normalizedQuery || [course.name, course.instructor, course.language, course.framework, course.technology]
        .some((value) => String(value || "").toLocaleLowerCase("zh-Hant").includes(normalizedQuery));
    });
  }, [courses, query, statusFilter]);

  const groups = useMemo(() => groupCourses(filtered, groupMode), [filtered, groupMode]);
  const overall = useMemo(() => summarize(courses), [courses]);

  const visibleIds = useMemo(() => filtered.map((course) => course.$id).filter(Boolean), [filtered]);
  const bulk = useBulkSelection(visibleIds);

  const openForm = (next: UdemyCourseFormData, id: string | null) => {
    setEditingId(id);
    setForm(next);
    setActionError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyUdemyCourseForm());
    setActionError(null);
  };

  useEffect(() => {
    if (!formOpen) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById("udemy-form")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [editingId, formOpen]);

  /** 堂數改動時：看到最後一堂就自動勾選「已完整收看」，往回改則取消。 */
  const setLectures = (patch: Pick<UdemyCourseFormData, "watchedLectures"> | Pick<UdemyCourseFormData, "totalLectures">) => {
    setForm((current) => {
      const next = { ...current, ...patch };
      const total = Number(next.totalLectures) || 0;
      const watched = Number(next.watchedLectures) || 0;
      return { ...next, completed: total > 0 ? watched >= total : next.completed };
    });
  };

  const setCompleted = (completed: boolean) => {
    setForm((current) => ({
      ...current,
      completed,
      // 勾選已完整收看時，已觀看堂數補滿到總堂數
      watchedLectures: completed && Number(current.totalLectures) > 0 ? current.totalLectures : current.watchedLectures,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setSaving(true);
    setActionError(null);
    try {
      const result = editingId
        ? await fetchApi<UdemyCourse>(`${API_ENDPOINTS.UDEMY}/${encodeURIComponent(editingId)}`, { method: "PUT", body: JSON.stringify(form) })
        : await fetchApi<UdemyCourse>(API_ENDPOINTS.UDEMY, { method: "POST", body: JSON.stringify(form) });
      setCourses((prev) => (editingId ? prev.map((course) => (course.$id === editingId ? result : course)) : [...prev, result]));
      closeForm();
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "儲存失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (course: UdemyCourse) => {
    if (busy) return;
    setDeletingId(course.$id);
    setActionError(null);
    try {
      await fetchApi(`${API_ENDPOINTS.UDEMY}/${encodeURIComponent(course.$id)}`, { method: "DELETE" });
      setCourses((prev) => prev.filter((current) => current.$id !== course.$id));
      setPendingDelete(null);
      if (editingId === course.$id) closeForm();
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "刪除失敗，請確認連線後再試一次。");
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(bulk.selectedIds).filter(Boolean);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    setBulkError(null);
    setBulkTotal(ids.length);
    setBulkProgress(0);
    const { failCount } = await deleteByIds(
      ids,
      (id) => fetchApi(`${API_ENDPOINTS.UDEMY}/${encodeURIComponent(id)}`, { method: "DELETE" }),
      (done) => setBulkProgress(done),
    );
    await loadCourses(true);
    setBulkDeleting(false);
    if (failCount > 0) {
      setBulkError(`有 ${failCount} 筆刪除失敗，請確認連線後再試。`);
      return;
    }
    bulk.clear();
    setBulkDeleteOpen(false);
    setBulkDeleteInput("");
  };

  const exportToCsv = () => {
    if (busy) return;
    try {
      const blob = new Blob([`﻿${buildUdemyCsv([...courses].sort(compareByName))}`], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = getExportFilename("udemy");
      link.click();
      URL.revokeObjectURL(link.href);
      setActionError(null);
    } catch (exportError) {
      setActionError(exportError instanceof Error ? exportError.message : "匯出 CSV 失敗");
    }
  };

  const handleCsvFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setActionError("請選擇 CSV 檔案");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (importCloseTimer.current) {
        window.clearTimeout(importCloseTimer.current);
        importCloseTimer.current = null;
      }
      setImportResult(null);
      setActionError(null);
      setImportPreview(parseUdemyCsv(typeof reader.result === "string" ? reader.result : ""));
    };
    reader.onerror = () => setActionError("讀取 CSV 檔案失敗");
    reader.readAsText(file, "UTF-8");
  };

  const closeImportPreview = () => {
    if (importing) return;
    if (importCloseTimer.current) {
      window.clearTimeout(importCloseTimer.current);
      importCloseTimer.current = null;
    }
    setImportPreview(null);
    setImportResult(null);
    setImportProgress({ current: 0, total: 0 });
  };

  const executeImport = async () => {
    if (!importPreview || importPreview.data.length === 0 || importPreview.errors.length > 0 || importing) return;
    setImporting(true);
    setImportResult(null);
    setImportProgress({ current: 0, total: importPreview.data.length });
    let successCount = 0;
    let failCount = 0;
    const index = new Map(courses.map((course) => [udemyImportKey(course), course.$id]));

    for (let i = 0; i < importPreview.data.length; i++) {
      const formData = importPreview.data[i];
      setImportProgress({ current: i + 1, total: importPreview.data.length });
      try {
        const key = udemyImportKey(formData);
        const existingId = index.get(key);
        if (existingId) {
          await fetchApi(`${API_ENDPOINTS.UDEMY}/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(formData) });
        } else {
          const created = await fetchApi<UdemyCourse>(API_ENDPOINTS.UDEMY, { method: "POST", body: JSON.stringify(formData) });
          index.set(key, created.$id);
        }
        successCount += 1;
      } catch {
        failCount += 1;
      }
    }

    try {
      await loadCourses(true);
      setImportResult({ successCount, failCount });
      if (failCount === 0) {
        importCloseTimer.current = window.setTimeout(() => {
          setImportPreview(null);
          setImportResult(null);
          setImportProgress({ current: 0, total: 0 });
          importCloseTimer.current = null;
        }, 1200);
      }
    } finally {
      setImporting(false);
    }
  };

  const rowActions = (course: UdemyCourse) => (
    <>
      <Button type="button" variant="ghost" size="icon" onClick={() => openForm(toUdemyCourseForm(course), course.$id)} disabled={busy || loading} aria-label={`編輯 ${course.name}`}><Pencil /></Button>
      <Button type="button" variant="ghost" size="icon" onClick={() => openForm({ ...toUdemyCourseForm(course), name: `${course.name || "未命名"} (複製)` }, null)} disabled={busy || loading} aria-label={`複製 ${course.name}`} title="複製此課程（預先填好欄位，供你確認後新增）"><Copy /></Button>
      <Button type="button" variant="ghost" size="icon" onClick={() => { setActionError(null); setPendingDelete(course); }} disabled={busy || loading} aria-label={`刪除 ${course.name}`} className="text-destructive hover:text-destructive"><Trash2 /></Button>
    </>
  );

  const selectionCheckbox = (course: UdemyCourse) => (
    <SelectionCheckbox
      checked={bulk.isSelected(course.$id)}
      onChange={() => bulk.toggle(course.$id)}
      label={`選取 ${course.name}`}
      disabled={busy || loading}
    />
  );

  const lecturesText = (course: UdemyCourse) => `${Number(course.watchedLectures) || 0} / ${Number(course.totalLectures) || 0} 堂`;

  return (
    <section className="space-y-6" aria-labelledby="udemy-title">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h1 id="udemy-title" className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
            鋒兄 Udemy
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            記錄 Udemy 課程、講師、程式語言／框架／技術與觀看進度。可依講師、課程名稱、程式語言、框架、技術名稱或收看狀態分類，一眼看出已觀看堂數與觀看比重。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFileSelect} />
          <Button type="button" variant="outline" onClick={() => void loadCourses()} disabled={loading || busy}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            重新整理
          </Button>
          <Button type="button" variant="outline" onClick={() => csvInputRef.current?.click()} disabled={loading || busy} title="從 CSV 匯入課程（相同課程名稱會更新）">
            <Upload />
            匯入 CSV
          </Button>
          <Button type="button" variant="outline" onClick={exportToCsv} disabled={busy} title="匯出目前全部課程為 CSV">
            <Download />
            匯出 CSV
          </Button>
          <BulkSelectionControls
            selectionMode={bulk.selectionMode}
            isAllSelected={bulk.isAllSelected}
            selectedCount={bulk.selectedCount}
            visibleCount={visibleIds.length}
            disabled={loading || busy}
            onSelectAll={bulk.selectAll}
            onClear={bulk.clear}
            onDeleteSelected={() => { setBulkError(null); setBulkDeleteInput(""); setBulkDeleteOpen(true); }}
          />
          <Button type="button" onClick={() => openForm(emptyUdemyCourseForm(), null)} disabled={loading || busy}>
            <Plus />
            新增課程
          </Button>
        </div>
      </header>

      {courses.length > 0 ? (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryTile label="課程數" value={`${courses.length} 門`} />
          <SummaryTile label="已經完整收看" value={`${overall.completedCount} / ${courses.length} 門`} />
          <SummaryTile label="已觀看堂數 / 課程總堂數" value={`${overall.watched} / ${overall.total} 堂`} />
          <SummaryTile label="已經觀看比重" value={`${overall.percent}%`}>
            <ProgressBar percent={overall.percent} label="全部課程觀看比重" />
          </SummaryTile>
        </dl>
      ) : null}

      {formOpen ? (
        <form id="udemy-form" onSubmit={handleSubmit} className="surface-raised scroll-mt-28 rounded-2xl p-4 sm:p-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">{editingId ? "編輯課程" : "新增課程"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">程式語言／框架／技術名稱可填多個，以「,」或「、」分隔。已觀看堂數到達課程總堂數時，會自動勾選「課程已經完整收看」。</p>
          </div>

          <fieldset disabled={busy} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FormField label="課程名稱" htmlFor="udemy-name" required className="sm:col-span-2">
              <Input
                id="udemy-name"
                maxLength={200}
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="例如 The Complete JavaScript Course"
                required
                autoFocus
              />
            </FormField>
            <FormField label="講師名稱" htmlFor="udemy-instructor">
              <Input
                id="udemy-instructor"
                maxLength={200}
                list="udemy-instructors"
                value={form.instructor || ""}
                onChange={(event) => setForm((current) => ({ ...current, instructor: event.target.value }))}
                placeholder="例如 Jonas Schmedtmann"
              />
              <datalist id="udemy-instructors">
                {suggestions.instructor.map((name) => <option key={name} value={name} />)}
              </datalist>
            </FormField>
            <TagInput id="udemy-language" label="程式語言" value={form.language || ""} options={suggestions.language} placeholder="例如 JavaScript、Python" onChange={(language) => setForm((current) => ({ ...current, language }))} />
            <TagInput id="udemy-framework" label="框架" value={form.framework || ""} options={suggestions.framework} placeholder="例如 React、Next.js" onChange={(framework) => setForm((current) => ({ ...current, framework }))} />
            <TagInput id="udemy-technology" label="技術名稱" value={form.technology || ""} options={suggestions.technology} placeholder="例如 Docker、AWS" onChange={(technology) => setForm((current) => ({ ...current, technology }))} />
            <FormField label="已觀看堂數" htmlFor="udemy-watched">
              <Input
                id="udemy-watched"
                type="number"
                inputMode="numeric"
                min={0}
                max={Number(form.totalLectures) > 0 ? form.totalLectures : undefined}
                step={1}
                value={form.watchedLectures ?? 0}
                onChange={(event) => setLectures({ watchedLectures: Math.max(0, Math.floor(Number(event.target.value) || 0)) })}
              />
            </FormField>
            <FormField label="課程總堂數" htmlFor="udemy-total">
              <Input
                id="udemy-total"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form.totalLectures ?? 0}
                onChange={(event) => setLectures({ totalLectures: Math.max(0, Math.floor(Number(event.target.value) || 0)) })}
              />
            </FormField>
            <FormField label="課程總時長（小時）" htmlFor="udemy-hours">
              <Input
                id="udemy-hours"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                value={form.totalHours ?? 0}
                onChange={(event) => setForm((current) => ({ ...current, totalHours: Math.max(0, Number(event.target.value) || 0) }))}
              />
            </FormField>
            <FormField label="課程上次更新時間" htmlFor="udemy-updated">
              <Input
                id="udemy-updated"
                type="date"
                value={form.courseUpdatedAt || ""}
                onChange={(event) => setForm((current) => ({ ...current, courseUpdatedAt: event.target.value }))}
              />
            </FormField>
            <div className="flex items-end">
              <label htmlFor="udemy-completed" className="flex h-10 cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground">
                <input
                  id="udemy-completed"
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  checked={form.completed === true}
                  onChange={(event) => setCompleted(event.target.checked)}
                />
                課程已經完整收看
              </label>
            </div>
            <div className="sm:col-span-2 xl:col-span-3">
              <p className="mb-1.5 text-sm text-muted-foreground">
                已經觀看比重 <span className="font-semibold tabular-nums text-foreground">{udemyWatchedPercent(form)}%</span>
              </p>
              <ProgressBar percent={udemyWatchedPercent(form)} label="此課程觀看比重" />
            </div>
          </fieldset>

          {actionError ? <ErrorMessage>{actionError}</ErrorMessage> : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>取消</Button>
            <Button type="submit" disabled={busy}>
              {saving ? <RefreshCw className="animate-spin" /> : null}
              {saving ? "儲存中…" : editingId ? "儲存變更" : "新增課程"}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-col gap-3">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">搜尋課程、講師、程式語言、框架或技術名稱</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="搜尋課程、講師、程式語言、框架或技術名稱" />
        </label>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm text-muted-foreground">依此分類</span>
          <SegmentedControl label="分類方式" options={GROUP_MODES} value={groupMode} onChange={setGroupMode} />
          <SegmentedControl
            label="收看狀態篩選"
            options={[
              { value: "all", label: "全部" },
              { value: "completed", label: "已完整收看" },
              { value: "incomplete", label: "尚未完整收看" },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/8 p-4 text-sm text-destructive">
          <p className="font-semibold">無法載入 Udemy 課程</p>
          <p className="mt-1 leading-6">{error}</p>
        </div>
      ) : null}
      {!formOpen && actionError ? <ErrorMessage>{actionError}</ErrorMessage> : null}

      {loading && courses.length === 0 ? (
        <LoadingSpinner text="載入 Udemy 課程…" className="min-h-48" />
      ) : error && courses.length === 0 ? null : filtered.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-7 text-muted-foreground" />}
          title={courses.length === 0 ? "尚無課程" : "沒有符合條件的課程"}
          description={courses.length === 0 ? "先新增第一門 Udemy 課程與觀看進度。" : "調整搜尋文字或收看狀態篩選後再試一次。"}
          action={courses.length === 0 ? <Button type="button" onClick={() => openForm(emptyUdemyCourseForm(), null)}><Plus />新增第一門</Button> : undefined}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const stats = summarize(group.courses);
            return (
              <section key={group.key} aria-label={group.title || "全部課程"} className="space-y-3">
                {group.title ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                      {groupMode === "instructor" ? <UserRound className="size-5 text-muted-foreground" />
                        : groupMode === "status" ? <CheckCircle2 className="size-5 text-muted-foreground" />
                          : groupMode === "language" ? <Code2 className="size-5 text-muted-foreground" />
                            : <Tag className="size-5 text-muted-foreground" />}
                      {group.title}
                      <span className="text-sm font-normal text-muted-foreground">{group.courses.length} 門</span>
                    </h2>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground sm:w-72">
                      <span className="shrink-0 tabular-nums">{stats.watched} / {stats.total} 堂</span>
                      <ProgressBar percent={stats.percent} label={`${group.title} 觀看比重`} />
                      <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-foreground">{stats.percent}%</span>
                    </div>
                  </div>
                ) : null}

                {/* 桌上型表格 */}
                <div className="hidden overflow-hidden rounded-2xl border border-[var(--line-soft)] xl:block">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        {bulk.selectionMode ? <TableHead className="w-[40px]"><span className="sr-only">選取</span></TableHead> : null}
                        <TableHead className="w-[26%]">課程名稱</TableHead>
                        <TableHead className="w-[13%]">講師名稱</TableHead>
                        <TableHead className="w-[16%]">程式語言／框架／技術</TableHead>
                        <TableHead className="w-[17%]">已觀看堂數 / 總堂數</TableHead>
                        <TableHead className="w-[10%]">總時長</TableHead>
                        <TableHead className="w-[10%]">課程上次更新</TableHead>
                        <TableHead className="w-[136px] text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.courses.map((course) => {
                        const percent = udemyWatchedPercent(course);
                        return (
                          <TableRow key={course.$id} className={bulk.selectionMode && bulk.isSelected(course.$id) ? "bg-destructive/5" : undefined}>
                            {bulk.selectionMode ? <TableCell>{selectionCheckbox(course)}</TableCell> : null}
                            <TableCell>
                              <p className="line-clamp-2 whitespace-normal break-words font-medium text-foreground" title={course.name}>{course.name}</p>
                              <div className="mt-1">
                                <StatusBadge status={course.completed ? "success" : "normal"}>
                                  {course.completed ? "已完整收看" : "尚未完整收看"}
                                </StatusBadge>
                              </div>
                            </TableCell>
                            <TableCell><p className="truncate text-sm text-foreground">{course.instructor?.trim() || "—"}</p></TableCell>
                            <TableCell><CourseTags course={course} /></TableCell>
                            <TableCell>
                              <div className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
                                <span className="text-foreground">{lecturesText(course)}</span>
                                <span className="font-semibold text-foreground">{percent}%</span>
                              </div>
                              <div className="mt-1.5"><ProgressBar percent={percent} label={`${course.name} 觀看比重`} /></div>
                            </TableCell>
                            <TableCell><p className="text-sm tabular-nums text-muted-foreground">{formatHours(course.totalHours)}</p></TableCell>
                            <TableCell><p className="text-sm tabular-nums text-muted-foreground">{formatUpdated(course.courseUpdatedAt)}</p></TableCell>
                            <TableCell><div className="flex items-center justify-end gap-1">{rowActions(course)}</div></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* 行動版卡片 */}
                <div className="grid gap-3 md:grid-cols-2 xl:hidden">
                  {group.courses.map((course) => {
                    const percent = udemyWatchedPercent(course);
                    return (
                      <div key={course.$id} className={`surface-inset rounded-2xl p-4 ${bulk.selectionMode && bulk.isSelected(course.$id) ? "ring-2 ring-destructive/30" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          {bulk.selectionMode ? selectionCheckbox(course) : null}
                          <div className="min-w-0 flex-1">
                            <p className="break-words font-semibold text-foreground">{course.name}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                              <UserRound className="size-3.5 shrink-0" />{course.instructor?.trim() || NO_INSTRUCTOR}
                            </p>
                            <div className="mt-2"><CourseTags course={course} /></div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">{rowActions(course)}</div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <ProgressBar percent={percent} label={`${course.name} 觀看比重`} />
                          <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">{percent}%</span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <p className="tabular-nums text-foreground">{lecturesText(course)}</p>
                          <p className="flex items-center gap-1.5 tabular-nums text-muted-foreground"><Clock className="size-4 shrink-0" />{formatHours(course.totalHours)}</p>
                          <p className="flex items-center gap-1.5 tabular-nums text-muted-foreground"><CalendarDays className="size-4 shrink-0" />課程上次更新 {formatUpdated(course.courseUpdatedAt)}</p>
                          <div>
                            <StatusBadge status={course.completed ? "success" : "normal"}>
                              {course.completed ? "已完整收看" : "尚未完整收看"}
                            </StatusBadge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ManagementDeleteDialog
        open={pendingDelete !== null}
        recordName={pendingDelete ? `${pendingDelete.name}${pendingDelete.instructor ? `（${pendingDelete.instructor}）` : ""}` : ""}
        busy={deletingId !== null}
        error={actionError}
        onCancel={() => { setPendingDelete(null); setActionError(null); }}
        onConfirm={() => { if (pendingDelete) void handleDelete(pendingDelete); }}
      />
      <BulkDeleteDialog
        open={bulkDeleteOpen}
        count={bulk.selectedCount}
        noun="課程"
        confirmPhrase="DELETE udemy"
        busy={bulkDeleting}
        progress={bulkProgress}
        total={bulkTotal}
        error={bulkError}
        confirmInput={bulkDeleteInput}
        onConfirmInputChange={setBulkDeleteInput}
        onCancel={() => { if (!bulkDeleting) { setBulkDeleteOpen(false); setBulkDeleteInput(""); setBulkError(null); } }}
        onConfirm={() => { void handleBulkDelete(); }}
      />
      {importPreview ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/35 p-4"
          onClick={(event) => { if (event.target === event.currentTarget) closeImportPreview(); }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="udemy-csv-import-title" className="surface-raised flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl">
            <div className="border-b border-[var(--line-soft)] p-5 sm:p-6">
              <h2 id="udemy-csv-import-title" className="font-display text-xl font-semibold text-foreground">匯入 CSV 預覽</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">相同課程名稱會更新既有課程，其餘新增。有格式錯誤時不會寫入。</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              {importResult ? (
                <div className="mb-4 rounded-xl bg-accent/10 px-3 py-2 text-sm text-foreground">
                  <p className="font-semibold">匯入完成</p>
                  <p className="mt-1">成功 {importResult.successCount} 筆 · 失敗 {importResult.failCount} 筆</p>
                </div>
              ) : null}
              {importPreview.errors.length > 0 ? (
                <div role="alert" className="mb-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <p className="font-semibold">格式錯誤</p>
                  <ul className="mt-1 space-y-1">
                    {importPreview.errors.map((item, index) => <li key={`${index}-${item}`}>• {item}</li>)}
                  </ul>
                </div>
              ) : null}
              {importPreview.data.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">將匯入 {importPreview.data.length} 筆</p>
                  {importPreview.data.map((course, index) => {
                    const existing = courses.some((current) => udemyImportKey(current) === udemyImportKey(course));
                    return (
                      <div key={`${course.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-accent/8 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{course.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {course.instructor || NO_INSTRUCTOR} · {course.watchedLectures} / {course.totalLectures} 堂 · {udemyWatchedPercent(course)}%
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${existing ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"}`}>
                          {existing ? "更新" : "新增"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">沒有可匯入的資料列。</p>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-[var(--line-soft)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:p-6">
              {importing ? (
                <div className="flex w-full items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-accent transition-all" style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">{importProgress.current}/{importProgress.total}</span>
                </div>
              ) : importResult ? (
                <Button type="button" variant="outline" onClick={closeImportPreview}>完成</Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={closeImportPreview}>取消</Button>
                  <Button type="button" onClick={() => void executeImport()} disabled={importPreview.data.length === 0 || importPreview.errors.length > 0}>
                    確認匯入（{importPreview.data.length} 筆）
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const TAG_STYLES: Record<Exclude<TagField, "instructor">, { label: string; className: string }> = {
  language: { label: "語言", className: "bg-info/12 text-info dark:bg-info/15" },
  framework: { label: "框架", className: "bg-accent/12 text-accent dark:bg-accent/15" },
  technology: { label: "技術", className: "bg-muted text-muted-foreground" },
};

function CourseTags({ course }: { course: UdemyCourse }) {
  const tags = (Object.keys(TAG_STYLES) as Array<keyof typeof TAG_STYLES>).flatMap((field) =>
    splitUdemyTags(course[field]).map((value) => ({ field, value })));
  if (tags.length === 0) return <p className="text-sm text-muted-foreground">—</p>;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="程式語言、框架與技術名稱">
      {tags.map(({ field, value }) => (
        <li
          key={`${field}-${value}`}
          title={`${TAG_STYLES[field].label}：${value}`}
          className={`max-w-full truncate rounded-md px-1.5 py-0.5 text-xs font-medium ${TAG_STYLES[field].className}`}
        >
          {value}
        </li>
      ))}
    </ul>
  );
}

function TagInput({ id, label, value, options, placeholder, onChange }: {
  id: string;
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  // datalist 只能補整格；多值時以最後一個逗號後的片段比對建議
  const prefix = value.includes(",") || value.includes("、") ? value.replace(/[^,、]*$/, "") : "";
  const used = new Set(splitUdemyTags(value));
  return (
    <FormField label={label} htmlFor={id}>
      <Input id={id} maxLength={200} list={`${id}-options`} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      <datalist id={`${id}-options`}>
        {options.filter((option) => !used.has(option)).map((option) => <option key={option} value={`${prefix}${option}`} />)}
      </datalist>
    </FormField>
  );
}

function SummaryTile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="surface-inset rounded-2xl p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">{value}</dd>
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

function FormField({ label, htmlFor, required, className, children }: { label: string; htmlFor: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}{required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{children}</p>;
}
