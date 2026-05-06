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

type VoiceAction = {
  key: string;
  aliases: RegExp;
  labels: string[];
  risk: VoiceRisk;
  summary: string;
};

const zh = {
  home: "\u92d2\u5144\u9996\u9801",
  dashboard: "\u92d2\u5144\u5100\u8868",
  subscription: "\u92d2\u5144\u8a02\u95b1",
  food: "\u92d2\u5144\u98df\u54c1",
  notes: "\u92d2\u5144\u7b46\u8a18",
  common: "\u92d2\u5144\u5e38\u7528",
  images: "\u92d2\u5144\u5716\u7247",
  videos: "\u92d2\u5144\u5f71\u7247",
  music: "\u92d2\u5144\u97f3\u6a02",
  documents: "\u92d2\u5144\u6587\u4ef6",
  podcast: "\u92d2\u5144\u64ad\u5ba2",
  bank: "\u92d2\u5144\u9280\u884c",
  routine: "\u92d2\u5144\u4f8b\u884c",
  tools: "\u92d2\u5144\u5de5\u5177",
  settings: "\u92d2\u5144\u8a2d\u5b9a",
  about: "\u92d2\u5144\u95dc\u65bc",
};

const MODULE_VOICE_META: Record<string, { name: string; aliases: string[] }> = {
  home: { name: zh.home, aliases: [zh.home, "\u9996\u9801", "\u4e3b\u9801", "home"] },
  dashboard: { name: zh.dashboard, aliases: [zh.dashboard, "\u5100\u8868", "\u5100\u8868\u677f", "\u7e3d\u89bd", "\u7d71\u8a08", "dashboard"] },
  subscription: { name: zh.subscription, aliases: [zh.subscription, "\u8a02\u95b1", "\u6708\u8cbb", "\u6263\u6b3e", "subscription"] },
  food: { name: zh.food, aliases: [zh.food, "\u98df\u54c1", "\u98df\u7269", "\u5eab\u5b58", "\u5546\u54c1", "food"] },
  notes: { name: zh.notes, aliases: [zh.notes, "\u7b46\u8a18", "\u6587\u7ae0", "notes", "article"] },
  common: { name: zh.common, aliases: [zh.common, "\u5e38\u7528", "\u5e33\u865f", "\u7db2\u7ad9", "\u5e38\u7528\u5e33\u865f", "common"] },
  images: { name: zh.images, aliases: [zh.images, "\u5716\u7247", "\u7167\u7247", "\u5716\u5eab", "image", "images"] },
  videos: { name: zh.videos, aliases: [zh.videos, "\u5f71\u7247", "\u8996\u983b", "video", "videos"] },
  music: { name: zh.music, aliases: [zh.music, "\u97f3\u6a02", "\u6b4c\u66f2", "music"] },
  documents: { name: zh.documents, aliases: [zh.documents, "\u6587\u4ef6", "\u6a94\u6848", "document", "documents"] },
  podcast: { name: zh.podcast, aliases: [zh.podcast, "\u64ad\u5ba2", "\u97f3\u8a0a", "\u7bc0\u76ee", "podcast"] },
  "bank-stats": { name: zh.bank, aliases: [zh.bank, "\u9280\u884c", "\u8ca1\u52d9", "\u5e33\u6236", "bank"] },
  routine: { name: zh.routine, aliases: [zh.routine, "\u4f8b\u884c", "\u884c\u7a0b", "\u5f85\u8fa6", "\u7fd2\u6163", "routine"] },
  tools: { name: zh.tools, aliases: [zh.tools, "\u5de5\u5177", "\u6bd4\u50f9", "tools", "tool"] },
  settings: { name: zh.settings, aliases: [zh.settings, "\u8a2d\u5b9a", "\u8a2d\u7f6e", "\u914d\u7f6e", "settings"] },
  about: { name: zh.about, aliases: [zh.about, "\u95dc\u65bc", "\u8aaa\u660e", "\u5c08\u6848\u8aaa\u660e", "about"] },
};

