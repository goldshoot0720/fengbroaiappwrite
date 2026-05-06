"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Compass, Mic, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MenuItem } from "@/types";

type VoiceRisk = "safe" | "review" | "danger";

type PendingCommand = {
  action: "navigate" | "next" | "previous" | "home" | "pageAction" | "pageSearch";
  moduleId?: string;
  labels?: string[];
  query?: string;
  summary: string;
  risk: VoiceRisk;
};

const MODULE_VOICE_META: Record<string, { name: string; aliases: string[] }> = {
  home: { name: "鋒兄首頁", aliases: ["首頁", "主頁", "home", "鋒兄首頁"] },
  dashboard: { name: "鋒兄儀表", aliases: ["儀表", "儀表板", "dashboard", "總覽", "統計"] },
  subscription: { name: "鋒兄訂閱", aliases: ["訂閱", "subscription", "鋒兄訂閱", "月費", "扣款"] },
  food: { name: "鋒兄食品", aliases: ["食品", "食物", "food", "商品庫存", "庫存"] },
  notes: { name: "鋒兄筆記", aliases: ["筆記", "notes", "article", "文章", "鋒兄筆記"] },
  common: { name: "鋒兄常用", aliases: ["常用", "帳號", "網站", "common", "常用帳號"] },
  images: { name: "鋒兄圖片", aliases: ["圖片", "照片", "image", "images", "圖庫"] },
  videos: { name: "鋒兄影片", aliases: ["影片", "video", "videos", "鋒兄影片"] },
  music: { name: "鋒兄音樂", aliases: ["音樂", "music", "歌曲", "鋒兄音樂"] },
  documents: { name: "鋒兄文件", aliases: ["文件", "document", "documents", "檔案", "鋒兄文件"] },
  podcast: { name: "鋒兄播客", aliases: ["播客", "podcast", "音訊", "節目"] },
  "bank-stats": { name: "鋒兄銀行", aliases: ["銀行", "bank", "財務", "帳戶", "鋒兄銀行"] },
  routine: { name: "鋒兄例行", aliases: ["例行", "routine", "行程", "待辦", "習慣"] },
  tools: { name: "鋒兄工具", aliases: ["工具", "tool", "tools", "比價", "鋒兄工具"] },
  settings: { name: "鋒兄設定", aliases: ["設定", "settings", "設置", "配置"] },
  about: { name: "鋒兄關於", aliases: ["關於", "about", "說明", "專案說明"] },
};

const PAGE_ACTIONS: Array<{
  key: string;
  aliases: RegExp;
  labels: string[];
  risk: VoiceRisk;
  summary: string;
}> = [
  { key: "add", aliases: /新增|建立|加入|add|create/, labels: ["新增", "新增訂閱", "新增影片", "新增文件", "新增筆記", "新增圖片", "新增音樂", "新增播客", "快速新增"], risk: "review", summary: "觸發目前頁面的新增/建立按鈕。" },
  { key: "importCsv", aliases: /匯入.*csv|csv.*匯入|import.*csv/, labels: ["匯入 CSV", "Import CSV"], risk: "review", summary: "觸發目前頁面的 CSV 匯入；選檔後通常還會有預覽確認。" },
  { key: "exportCsv", aliases: /匯出.*csv|csv.*匯出|export.*csv/, labels: ["匯出 CSV", "Export CSV"], risk: "safe", summary: "觸發目前頁面的 CSV 匯出。" },
  { key: "importZip", aliases: /匯入.*zip|zip.*匯入|import.*zip/, labels: ["匯入 ZIP", "Import ZIP"], risk: "review", summary: "觸發目前頁面的 ZIP 匯入；選檔後通常還會有預覽確認。" },
  { key: "exportZip", aliases: /匯出.*zip|zip.*匯出|export.*zip/, labels: ["匯出 ZIP", "Export ZIP"], risk: "safe", summary: "觸發目前頁面的 ZIP 匯出。" },
  { key: "refresh", aliases: /重新整理|刷新|重整|refresh|reload/, labels: ["重新整理", "刷新", "重整"], risk: "safe", summary: "重新整理目前頁面的資料。" },
  { key: "selectAll", aliases: /全選|selectall|select all/, labels: ["全選"], risk: "review", summary: "觸發目前頁面的全選按鈕。" },
  { key: "multiSelect", aliases: /多選|批次|選取模式|multi/, labels: ["多選", "批次", "結束多選"], risk: "review", summary: "切換目前頁面的多選/批次模式。" },
  { key: "clearFilters", aliases: /清除篩選|清空篩選|重置篩選|全部|顯示全部/, labels: ["清除篩選", "全部"], risk: "safe", summary: "清除或重置目前頁面的篩選。" },
  { key: "deleteSelected", aliases: /刪除選取|刪除已選|批次刪除|delete selected/, labels: ["刪除選取", "批次刪除", "刪除已選"], risk: "danger", summary: "觸發目前頁面的刪除選取流程；仍需頁面原本的確認或口令。" },
  { key: "initialize", aliases: /初始化|建立表|create table/, labels: ["初始化", "建立表"], risk: "danger", summary: "觸發目前頁面的初始化/建立表流程；仍需頁面原本確認。" },
  { key: "dueSoon", aliases: /7天內|七天內|快到期|即將到期|即將扣款/, labels: ["7 天內", "快到期", "即將扣款"], risk: "safe", summary: "套用目前頁面的即將到期/7 天內篩選。" },
  { key: "expired", aliases: /已過期|過期|逾期|expired/, labels: ["已過期", "過期"], risk: "safe", summary: "套用目前頁面的過期篩選。" },
  { key: "duplicates", aliases: /重複|duplicate/, labels: ["重複提醒", "重複影片", "查看第一組重複"], risk: "safe", summary: "查看目前頁面的重複提醒或重複資料。" },
];

