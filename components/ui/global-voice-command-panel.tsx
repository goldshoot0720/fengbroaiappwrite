"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Compass, Mic, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MenuItem } from "@/types";

type VoiceRisk = "safe" | "review";

type PendingCommand = {
  action: "navigate" | "next" | "previous" | "home";
  moduleId?: string;
  summary: string;
  risk: VoiceRisk;
};

const MODULE_VOICE_META: Record<string, { name: string; aliases: string[]; examples: string[] }> = {
  home: { name: "鋒兄首頁", aliases: ["首頁", "主頁", "home", "鋒兄首頁"], examples: ["回首頁"] },
  dashboard: { name: "鋒兄儀表", aliases: ["儀表", "儀表板", "dashboard", "總覽", "統計"], examples: ["打開儀表板"] },
  subscription: { name: "鋒兄訂閱", aliases: ["訂閱", "subscription", "鋒兄訂閱", "月費", "扣款"], examples: ["打開鋒兄訂閱"] },
  food: { name: "鋒兄食品", aliases: ["食品", "食物", "food", "商品庫存", "庫存"], examples: ["切換到食品"] },
  notes: { name: "鋒兄筆記", aliases: ["筆記", "notes", "article", "文章", "鋒兄筆記"], examples: ["打開筆記"] },
  common: { name: "鋒兄常用", aliases: ["常用", "帳號", "網站", "common", "常用帳號"], examples: ["打開常用"] },
  images: { name: "鋒兄圖片", aliases: ["圖片", "照片", "image", "images", "圖庫"], examples: ["去圖片"] },
  videos: { name: "鋒兄影片", aliases: ["影片", "video", "videos", "鋒兄影片"], examples: ["打開影片"] },
  music: { name: "鋒兄音樂", aliases: ["音樂", "music", "歌曲", "鋒兄音樂"], examples: ["打開音樂"] },
  documents: { name: "鋒兄文件", aliases: ["文件", "document", "documents", "檔案", "鋒兄文件"], examples: ["打開文件"] },
  podcast: { name: "鋒兄播客", aliases: ["播客", "podcast", "音訊", "節目"], examples: ["打開播客"] },
  "bank-stats": { name: "鋒兄銀行", aliases: ["銀行", "bank", "財務", "帳戶", "鋒兄銀行"], examples: ["打開銀行"] },
  routine: { name: "鋒兄例行", aliases: ["例行", "routine", "行程", "待辦", "習慣"], examples: ["打開例行"] },
  tools: { name: "鋒兄工具", aliases: ["工具", "tool", "tools", "比價", "鋒兄工具"], examples: ["打開工具"] },
  settings: { name: "鋒兄設定", aliases: ["設定", "settings", "設置", "配置"], examples: ["打開設定"] },
  about: { name: "鋒兄關於", aliases: ["關於", "about", "說明", "專案說明"], examples: ["打開關於"] },
};

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
  const [feedback, setFeedback] = useState("可說：打開鋒兄訂閱、去圖片、下一個選單、上一個選單、回首頁。");
  const [isListening, setIsListening] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<PendingCommand | null>(null);
  const [open, setOpen] = useState(false);

  const flatMenuItems = useMemo(() => {
    const flatten = (items: MenuItem[]): MenuItem[] => items.flatMap((item) => item.children?.length ? [item, ...flatten(item.children)] : [item]);
    return flatten(menuItems).filter((item) => !item.children?.length);
  }, [menuItems]);

  const currentIndex = flatMenuItems.findIndex((item) => item.id === currentModule);

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
      setFeedback("聽到了，但沒有對應到選單。可試：打開訂閱、打開影片、去文件、下一個選單。");
      return;
    }
    setPendingCommand(command);
    setFeedback("已解析選單指令，請按「確認切換」完成第二次確認。");
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
      setFeedback("正在聽你說選單指令...");
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
    if (!pendingCommand?.moduleId) return;
    onNavigate(pendingCommand.moduleId);
    setPendingCommand(null);
    setFeedback("已切換選單。");
    setOpen(false);
  };

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 z-50 flex max-w-[calc(100vw-1.5rem)] flex-col items-start gap-2 md:bottom-6 md:left-auto md:right-6 md:max-w-[520px]">
      {open && (
        <div className="w-full rounded-[24px] border border-[var(--line-strong)] bg-white/92 p-4 shadow-[0_24px_80px_rgba(17,24,39,0.18)] backdrop-blur-xl dark:bg-gray-950/92">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                  <Compass className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-950 dark:text-gray-100">全域選單語音</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">所有選單都先解析，再二次確認切換。</p>
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
              placeholder="打字或語音：打開鋒兄訂閱 / 去文件 / 下一個選單"
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
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                等待第二次確認
              </div>
              <div className="mt-1 leading-6">{pendingCommand.summary}</div>
              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPendingCommand(null)} className="rounded-xl bg-white/80">
                  取消
                </Button>
                <Button type="button" onClick={confirmCommand} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
                  確認切換
                </Button>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
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
          if (!open) setFeedback("可說：打開鋒兄訂閱、去圖片、下一個選單、上一個選單、回首頁。");
        }}
        className="rounded-full bg-emerald-600 px-4 py-6 text-white shadow-[0_18px_48px_rgba(5,150,105,0.28)] hover:bg-emerald-700"
      >
        <Mic className="mr-2 h-5 w-5" />
        全域語音
      </Button>
    </div>
  );
}