const commonActions: VoiceAction[] = [
  { key: "search", aliases: /\u641c\u5c0b|\u67e5\u8a62|\u627e|search|find/, labels: [], risk: "safe", summary: "Search current page." },
  { key: "add", aliases: /\u65b0\u589e|\u5efa\u7acb|\u52a0\u5165|add|create/, labels: ["\u65b0\u589e", "\u5feb\u901f\u65b0\u589e"], risk: "review", summary: "Open the add/create flow on this page." },
  { key: "refresh", aliases: /\u91cd\u65b0\u6574\u7406|\u5237\u65b0|\u91cd\u6574|refresh|reload/, labels: ["\u91cd\u65b0\u6574\u7406", "\u5237\u65b0", "\u91cd\u6574"], risk: "safe", summary: "Refresh current page data." },
  { key: "selectAll", aliases: /\u5168\u9078|select all|selectall/, labels: ["\u5168\u9078"], risk: "review", summary: "Select all visible items on this page." },
  { key: "multiSelect", aliases: /\u591a\u9078|\u6279\u6b21|\u9078\u53d6\u6a21\u5f0f|multi/, labels: ["\u591a\u9078", "\u6279\u6b21"], risk: "review", summary: "Toggle multi-select or batch mode." },
  { key: "clearFilters", aliases: /\u6e05\u9664\u7be9\u9078|\u91cd\u7f6e\u7be9\u9078|\u986f\u793a\u5168\u90e8/, labels: ["\u6e05\u9664\u7be9\u9078", "\u5168\u90e8"], risk: "safe", summary: "Clear current filters." },
  { key: "deleteSelected", aliases: /\u522a\u9664\u9078\u53d6|\u522a\u9664\u5df2\u9078|\u6279\u6b21\u522a\u9664|delete selected/, labels: ["\u522a\u9664\u9078\u53d6", "\u6279\u6b21\u522a\u9664"], risk: "danger", summary: "Open delete selected flow. The page's own confirmation still applies." },
  { key: "importCsv", aliases: /\u532f\u5165.*csv|csv.*\u532f\u5165|import.*csv/, labels: ["\u532f\u5165 CSV", "Import CSV"], risk: "review", summary: "Start CSV import. File selection and preview still require confirmation." },
  { key: "exportCsv", aliases: /\u532f\u51fa.*csv|csv.*\u532f\u51fa|export.*csv/, labels: ["\u532f\u51fa CSV", "Export CSV"], risk: "safe", summary: "Export CSV from current page." },
  { key: "importZip", aliases: /\u532f\u5165.*zip|zip.*\u532f\u5165|import.*zip/, labels: ["\u532f\u5165 ZIP", "Import ZIP"], risk: "review", summary: "Start ZIP import. File selection and preview still require confirmation." },
  { key: "exportZip", aliases: /\u532f\u51fa.*zip|zip.*\u532f\u51fa|export.*zip/, labels: ["\u532f\u51fa ZIP", "Export ZIP"], risk: "safe", summary: "Export ZIP from current page." },
];