function normalizeVoiceText(text: string) {
  return text.toLowerCase().replace(/\s+/g, "");
}

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return (window as typeof window & {
    SpeechRecognition?: new () => any;
    webkitSpeechRecognition?: new () => any;
  }).SpeechRecognition || (window as typeof window & {
    webkitSpeechRecognition?: new () => any;
  }).webkitSpeechRecognition || null;
}

function isVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function getElementText(element: HTMLElement) {
  return [
    element.innerText,
    element.textContent,
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.getAttribute("placeholder"),
  ].filter(Boolean).join(" ");
}

function clickVisibleControl(labels: string[]) {
  const controls = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button'], label, a"));
  const target = controls.find((control) => {
    if (!isVisible(control)) return false;
    const text = getElementText(control);
    return labels.some((label) => text.includes(label));
  });

  target?.click();
  return Boolean(target);
}

function fillVisibleSearch(query: string) {
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input"));
  const target = inputs.find((input) => {
    if (!isVisible(input)) return false;
    const text = getElementText(input);
    return input.type === "search" || text.includes("搜尋") || text.toLowerCase().includes("search");
  });

  if (!target) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(target, query);
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
  target.focus();
  return true;
}

function extractSearchQuery(text: string) {
  return text.replace(/搜尋|查詢|找|search|find/gi, " ").replace(/\s+/g, " ").trim();
}