const moduleActions: Record<string, VoiceAction[]> = {
  home: [
    { key: "home-subscription", aliases: /\u8a02\u95b1|\u6263\u6b3e|\u6708\u8cbb/, labels: ["\u8a02\u95b1", "\u92d2\u5144\u8a02\u95b1"], risk: "safe", summary: "Navigate or focus subscription summary from home." },
    { key: "home-storage", aliases: /\u5132\u5b58|\u5bb9\u91cf|\u5a92\u9ad4/, labels: ["\u5132\u5b58", "\u5a92\u9ad4"], risk: "safe", summary: "Focus storage/media section from home." },
    { key: "home-expiring", aliases: /\u5feb\u5230\u671f|\u5373\u5c07|\u904e\u671f/, labels: ["\u5feb\u5230\u671f", "\u5373\u5c07\u5230\u671f", "\u904e\u671f"], risk: "safe", summary: "Focus expiring/urgent items on home." },
  ],
  dashboard: [
    { key: "dashboard-storage", aliases: /\u5132\u5b58|\u5bb9\u91cf|\u4f7f\u7528\u7387/, labels: ["\u5132\u5b58", "\u5bb9\u91cf"], risk: "safe", summary: "Focus storage metrics." },
    { key: "dashboard-subscription", aliases: /\u8a02\u95b1|\u6708\u8cbb|\u6263\u6b3e/, labels: ["\u8a02\u95b1", "\u6708\u8cbb"], risk: "safe", summary: "Focus subscription metrics." },
  ],
  subscription: [
    { key: "expired", aliases: /\u5df2\u904e\u671f|\u904e\u671f|\u903e\u671f|expired/, labels: ["\u5df2\u904e\u671f", "\u904e\u671f"], risk: "safe", summary: "Filter expired subscriptions." },
    { key: "due7", aliases: /7\s*\u5929\u5167|\u4e03\u5929\u5167|\u5373\u5c07\u6263\u6b3e|\u5feb\u5230\u671f/, labels: ["7 \u5929\u5167"], risk: "safe", summary: "Filter subscriptions due in 7 days." },
    { key: "nodate", aliases: /\u672a\u8a2d\u5b9a|\u672a\u6392\u6263\u6b3e|\u6c92\u65e5\u671f|\u7121\u65e5\u671f/, labels: ["\u672a\u6392\u6263\u6b3e", "\u672a\u8a2d\u5b9a\u6263\u6b3e\u65e5"], risk: "safe", summary: "Filter subscriptions without next billing date." },
    { key: "stopped", aliases: /\u4e0d\u7e8c\u8a02|\u505c\u6b62\u7e8c\u8a02|\u505c\u7528/, labels: ["\u4e0d\u7e8c\u8a02"], risk: "safe", summary: "Filter stopped subscriptions." },
    { key: "duplicates", aliases: /\u91cd\u8907|\u91cd\u8907\u8a02\u95b1|duplicate/, labels: ["\u91cd\u8907\u63d0\u9192", "\u67e5\u770b\u7b2c\u4e00\u7d44\u91cd\u8907"], risk: "safe", summary: "Open duplicate subscription reminder." },
  ],
  food: [
    { key: "food-expiring", aliases: /\u5feb\u904e\u671f|\u5373\u5c07\u904e\u671f|7\s*\u5929\u5167/, labels: ["7 \u5929\u5167", "\u5373\u5c07\u904e\u671f"], risk: "safe", summary: "Filter foods expiring soon." },
    { key: "food-expired", aliases: /\u5df2\u904e\u671f|\u904e\u671f/, labels: ["\u5df2\u904e\u671f", "\u904e\u671f"], risk: "safe", summary: "Filter expired foods." },
    { key: "food-stock", aliases: /\u5eab\u5b58|\u5546\u54c1|\u6578\u91cf/, labels: ["\u5eab\u5b58", "\u5546\u54c1\u5eab\u5b58"], risk: "safe", summary: "Focus inventory controls." },
  ],
  notes: [
    { key: "notes-pin", aliases: /\u91d8\u9078|\u91d8\u9078\u7b46\u8a18|\u91cd\u8981/, labels: ["\u91d8\u9078", "\u91cd\u8981"], risk: "safe", summary: "Filter or focus pinned notes." },
    { key: "notes-template", aliases: /\u7bc4\u672c|\u6a21\u677f|\u5feb\u901f\u7b46\u8a18/, labels: ["\u7bc4\u672c", "\u6a21\u677f"], risk: "review", summary: "Open note templates if available." },
  ],
  common: [
    { key: "common-site", aliases: /\u7db2\u7ad9|site|\u9023\u7d50|\u5e38\u7528\u7db2\u7ad9/, labels: ["\u7db2\u7ad9", "\u5e38\u7528\u7db2\u7ad9"], risk: "safe", summary: "Focus common sites." },
    { key: "common-account", aliases: /\u5e33\u865f|\u5bc6\u78bc|account/, labels: ["\u5e33\u865f", "\u5e38\u7528\u5e33\u865f"], risk: "safe", summary: "Focus common accounts." },
    { key: "common-copy", aliases: /\u8907\u88fd|copy/, labels: ["\u8907\u88fd"], risk: "review", summary: "Trigger copy on visible item if available." },
  ],
  images: [
    { key: "images-missing-cover", aliases: /\u7f3a\u5c01\u9762|\u6c92\u5c01\u9762|\u7121\u5c01\u9762/, labels: ["\u7f3a\u5c01\u9762", "\u6c92\u5c01\u9762"], risk: "safe", summary: "Filter images missing covers." },
    { key: "images-download", aliases: /\u4e0b\u8f09|\u532f\u51fa|\u5132\u5b58/, labels: ["\u4e0b\u8f09", "\u532f\u51fa"], risk: "safe", summary: "Trigger visible image export/download." },
  ],
  videos: [
    { key: "videos-youtube", aliases: /youtube|\u5207\u5230 youtube/, labels: ["YouTube"], risk: "safe", summary: "Switch video layout to YouTube style." },
    { key: "videos-bilibili", aliases: /bilibili|\u54f6\u54e9\u54f6\u54e9|\u5207\u5230 bilibili/, labels: ["Bilibili"], risk: "safe", summary: "Switch video layout to Bilibili style." },
    { key: "videos-duplicates", aliases: /\u91cd\u8907\u5f71\u7247|\u91cd\u8907|duplicate/, labels: ["\u91cd\u8907\u5f71\u7247", "\u91cd\u8907"], risk: "safe", summary: "Filter duplicate videos." },
    { key: "videos-cache", aliases: /\u5feb\u53d6|\u7de9\u5b58|cache/, labels: ["\u5feb\u53d6", "\u7de9\u5b58"], risk: "safe", summary: "Focus video cache manager." },
  ],
  music: [
    { key: "music-play", aliases: /\u64ad\u653e|play/, labels: ["\u64ad\u653e"], risk: "review", summary: "Trigger visible play button." },
    { key: "music-queue", aliases: /\u4f47\u5217|\u52a0\u5165\u4f47\u5217|queue/, labels: ["\u4f47\u5217", "\u52a0\u5165\u4f47\u5217"], risk: "review", summary: "Add visible music item to queue if available." },
  ],
  documents: [
    { key: "documents-preview", aliases: /\u9810\u89bd|preview|\u6253\u958b/, labels: ["\u9810\u89bd", "\u6253\u958b"], risk: "safe", summary: "Preview visible document if available." },
    { key: "documents-cache", aliases: /\u5feb\u53d6|\u7de9\u5b58|cache/, labels: ["\u5feb\u53d6", "\u7de9\u5b58"], risk: "safe", summary: "Focus document cache manager." },
  ],
  podcast: [
    { key: "podcast-play", aliases: /\u64ad\u653e|play/, labels: ["\u64ad\u653e"], risk: "review", summary: "Trigger visible podcast play button." },
    { key: "podcast-audio", aliases: /\u97f3\u8a0a|\u8072\u97f3|\u64ad\u5ba2/, labels: ["\u97f3\u8a0a", "\u64ad\u5ba2"], risk: "safe", summary: "Filter or focus podcast audio." },
  ],
  "bank-stats": [
    { key: "bank-income", aliases: /\u6536\u5165|\u5165\u5e33|income/, labels: ["\u6536\u5165", "\u5165\u5e33"], risk: "review", summary: "Start income transaction if available." },
    { key: "bank-expense", aliases: /\u652f\u51fa|\u82b1\u8cbb|expense/, labels: ["\u652f\u51fa", "\u82b1\u8cbb"], risk: "review", summary: "Start expense transaction if available." },
    { key: "bank-csv", aliases: /\u9280\u884c.*csv|csv.*\u9280\u884c/, labels: ["\u532f\u5165 CSV", "\u532f\u51fa CSV"], risk: "review", summary: "Trigger bank CSV action if available." },
  ],
  routine: [
    { key: "routine-today", aliases: /\u4eca\u5929|\u4eca\u65e5|today/, labels: ["\u4eca\u5929", "\u4eca\u65e5"], risk: "safe", summary: "Filter routine items for today if available." },
    { key: "routine-done", aliases: /\u5b8c\u6210|\u6253\u52fe|done/, labels: ["\u5b8c\u6210", "\u6253\u52fe"], risk: "review", summary: "Mark visible routine item done if available." },
  ],
  tools: [
    { key: "tools-compare", aliases: /\u6bd4\u50f9|\u50f9\u683c|\u641c\u50f9|compare/, labels: ["\u6bd4\u50f9", "\u641c\u50f9", "\u67e5\u8a62"], risk: "safe", summary: "Run or focus price comparison tool." },
    { key: "tools-open", aliases: /\u6253\u958b|\u958b\u555f|open/, labels: ["\u6253\u958b", "\u958b\u555f"], risk: "review", summary: "Open visible tool link if available." },
  ],
  settings: [
    { key: "settings-save", aliases: /\u5132\u5b58|\u4fdd\u5b58|save/, labels: ["\u5132\u5b58", "\u4fdd\u5b58"], risk: "review", summary: "Save settings. Review current settings before confirming." },
    { key: "settings-test", aliases: /\u6e2c\u8a66|\u6aa2\u67e5|test/, labels: ["\u6e2c\u8a66", "\u6aa2\u67e5"], risk: "safe", summary: "Run visible settings test/check." },
    { key: "settings-init", aliases: /\u521d\u59cb\u5316|\u5efa\u7acb\u8868|schema/, labels: ["\u521d\u59cb\u5316", "\u5efa\u7acb\u8868", "Schema"], risk: "danger", summary: "Open initialization/schema flow. Existing confirmation still applies." },
  ],
  about: [
    { key: "about-docs", aliases: /\u6587\u4ef6|\u8aaa\u660e|\u67b6\u69cb|docs/, labels: ["\u6587\u4ef6", "\u8aaa\u660e", "\u67b6\u69cb"], risk: "safe", summary: "Focus project documentation section." },
    { key: "about-tech", aliases: /\u6280\u8853|\u67b6\u69cb|next|appwrite/, labels: ["\u6280\u8853", "\u67b6\u69cb", "Appwrite"], risk: "safe", summary: "Focus technical overview section." },
  ],
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
    return input.type === "search" || text.includes("\u641c\u5c0b") || text.toLowerCase().includes("search");
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
  return text.replace(/\u641c\u5c0b|\u67e5\u8a62|\u627e|search|find/gi, " ").replace(/\s+/g, " ").trim();
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
  const [feedback, setFeedback] = useState("Try: open subscriptions, search Netflix, add, export CSV, select all, delete selected.");
  const [isListening, setIsListening] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<PendingCommand | null>(null);
  const [open, setOpen] = useState(false);

  const flatMenuItems = useMemo(() => {
    const flatten = (items: MenuItem[]): MenuItem[] => items.flatMap((item) => item.children?.length ? [item, ...flatten(item.children)] : [item]);
    return flatten(menuItems).filter((item) => !item.children?.length);
  }, [menuItems]);

  const currentIndex = flatMenuItems.findIndex((item) => item.id === currentModule);
  const currentModuleName = MODULE_VOICE_META[currentModule]?.name || "Current page";

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

    if (/\u4e0b\u4e00\u500b|\u4e0b\u4e00\u9801|next/.test(normalized)) {
      const next = flatMenuItems[(Math.max(currentIndex, 0) + 1) % flatMenuItems.length];
      return { action: "next", moduleId: next?.id, summary: `Switch to next menu: ${MODULE_VOICE_META[next?.id || ""]?.name || next?.label || "next module"}.`, risk: "safe" };
    }

    if (/\u4e0a\u4e00\u500b|\u4e0a\u4e00\u9801|previous|prev/.test(normalized)) {
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;
      const previous = flatMenuItems[(safeIndex - 1 + flatMenuItems.length) % flatMenuItems.length];
      return { action: "previous", moduleId: previous?.id, summary: `Switch to previous menu: ${MODULE_VOICE_META[previous?.id || ""]?.name || previous?.label || "previous module"}.`, risk: "safe" };
    }

    if (/\u9996\u9801|\u4e3b\u9801|home/.test(normalized)) {
      return { action: "home", moduleId: "home", summary: `Switch to ${zh.home}.`, risk: "safe" };
    }

    if (/\u641c\u5c0b|\u67e5\u8a62|\u627e|search|find/.test(normalized)) {
      const query = extractSearchQuery(text);
      if (query) return { action: "pageSearch", query, summary: `Search "${query}" in ${currentModuleName}.`, risk: "safe" };
    }

    const currentActions = [...(moduleActions[currentModule] || []), ...commonActions];
    const pageAction = currentActions.find((candidate) => candidate.aliases.test(normalized));
    if (pageAction) {
      return {
        action: "pageAction",
        labels: pageAction.labels,
        summary: `${pageAction.summary} Target: ${currentModuleName}.`,
        risk: pageAction.risk,
      };
    }

    const target = resolveModule(text);
    if (target) {
      return {
        action: "navigate",
        moduleId: target.id,
        summary: `Switch to ${MODULE_VOICE_META[target.id]?.name || target.label}.`,
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
      setFeedback("No matching menu or page action. Try: open subscriptions, search Netflix, add, export CSV, select all.");
      return;
    }
    setPendingCommand(command);
    setFeedback("Command parsed. Confirm once more before executing.");
  };

  const startVoiceInput = () => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      setFeedback("This browser does not support speech recognition. Use typed commands instead.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "zh-TW";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setIsListening(true);
      setOpen(true);
      setFeedback("Listening for a voice command...");
    };
    recognition.onresult = (event: any) => {
      handleVoiceText(event.results?.[0]?.[0]?.transcript || "");
    };
    recognition.onerror = () => {
      setFeedback("Speech recognition failed. Try again or use typed commands.");
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const confirmCommand = () => {
    if (!pendingCommand) return;

    if (pendingCommand.moduleId) {
      onNavigate(pendingCommand.moduleId);
      setFeedback("Menu switched.");
      setPendingCommand(null);
      setOpen(false);
      return;
    }

    if (pendingCommand.action === "pageSearch" && pendingCommand.query) {
      const ok = fillVisibleSearch(pendingCommand.query);
      setFeedback(ok ? `Searched: ${pendingCommand.query}` : "No visible search input found on this page.");
      setPendingCommand(null);
      return;
    }

    if (pendingCommand.action === "pageAction" && pendingCommand.labels) {
      const ok = clickVisibleControl(pendingCommand.labels);
      setFeedback(ok ? "Page action triggered. If a form, preview, or password phrase appears, confirm there too." : "No matching visible control found on this page.");
      setPendingCommand(null);
    }
  };

  const quickActions = ["\u65b0\u589e", "\u641c\u5c0b", "\u532f\u51fa CSV", "\u532f\u5165 CSV", "\u91cd\u65b0\u6574\u7406", "\u5168\u9078", "\u522a\u9664\u9078\u53d6"];

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
                  <h3 className="text-sm font-semibold text-gray-950 dark:text-gray-100">Global Voice Control</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Menus and page actions are parsed first, then require confirmation.</p>
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
              placeholder="Type or speak: open subscription / search Netflix / add / export CSV / select all"
            />
            <Button type="button" variant="outline" onClick={startVoiceInput} disabled={isListening} className="shrink-0 rounded-xl">
              <Mic className={`mr-1 h-4 w-4 ${isListening ? "animate-pulse text-red-500" : ""}`} />
              {isListening ? "Listening" : "Voice"}
            </Button>
            <Button type="button" onClick={() => handleVoiceText(transcript)} className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700">
              Parse
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
                Waiting For Second Confirmation
              </div>
              <div className="mt-1 leading-6">{pendingCommand.summary}</div>
              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPendingCommand(null)} className="rounded-xl bg-white/80">
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={confirmCommand}
                  className={pendingCommand.risk === "danger" ? "rounded-xl bg-red-600 hover:bg-red-700" : "rounded-xl bg-emerald-600 hover:bg-emerald-700"}
                >
                  Confirm
                </Button>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {quickActions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleVoiceText(item === "\u641c\u5c0b" ? `${item} ` : item)}
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
          if (!open) setFeedback("Try: open subscriptions, search Netflix, add, export CSV, select all, delete selected.");
        }}
        className="rounded-full bg-emerald-600 px-4 py-6 text-white shadow-[0_18px_48px_rgba(5,150,105,0.28)] hover:bg-emerald-700"
      >
        <Mic className="mr-2 h-5 w-5" />
        Global Voice
      </Button>
    </div>
  );
}