export function GlobalVoiceCommandPanel({
  currentModule,
  menuItems,
  onNavigate,
}: {
  currentModule: string;
  menuItems: MenuItem[];
  onNavigate: (moduleId: string) => void;
}) {
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState("可說：打開鋒兄訂閱、搜尋 Netflix、新增、匯出 CSV、全選、刪除選取、下一個選單。");
  const [isListening, setIsListening] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<PendingCommand | null>(null);
  const [open, setOpen] = useState(false);

  const flatMenuItems = useMemo(() => {
    const flatten = (items: MenuItem[]): MenuItem[] => items.flatMap((item) => item.children?.length ? [item, ...flatten(item.children)] : [item]);
    return flatten(menuItems).filter((item) => !item.children?.length);
  }, [menuItems]);

  const currentIndex = flatMenuItems.findIndex((item) => item.id === currentModule);
  const currentModuleName = MODULE_VOICE_META[currentModule]?.name || "目前頁面";

  const resolveModule = (text: string) => {
    const normalized = normalizeVoiceText(text);
    return flatMenuItems.find((item) => {
      const meta = MODULE_VOICE_META[item.id];
      const aliases = meta ? [meta.name, ...meta.aliases] : [item.label, item.id];
      return aliases.some((alias) => normalized.includes(normalizeVoiceText(alias)));
    }) || null;
  };

  const parseCommand = (text: string): PendingCommand | null => {
    const normalized = normalizeVoiceText(text);
    if (!normalized) return null;

    if (/下一個|下一頁|next/.test(normalized)) {
      const next = flatMenuItems[(Math.max(currentIndex, 0) + 1) % flatMenuItems.length];
      return { action: "next", moduleId: next?.id, summary: `切換到下一個選單：${MODULE_VOICE_META[next?.id || ""]?.name || next?.label || "下一個模組"}。`, risk: "safe" };
    }

    if (/上一個|上一頁|previous|prev/.test(normalized)) {
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;
      const previous = flatMenuItems[(safeIndex - 1 + flatMenuItems.length) % flatMenuItems.length];
      return { action: "previous", moduleId: previous?.id, summary: `切換到上一個選單：${MODULE_VOICE_META[previous?.id || ""]?.name || previous?.label || "上一個模組"}。`, risk: "safe" };
    }

    if (/首頁|主頁|home/.test(normalized)) {
      return { action: "home", moduleId: "home", summary: "切換到鋒兄首頁。", risk: "safe" };
    }

    if (/搜尋|查詢|找|search|find/.test(normalized)) {
      const query = extractSearchQuery(text);
      if (query) return { action: "pageSearch", query, summary: `在 ${currentModuleName} 搜尋「${query}」。`, risk: "safe" };
    }

    const pageAction = PAGE_ACTIONS.find((candidate) => candidate.aliases.test(normalized));
    if (pageAction) {
      return {
        action: "pageAction",
        labels: pageAction.labels,
        summary: `${pageAction.summary} 目標頁面：${currentModuleName}。`,
        risk: pageAction.risk,
      };
    }

    const target = resolveModule(text);
    if (target) {
      return {
        action: "navigate",
        moduleId: target.id,
        summary: `切換到 ${MODULE_VOICE_META[target.id]?.name || target.label}。`,
        risk: "safe",
      };
    }

    return null;
  };

  const handleVoiceText = (text: string) => {
    setTranscript(text);
    const command = parseCommand(text);
    if (!command) {
      setPendingCommand(null);
      setFeedback("聽到了，但沒有對應到選單或本頁操作。可試：打開訂閱、搜尋 Netflix、新增、匯出 CSV、全選。");
      return;
    }
    setPendingCommand(command);
    setFeedback("已解析指令，請按確認完成第二次確認。");
  };

  const startVoiceInput = () => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      setFeedback("此瀏覽器不支援語音辨識，請改用文字指令。");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "zh-TW";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setIsListening(true);
      setOpen(true);
      setFeedback("正在聽你說語音指令...");
    };
    recognition.onresult = (event: any) => {
      handleVoiceText(event.results?.[0]?.[0]?.transcript || "");
    };
    recognition.onerror = () => {
      setFeedback("語音辨識失敗，請再試一次或改用文字指令。");
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const confirmCommand = () => {
    if (!pendingCommand) return;

    if (pendingCommand.moduleId) {
      onNavigate(pendingCommand.moduleId);
      setFeedback("已切換選單。");
      setPendingCommand(null);
      setOpen(false);
      return;
    }

    if (pendingCommand.action === "pageSearch" && pendingCommand.query) {
      const ok = fillVisibleSearch(pendingCommand.query);
      setFeedback(ok ? `已搜尋：${pendingCommand.query}` : "目前頁面找不到可用的搜尋欄。");
      setPendingCommand(null);
      return;
    }

    if (pendingCommand.action === "pageAction" && pendingCommand.labels) {
      const ok = clickVisibleControl(pendingCommand.labels);
      setFeedback(ok ? "已觸發本頁操作；若出現預覽、表單或口令，請再確認一次。" : "目前頁面找不到對應按鈕。");
      setPendingCommand(null);
    }
  };

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 z-50 flex max-w-[calc(100vw-1.5rem)] flex-col items-start gap-2 md:bottom-6 md:left-auto md:right-6 md:max-w-[560px]">
      {open && (
        <div className="w-full rounded-[24px] border border-[var(--line-strong)] bg-white/92 p-4 shadow-[0_24px_80px_rgba(17,24,39,0.18)] backdrop-blur-xl dark:bg-gray-950/92">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                  <Compass className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-950 dark:text-gray-100">全域語音控制</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">選單切換與本頁常見操作都會先解析，再二次確認。</p>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              value={transcript}
              onChange={(event) => {
                setTranscript(event.target.value);
                setPendingCommand(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleVoiceText(transcript);
              }}
              placeholder="打字或語音：打開訂閱 / 搜尋 Netflix / 新增 / 匯出 CSV / 全選"
            />
            <Button type="button" variant="outline" onClick={startVoiceInput} disabled={isListening} className="shrink-0 rounded-xl">
              <Mic className={`mr-1 h-4 w-4 ${isListening ? "animate-pulse text-red-500" : ""}`} />
              {isListening ? "聆聽中" : "語音"}
            </Button>
            <Button type="button" onClick={() => handleVoiceText(transcript)} className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700">
              解析
            </Button>
          </div>

          <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
            {feedback}
          </div>

          {pendingCommand && (
            <div className={`mt-3 rounded-2xl border p-3 text-sm ${
              pendingCommand.risk === "danger"
                ? "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100"
                : pendingCommand.risk === "review"
                  ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
            }`}>
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                等待第二次確認
              </div>
              <div className="mt-1 leading-6">{pendingCommand.summary}</div>
              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPendingCommand(null)} className="rounded-xl bg-white/80">
                  取消
                </Button>
                <Button
                  type="button"
                  onClick={confirmCommand}
                  className={pendingCommand.risk === "danger" ? "rounded-xl bg-red-600 hover:bg-red-700" : "rounded-xl bg-emerald-600 hover:bg-emerald-700"}
                >
                  確認執行
                </Button>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {["新增", "搜尋", "匯出 CSV", "匯入 CSV", "重新整理", "全選", "刪除選取"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleVoiceText(item === "搜尋" ? "搜尋 " : item)}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {flatMenuItems.slice(0, 16).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleVoiceText(MODULE_VOICE_META[item.id]?.name || item.label)}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
              >
                {MODULE_VOICE_META[item.id]?.name || item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) setFeedback("可說：打開鋒兄訂閱、搜尋 Netflix、新增、匯出 CSV、全選、刪除選取、下一個選單。");
        }}
        className="rounded-full bg-emerald-600 px-4 py-6 text-white shadow-[0_18px_48px_rgba(5,150,105,0.28)] hover:bg-emerald-700"
      >
        <Mic className="mr-2 h-5 w-5" />
        全域語音
      </Button>
    </div>
  );
}
