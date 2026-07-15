"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Compass, Mic, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRecordingClock, playVoiceSuccessTone, useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { getVoicePreferences, shouldAutoExecuteVoiceRisk } from "@/lib/voicePreferences";
import { MenuItem } from "@/types";

type VoiceRisk = "safe" | "review" | "danger";


type PendingCommand = {
  action:
    | "navigate"
    | "next"
    | "previous"
    | "home"
    | "pageAction"
    | "pageSearch"
    | "pageFill"
    | "clickText"
    | "clickOrdinal"
    | "focusedFill"
    | "clearFocused"
    | "adjustFocused"
    | "scroll";
  moduleId?: string;
  labels?: string[];
  query?: string;
  fields?: VoiceField[];
  clickText?: string;
  ordinal?: number;
  focusedValue?: string;
  adjustAmount?: number;
  adjustUnit?: "number" | "days";
  scrollTarget?: "top" | "bottom" | "up" | "down";
  summary: string;
  risk: VoiceRisk;
};

type VoiceFieldKey =
  | "name"
  | "title"
  | "amount"
  | "price"
  | "date"
  | "category"
  | "shop"
  | "site"
  | "account"
  | "password"
  | "currency"
  | "url"
  | "note";

type VoiceField = {
  key: VoiceFieldKey;
  value: string;
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
  videos: { name: zh.videos, aliases: [zh.videos, "\u5f71\u7247", "\u8996\u983b", "\u5f71\u97f3", "\u92d2\u5144 tube", "video", "videos", "tube"] },
  music: { name: zh.music, aliases: [zh.music, "\u97f3\u6a02", "\u6b4c\u66f2", "\u97f3\u6a02\u7ba1\u7406", "music", "song"] },
  documents: { name: zh.documents, aliases: [zh.documents, "\u6587\u4ef6", "\u6a94\u6848", "\u6587\u6a94", "\u8cc7\u6599", "document", "documents", "file"] },
  podcast: { name: zh.podcast, aliases: [zh.podcast, "\u64ad\u5ba2", "\u97f3\u8a0a", "\u7bc0\u76ee", "podcast"] },
  "bank-stats": { name: zh.bank, aliases: [zh.bank, "\u9280\u884c", "\u8ca1\u52d9", "\u5e33\u6236", "\u9280\u884c\u7d71\u8a08", "\u8cc7\u91d1", "bank", "finance"] },
  routine: { name: zh.routine, aliases: [zh.routine, "\u4f8b\u884c", "\u884c\u7a0b", "\u5f85\u8fa6", "\u7fd2\u6163", "\u4f8b\u884c\u516c\u4e8b", "routine", "habit"] },
  tools: { name: zh.tools, aliases: [zh.tools, "\u5de5\u5177", "\u6bd4\u50f9", "\u5c0f\u5de5\u5177", "\u67e5\u50f9", "\u5716\u7247\u8a9e\u97f3", "\u5716\u7247\u8a9e\u97f3\u5f71\u7247", "tools", "tool"] },
  "image-voice-video": { name: "\u5716\u7247\u8a9e\u97f3\u5f71\u7247", aliases: ["\u5716\u7247\u8a9e\u97f3\u5f71\u7247", "\u5716\u7247\u8a9e\u97f3", "\u5716\u52a0\u8072", "image voice video", "ivv"] },
  settings: { name: zh.settings, aliases: [zh.settings, "\u8a2d\u5b9a", "\u8a2d\u7f6e", "\u914d\u7f6e", "\u7cfb\u7d71\u8a2d\u5b9a", "settings", "config"] },
  about: { name: zh.about, aliases: [zh.about, "\u95dc\u65bc", "\u8aaa\u660e", "\u5c08\u6848\u8aaa\u660e", "about"] },
};

const commonActions: VoiceAction[] = [
  { key: "search", aliases: /\u641c\u5c0b|\u67e5\u8a62|\u627e|search|find/, labels: [], risk: "safe", summary: "搜尋目前頁面。" },
  { key: "add", aliases: /\u65b0\u589e|\u5efa\u7acb|\u52a0\u5165|\u8a18\u9304|\u65b0\u5efa|add|create|new/, labels: ["\u65b0\u589e", "\u5feb\u901f\u65b0\u589e", "\u5efa\u7acb"], risk: "review", summary: "開啟此頁的新增流程。" },
  { key: "edit", aliases: /\u7de8\u8f2f|\u4fee\u6539|\u8abf\u6574|edit|modify/, labels: ["\u7de8\u8f2f", "\u4fee\u6539"], risk: "review", summary: "開啟可見的編輯流程。" },
  { key: "save", aliases: /\u5132\u5b58|\u4fdd\u5b58|\u78ba\u8a8d|\u9001\u51fa|save|submit|confirm/, labels: ["\u5132\u5b58", "\u4fdd\u5b58", "\u78ba\u8a8d", "\u66f4\u65b0", "\u65b0\u589e"], risk: "review", summary: "觸發可見的儲存／確認按鈕。" },
  { key: "cancel", aliases: /\u53d6\u6d88|\u95dc\u9589|\u6536\u8d77|cancel|close/, labels: ["\u53d6\u6d88", "\u95dc\u9589", "\u6536\u8d77"], risk: "safe", summary: "取消或關閉目前流程。" },
  { key: "refresh", aliases: /\u91cd\u65b0\u6574\u7406|\u5237\u65b0|\u91cd\u6574|refresh|reload/, labels: ["\u91cd\u65b0\u6574\u7406", "\u5237\u65b0", "\u91cd\u6574"], risk: "safe", summary: "重新整理目前頁面資料。" },
  { key: "selectAll", aliases: /\u5168\u9078|select all|selectall/, labels: ["\u5168\u9078"], risk: "review", summary: "全選目前可見項目。" },
  { key: "clearSelection", aliases: /\u53d6\u6d88\u5168\u9078|\u6e05\u9664\u9078\u53d6|clear selection/, labels: ["\u53d6\u6d88\u5168\u9078", "\u53d6\u6d88\u9078\u53d6"], risk: "safe", summary: "清除目前選取。" },
  { key: "multiSelect", aliases: /\u591a\u9078|\u6279\u6b21|\u9078\u53d6\u6a21\u5f0f|multi/, labels: ["\u591a\u9078", "\u6279\u6b21"], risk: "review", summary: "切換多選或批次模式。" },
  { key: "clearFilters", aliases: /\u6e05\u9664\u7be9\u9078|\u91cd\u7f6e\u7be9\u9078|\u986f\u793a\u5168\u90e8|\u5168\u90e8|all/, labels: ["\u6e05\u9664\u7be9\u9078", "\u5168\u90e8"], risk: "safe", summary: "清除目前篩選。" },
  { key: "deleteSelected", aliases: /\u522a\u9664\u9078\u53d6|\u522a\u9664\u5df2\u9078|\u6279\u6b21\u522a\u9664|delete selected/, labels: ["\u522a\u9664\u9078\u53d6", "\u6279\u6b21\u522a\u9664"], risk: "danger", summary: "開啟刪除選取流程；頁面本身的確認口令仍會生效。" },
  { key: "delete", aliases: /\u522a\u9664|\u79fb\u9664|delete|remove/, labels: ["\u522a\u9664", "\u79fb\u9664"], risk: "danger", summary: "觸發可見的刪除流程；頁面本身的確認口令仍會生效。" },
  { key: "copy", aliases: /\u8907\u88fd|copy/, labels: ["\u8907\u88fd", "Copy"], risk: "review", summary: "觸發可見的複製動作。" },
  { key: "download", aliases: /\u4e0b\u8f09|\u4e0b\u8f09\u6a94\u6848|download/, labels: ["\u4e0b\u8f09", "Download"], risk: "safe", summary: "觸發可見的下載動作。" },
  { key: "play", aliases: /\u64ad\u653e|\u958b\u59cb\u64ad|play/, labels: ["\u64ad\u653e", "Play"], risk: "review", summary: "觸發可見的播放動作。" },
  { key: "pause", aliases: /\u66ab\u505c|pause/, labels: ["\u66ab\u505c", "Pause"], risk: "safe", summary: "觸發可見的暫停動作。" },
  { key: "importCsv", aliases: /\u532f\u5165.*csv|csv.*\u532f\u5165|import.*csv/, labels: ["\u532f\u5165 CSV", "Import CSV"], risk: "review", summary: "開始匯入 CSV；選檔與預覽仍需確認。" },
  { key: "exportCsv", aliases: /\u532f\u51fa.*csv|csv.*\u532f\u51fa|export.*csv/, labels: ["\u532f\u51fa CSV", "Export CSV"], risk: "safe", summary: "匯出目前頁面的 CSV。" },
  { key: "importZip", aliases: /\u532f\u5165.*zip|zip.*\u532f\u5165|import.*zip/, labels: ["\u532f\u5165 ZIP", "Import ZIP"], risk: "review", summary: "開始匯入 ZIP；選檔與預覽仍需確認。" },
  { key: "exportZip", aliases: /\u532f\u51fa.*zip|zip.*\u532f\u51fa|export.*zip/, labels: ["\u532f\u51fa ZIP", "Export ZIP"], risk: "safe", summary: "匯出目前頁面的 ZIP。" },
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
    { key: "tools-ivv", aliases: /\u5716\u7247\u8a9e\u97f3|\u5716\u52a0\u8072|\u751f\u6210\u5f71\u7247|image.?voice/, labels: ["\u5716\u7247\u8a9e\u97f3\u5f71\u7247", "\u751f\u6210\u5f71\u7247"], risk: "review", summary: "Open image+voice video tool or generate video." },
  ],
  "image-voice-video": [
    { key: "ivv-generate", aliases: /\u751f\u6210|\u958b\u59cb|\u4e0a\u50b3\u66ab\u5b58|generate/, labels: ["\u751f\u6210\u5f71\u7247", "\u751f\u6210"], risk: "review", summary: "Generate image+voice video and upload temp file." },
    { key: "ivv-download", aliases: /\u4e0b\u8f09|download/, labels: ["\u4e0b\u8f09"], risk: "safe", summary: "Download generated video if available." },
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

function normalizeLooseText(text: string) {
  return text.toLowerCase().replace(/[，,。.!！?？:：;；]/g, " ").replace(/\s+/g, " ").trim();
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
    const text = normalizeVoiceText(getElementText(control));
    return labels.some((label) => text.includes(normalizeVoiceText(label)));
  });

  target?.click();
  return Boolean(target);
}

function clickControlByText(text: string) {
  const label = normalizeVoiceText(text);
  if (!label) return false;
  const controls = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button'], label, a, [aria-label], [title]"));
  const target = controls.find((control) => isVisible(control) && normalizeVoiceText(getElementText(control)).includes(label));
  target?.click();
  return Boolean(target);
}

function clickNthVisibleControl(labels: string[], ordinal: number) {
  const controls = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button'], label, a"));
  const matches = controls.filter((control) => {
    if (!isVisible(control)) return false;
    const text = normalizeVoiceText(getElementText(control));
    return labels.some((label) => text.includes(normalizeVoiceText(label)));
  });
  const target = matches[Math.max(ordinal - 1, 0)];
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

function parseVoiceDate(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  const today = new Date();
  const iso = value.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const md = value.match(/(\d{1,2})\s*(?:月|\/|-)\s*(\d{1,2})\s*(?:日|號)?/);
  if (md) {
    const [, month, day] = md;
    return `${today.getFullYear()}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const days = value.match(/(?:\+|加|後|延後)?\s*(\d{1,3})\s*(?:天|日)(?:後|內)?/);
  if (days) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + Number(days[1]));
    return date.toISOString().split("T")[0];
  }

  if (/今天|今日|today/.test(value)) return today.toISOString().split("T")[0];
  if (/明天|tomorrow/.test(value)) {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().split("T")[0];
  }
  return value;
}

function extractStructuredVoiceDate(text: string) {
  const slashDate = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s*(?:上午|早上|下午|晚上|中午))?/);
  if (slashDate) {
    return {
      date: `${slashDate[1]}-${slashDate[2].padStart(2, "0")}-${slashDate[3].padStart(2, "0")}`,
      raw: slashDate[0],
    };
  }

  const zhDate = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|號|号)?(?:\s*(?:上午|早上|下午|晚上|中午))?/);
  if (zhDate) {
    return {
      date: `${zhDate[1]}-${zhDate[2].padStart(2, "0")}-${zhDate[3].padStart(2, "0")}`,
      raw: zhDate[0],
    };
  }

  return { date: "", raw: "" };
}

function extractStructuredVoiceTimeNote(text: string) {
  const timeLabel = text.match(/上午|早上|下午|晚上|中午/)?.[0];
  if (!timeLabel) return "";
  return `鋒兄語音 ${timeLabel === "早上" ? "上午" : timeLabel}`;
}

function extractStructuredSubscriptionName(text: string, dateRaw: string) {
  const quoted = text.match(/[「『"']([^」』"']+)[」』"']/);
  if (quoted?.[1]) return quoted[1].trim();

  const named = text.match(/(?:叫做|名稱(?:是|為)?|名為)\s*(.+?)(?=\s*(?:日期|時間|扣款日|價格|金額|月費|費用|付費|收費|備註|帳號|網站|$))/);
  if (named?.[1]) return named[1].trim();

  return text
    .replace(dateRaw, " ")
    .replace(/新增訂閱|新增一筆資料|新增一筆|新增資料|新增|建立訂閱|建立|在鋒兄訂閱|鋒兄訂閱|訂閱/gi, " ")
    .replace(/叫做|名稱是|名稱為|名為|日期為|日期是|時間為|時間是|扣款日為|扣款日是|上午|早上|下午|晚上|中午/gi, " ")
    .replace(/(?:價格|金額|月費|費用|付費|收費)\s*(?:是|為|:|：)?\s*\d+(?:\.\d+)?/gi, " ")
    .replace(/(?:nt\$|twd|台幣|臺幣|新台幣|美金|美元|usd)?\s*\d+(?:\.\d+)?\s*(?:元|塊|twd|usd|美元|美金)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildStructuredSubscriptionFields(text: string): VoiceField[] {
  const fields: VoiceField[] = [];
  const push = (key: VoiceFieldKey, value: string) => {
    const cleaned = value.trim();
    if (cleaned && !fields.some((field) => field.key === key)) fields.push({ key, value: cleaned });
  };
  const voiceDate = extractStructuredVoiceDate(text);
  push("name", extractStructuredSubscriptionName(text, voiceDate.raw));
  push("date", voiceDate.date);
  push("note", extractStructuredVoiceTimeNote(text));
  return fields;
}

function extractValueAfter(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function stripModuleAliases(text: string) {
  return Object.values(MODULE_VOICE_META)
    .flatMap((meta) => [meta.name, ...meta.aliases])
    .reduce((result, alias) => result.replace(new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " "), text);
}

function stripFieldPhrases(text: string) {
  return text
    .replace(/\u65b0\u589e|\u5efa\u7acb|\u52a0\u5165|\u65b0\u5efa|\u5e6b\u6211|\u4e00\u7b46|add|create|new/gi, " ")
    .replace(/(?:數量|個數|庫存|價格|金額|費用|到期日?|有效期限|期限|扣款日?|付款日?|續費日?|日期|分類|類別|商店|地點|位置|網站|站台|服務|帳號|帳戶|密碼|幣別|貨幣|網址|連結|備註|說明|內容|amount|quantity|price|cost|date|category|shop|store|site|service|account|password|currency|url|link|note|memo)\s*[^，,。]*/gi, " ")
    .replace(/\d+(?:\.\d+)?\s*(?:元|塊|個|件|張|首|筆|部|次|nt|twd|usd|jpy|天後|天內|天)/gi, " ")
    .replace(/(?:今天|今日|明天|後天|\d{1,2}\s*(?:月|\/|-)\s*\d{1,2}\s*(?:日|號)?|20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2})/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferLooseFields(text: string, moduleId: string): VoiceField[] {
  const fields: VoiceField[] = [];
  const push = (key: VoiceFieldKey, value: string) => {
    const cleaned = value.trim();
    if (cleaned && !fields.some((field) => field.key === key)) fields.push({ key, value: cleaned });
  };

  const price = text.match(/(\d+(?:\.\d+)?)\s*(?:元|塊|nt|twd|usd|jpy|港幣|美金|日幣)/i);
  if (price && ["subscription", "food", "bank-stats", "common"].includes(moduleId)) push("price", price[1]);

  const amount = text.match(/(\d{1,4})\s*(?:個|件|張|首|部|筆|瓶|包|盒|份|罐)/i);
  if (amount && ["food", "images", "videos", "music", "documents", "podcast"].includes(moduleId)) push("amount", amount[1]);

  const dateText = text.match(/(今天|今日|明天|後天|\d{1,3}\s*天後|\d{1,2}\s*(?:月|\/|-)\s*\d{1,2}\s*(?:日|號)?|20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2})/i);
  if (dateText) push("date", parseVoiceDate(dateText[1]));

  const currency = text.match(/\b(TWD|NTD|USD|JPY|CNY|HKD)\b|台幣|美金|美元|日幣|人民幣|港幣/i);
  if (currency) {
    const normalized = currency[0].replace(/台幣|NTD/i, "TWD").replace(/美金|美元/i, "USD").replace(/日幣/i, "JPY").replace(/人民幣/i, "CNY").replace(/港幣/i, "HKD").toUpperCase();
    push("currency", normalized);
  }

  const candidateName = stripFieldPhrases(stripModuleAliases(text));
  if (candidateName) {
    const nameKey: VoiceFieldKey = ["notes", "videos", "music", "documents", "podcast", "images"].includes(moduleId) ? "title" : "name";
    push(nameKey, candidateName);
  }

  return fields;
}

function buildVoiceFields(text: string): VoiceField[] {
  const loose = normalizeLooseText(text);
  const fields: VoiceField[] = [];
  const pushField = (key: VoiceFieldKey, value: string) => {
    const cleaned = value.replace(/\s+(數量|價格|金額|日期|到期|分類|商店|地點|網站|網址|帳號|備註|說明|note|url|price|date).*$/i, "").trim();
    if (cleaned && !fields.some((field) => field.key === key)) fields.push({ key, value: cleaned });
  };

  const dateValue = extractValueAfter(loose, [
    /(?:到期日?|有效期限|期限|扣款日?|付款日?|續費日?|日期|date)\s*([^\s，,。]+)/i,
    /(?:到期|續費|付款|扣款)\s*([0-9一二三四五六七八九十年月日號\/\-.+\s]+?)(?:\s|$)/i,
  ]);
  if (dateValue) pushField("date", parseVoiceDate(dateValue));

  pushField("amount", extractValueAfter(loose, [/(?:數量|個數|庫存|amount|quantity)\s*(\d+)/i]));
  pushField("price", extractValueAfter(loose, [/(?:價格|金額|費用|price|cost|元|nt)\s*(\d+(?:\.\d+)?)/i]));
  pushField("category", extractValueAfter(loose, [/(?:分類|類別|category)\s*([^\s]+)/i]));
  pushField("shop", extractValueAfter(loose, [/(?:商店|地點|位置|shop|store)\s*([^\s]+)/i]));
  pushField("site", extractValueAfter(loose, [/(?:網站|站台|服務|site|service)\s*([^\s]+)/i]));
  pushField("account", extractValueAfter(loose, [/(?:帳號|帳戶|account)\s*([^\s]+)/i]));
  pushField("password", extractValueAfter(text, [/(?:密碼|password)\s*([^\s，,。]+)/i]));
  pushField("currency", extractValueAfter(loose, [/(?:幣別|貨幣|currency)\s*([^\s]+)/i]));
  pushField("url", extractValueAfter(text, [/(https?:\/\/\S+)/i, /(?:網址|連結|url|link)\s*(\S+)/i]));
  pushField("note", extractValueAfter(text, [/(?:備註|說明|內容|note|memo)\s*(.+)$/i]));

  const explicitName = extractValueAfter(text, [/(?:名稱|名字|標題|品名|項目|name|title)\s*([^，,。]+)/i]);
  if (explicitName) {
    pushField("name", explicitName);
  } else if (/\u65b0\u589e|\u5efa\u7acb|\u52a0\u5165|\u65b0\u5efa|add|create|new/i.test(text)) {
    const withoutModuleAliases = Object.values(MODULE_VOICE_META)
      .flatMap((meta) => [meta.name, ...meta.aliases])
      .reduce((result, alias) => result.replace(new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " "), text);
    const cleaned = withoutModuleAliases
      .replace(/\u65b0\u589e|\u5efa\u7acb|\u52a0\u5165|\u65b0\u5efa|add|create|new/gi, " ")
      .replace(/(?:數量|個數|庫存|價格|金額|費用|到期日?|有效期限|期限|扣款日?|付款日?|續費日?|日期|分類|類別|商店|地點|位置|網站|站台|服務|帳號|帳戶|密碼|幣別|貨幣|網址|連結|備註|說明|內容|amount|quantity|price|cost|date|category|shop|store|site|service|account|password|currency|url|link|note|memo)\s*[^，,。]*/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned) pushField("name", cleaned);
  }

  return fields;
}

function mergeVoiceFields(primary: VoiceField[], inferred: VoiceField[]) {
  const merged = [...primary];
  for (const field of inferred) {
    if (!merged.some((item) => item.key === field.key)) merged.push(field);
  }
  return merged;
}

const fieldMatchers: Record<VoiceFieldKey, RegExp[]> = {
  name: [/名稱|名字|品名|name/i],
  title: [/標題|title/i],
  amount: [/數量|個數|庫存|amount|quantity/i],
  price: [/價格|金額|費用|price|cost/i],
  date: [/日期|到期|期限|扣款|付款|續費|date/i],
  category: [/分類|類別|category/i],
  shop: [/商店|地點|位置|shop|store/i],
  site: [/網站|站台|服務|site|service/i],
  account: [/帳號|帳戶|account/i],
  password: [/密碼|password/i],
  currency: [/幣別|貨幣|currency/i],
  url: [/網址|連結|圖片|影片|音樂|檔案|url|link|photo|image|video|file/i],
  note: [/備註|說明|內容|note|memo|description/i],
};

function setControlValue(control: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = control instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function getActiveTextControl() {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    if (active.type !== "file" && active.type !== "hidden" && !active.disabled && !active.readOnly) return active;
  }
  return null;
}

function fillFocusedControl(value: string) {
  const active = getActiveTextControl();
  if (!active) return false;
  setControlValue(active, value);
  return true;
}

function clearFocusedControl() {
  const active = getActiveTextControl();
  if (!active) return false;
  setControlValue(active, "");
  return true;
}

function adjustFocusedControl(amount: number, unit: "number" | "days") {
  const active = getActiveTextControl();
  if (!active) return false;

  if (unit === "days" || active.type === "date") {
    const date = active.value ? new Date(active.value) : new Date();
    if (Number.isNaN(date.getTime())) return false;
    date.setDate(date.getDate() + amount);
    setControlValue(active, date.toISOString().split("T")[0]);
    return true;
  }

  const current = Number(active.value || 0);
  if (Number.isNaN(current)) return false;
  setControlValue(active, String(current + amount));
  return true;
}

function getControlText(control: HTMLInputElement | HTMLTextAreaElement) {
  const label = control.id ? document.querySelector(`label[for="${CSS.escape(control.id)}"]`)?.textContent || "" : "";
  return [
    label,
    getElementText(control),
    control.closest("div")?.textContent || "",
  ].filter(Boolean).join(" ");
}

function fillVisibleFormFields(fields: VoiceField[]) {
  const controls = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input:not([type='file']), textarea"))
    .filter((control) => isVisible(control) && control.type !== "hidden" && !control.disabled && !control.readOnly);
  const used = new Set<HTMLInputElement | HTMLTextAreaElement>();
  let filled = 0;

  for (const field of fields) {
    const target = controls.find((control) => {
      if (used.has(control)) return false;
      const text = getControlText(control);
      return fieldMatchers[field.key].some((pattern) => pattern.test(text));
    }) || (field.key === "name" ? controls.find((control) => !used.has(control) && /text|search|url|number|date|email|password|^$/i.test(control.type)) : null);

    if (target) {
      const value = field.key === "date" ? parseVoiceDate(field.value) : field.value;
      setControlValue(target, value);
      used.add(target);
      filled += 1;
    }
  }

  return filled;
}

function scrollPage(target: PendingCommand["scrollTarget"]) {
  if (target === "top") window.scrollTo({ top: 0, behavior: "smooth" });
  if (target === "bottom") window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  if (target === "up") window.scrollBy({ top: -Math.round(window.innerHeight * 0.75), behavior: "smooth" });
  if (target === "down") window.scrollBy({ top: Math.round(window.innerHeight * 0.75), behavior: "smooth" });
}

function extractOrdinal(text: string) {
  const normalized = normalizeVoiceText(text);
  const digit = normalized.match(/(?:第)?(\d{1,2})(?:筆|個|首|項|行|張|部)?/);
  if (digit) return Number(digit[1]);
  const ordinals: Array<[RegExp, number]> = [
    [/第一|第1|一筆|第一筆|第一個|首筆/, 1],
    [/第二|第2|二筆|第二筆|第二個/, 2],
    [/第三|第3|三筆|第三筆|第三個/, 3],
    [/第四|第4|四筆|第四筆|第四個/, 4],
    [/第五|第5|五筆|第五筆|第五個/, 5],
    [/第六|第6|六筆|第六筆|第六個/, 6],
    [/第七|第7|七筆|第七筆|第七個/, 7],
    [/第八|第8|八筆|第八筆|第八個/, 8],
    [/第九|第9|九筆|第九筆|第九個/, 9],
    [/第十|第10|十筆|第十筆|第十個/, 10],
  ];
  return ordinals.find(([pattern]) => pattern.test(normalized))?.[1] || null;
}

function extractFocusedInputValue(text: string) {
  return extractValueAfter(text, [
    /(?:在目前欄位|目前欄位|這個欄位|欄位|輸入|填入|填上|聽寫|dictate|type|input)\s*(.+)$/i,
  ]);
}

function extractFocusedAdjustment(text: string) {
  const normalized = normalizeVoiceText(text);
  const match = normalized.match(/(?:加|增加|\+|減|減少|-)(\d{1,4})(天|日)?/);
  if (!match) return null;
  const sign = /減|減少|-/.test(normalized) ? -1 : 1;
  return {
    amount: sign * Number(match[1]),
    unit: match[2] ? "days" as const : "number" as const,
  };
}

function getActionsForModule(moduleId: string) {
  return [...(moduleActions[moduleId] || []), ...commonActions];
}

function removeModuleAlias(text: string, moduleId: string) {
  const aliases = MODULE_VOICE_META[moduleId]?.aliases || [];
  return aliases.reduce((result, alias) => result.replace(alias, " "), text).replace(/\s+/g, " ").trim();
}

const HELP_HINT =
  "可說：打開鋒兄食品、新增食品 牛奶 數量 2 到期 7 天後、編輯第一筆、搜尋 Netflix、往下捲。說完停頓會自動結束。安全操作直接執行；新增／刪除會先確認。快捷鍵：Ctrl+Shift+V。";

export function GlobalVoiceCommandPanel({
  currentModule,
  menuItems,
  onNavigate,
}: {
  currentModule: string;
  menuItems: MenuItem[];
  onNavigate: (moduleId: string) => void;
}) {
  const [feedback, setFeedback] = useState(HELP_HINT);
  const [pendingCommand, setPendingCommand] = useState<PendingCommand | null>(null);
  const [open, setOpen] = useState(false);
  const [showTips, setShowTips] = useState(false);

  const flatMenuItems = useMemo(() => {
    const flatten = (items: MenuItem[]): MenuItem[] => items.flatMap((item) => item.children?.length ? [item, ...flatten(item.children)] : [item]);
    return flatten(menuItems).filter((item) => !item.children?.length);
  }, [menuItems]);

  const currentIndex = flatMenuItems.findIndex((item) => item.id === currentModule);
  const currentModuleName = MODULE_VOICE_META[currentModule]?.name || "目前頁面";
  const currentActionChips = useMemo(
    () => getActionsForModule(currentModule).slice(0, 10),
    [currentModule]
  );

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

    if (/\u6e05\u7a7a\u6b04\u4f4d|\u6e05\u9664\u6b04\u4f4d|\u6e05\u7a7a\u76ee\u524d|\u6e05\u9664\u76ee\u524d|clearfield|clearinput/.test(normalized)) {
      return { action: "clearFocused", summary: "清空目前聚焦的輸入欄位。", risk: "review" };
    }

    const adjustment = extractFocusedAdjustment(text);
    if (adjustment && /目前欄位|這個欄位|欄位|日期|數量|價格|金額|加|減|\+|-/.test(text)) {
      return {
        action: "adjustFocused",
        adjustAmount: adjustment.amount,
        adjustUnit: adjustment.unit,
        summary: `把目前欄位${adjustment.amount >= 0 ? "增加" : "減少"} ${Math.abs(adjustment.amount)}${adjustment.unit === "days" ? " 天" : ""}。`,
        risk: "review",
      };
    }

    const focusedValue = extractFocusedInputValue(text);
    if (focusedValue && !/\u641c\u5c0b|\u67e5\u8a62|\u627e|search|find/.test(normalized)) {
      return {
        action: "focusedFill",
        focusedValue,
        summary: `把「${focusedValue}」輸入到目前聚焦的欄位。`,
        risk: "review",
      };
    }

    if (/\u6700\u4e0a\u9762|\u56de\u9802\u90e8|\u9802\u90e8|top/.test(normalized)) {
      return { action: "scroll", scrollTarget: "top", summary: "捲動到頁面最上方。", risk: "safe" };
    }

    if (/\u6700\u4e0b\u9762|\u5230\u5e95|\u5e95\u90e8|bottom/.test(normalized)) {
      return { action: "scroll", scrollTarget: "bottom", summary: "捲動到頁面最下方。", risk: "safe" };
    }

    if (/\u5f80\u4e0b|\u4e0b\u6efe|scroll down|pagedown/.test(normalized)) {
      return { action: "scroll", scrollTarget: "down", summary: "往下捲動一段。", risk: "safe" };
    }

    if (/\u5f80\u4e0a|\u4e0a\u6efe|scroll up|pageup/.test(normalized)) {
      return { action: "scroll", scrollTarget: "up", summary: "往上捲動一段。", risk: "safe" };
    }

    if (/\u4e0b\u4e00\u500b|\u4e0b\u4e00\u9801|next/.test(normalized)) {
      const next = flatMenuItems[(Math.max(currentIndex, 0) + 1) % flatMenuItems.length];
      return { action: "next", moduleId: next?.id, summary: `切到下一個選單：${MODULE_VOICE_META[next?.id || ""]?.name || next?.label || "下一個"}。`, risk: "safe" };
    }

    if (/\u4e0a\u4e00\u500b|\u4e0a\u4e00\u9801|previous|prev/.test(normalized)) {
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;
      const previous = flatMenuItems[(safeIndex - 1 + flatMenuItems.length) % flatMenuItems.length];
      return { action: "previous", moduleId: previous?.id, summary: `切到上一個選單：${MODULE_VOICE_META[previous?.id || ""]?.name || previous?.label || "上一個"}。`, risk: "safe" };
    }

    if (/\u9996\u9801|\u4e3b\u9801|home/.test(normalized)) {
      return { action: "home", moduleId: "home", summary: `切到${zh.home}。`, risk: "safe" };
    }

    const target = resolveModule(text);
    const actionModuleId = target?.id || currentModule;
    const moduleName = target ? MODULE_VOICE_META[target.id]?.name || target.label : currentModuleName;
    const actionText = target ? removeModuleAlias(text, target.id) : text;
    const normalizedActionText = normalizeVoiceText(actionText);
    const structuredFields = actionModuleId === "subscription" ? buildStructuredSubscriptionFields(actionText) : [];
    const fields = mergeVoiceFields(
      mergeVoiceFields(structuredFields, buildVoiceFields(actionText)),
      inferLooseFields(actionText, actionModuleId)
    );
    const ordinal = extractOrdinal(actionText);

    const clickText = extractValueAfter(actionText, [
      /(?:\u9ede\u64ca|\u6309\u4e0b|\u57f7\u884c|\u6253\u958b|\u958b\u555f|click|press|open)\s*(.+)$/i,
    ]);
    if (clickText && !/\u65b0\u589e|\u5efa\u7acb|\u52a0\u5165|add|create|new/i.test(clickText)) {
      return {
        action: "clickText",
        moduleId: target?.id,
        clickText,
        summary: `${target ? `切到 ${moduleName}，再` : ""}點擊「${clickText}」。`,
        risk: /刪除|delete|remove|移除/.test(clickText) ? "danger" : "review",
      };
    }

    if (/\u641c\u5c0b|\u67e5\u8a62|\u627e|search|find/.test(normalizedActionText)) {
      const query = extractSearchQuery(actionText);
      if (query) {
        return {
          action: "pageSearch",
          moduleId: target?.id,
          query,
          summary: `${target ? `切到 ${moduleName}，再` : ""}搜尋「${query}」。`,
          risk: "safe",
        };
      }
    }

    const pageAction = getActionsForModule(actionModuleId).find((candidate) => candidate.aliases.test(normalizedActionText));
    if (pageAction && ordinal) {
      return {
        action: "clickOrdinal",
        moduleId: target?.id,
        labels: pageAction.labels,
        ordinal,
        summary: `${target ? `切到 ${moduleName}，再` : ""}執行第 ${ordinal} 個「${pageAction.labels[0] || pageAction.key}」。`,
        risk: pageAction.risk,
      };
    }

    if (pageAction?.key === "add" && fields.length > 0) {
      return {
        action: "pageFill",
        moduleId: target?.id,
        labels: pageAction.labels,
        fields,
        summary: `${target ? `切到 ${moduleName}，` : ""}開啟新增並預填：${fields.map((field) => `${field.key}=${field.value}`).join("、")}。`,
        risk: "review",
      };
    }

    if (pageAction) {
      return {
        action: "pageAction",
        moduleId: target?.id,
        labels: pageAction.labels,
        summary: `${target ? `切到 ${moduleName}，再` : ""}${pageAction.summary}`,
        risk: pageAction.risk,
      };
    }

    if (target) {
      return {
        action: "navigate",
        moduleId: target.id,
        summary: `切到 ${MODULE_VOICE_META[target.id]?.name || target.label}。`,
        risk: "safe",
      };
    }

    return null;
  };

  const handleVoiceTextRef = useRef<(text: string) => void>(() => {});

  const {
    isSupported,
    isListening,
    transcript,
    setTranscript,
    elapsedMs,
    canStop,
    start,
    stop,
    toggle,
  } = useSpeechRecognition({
    mode: "phrase",
    onResult: (text) => handleVoiceTextRef.current(text),
    onEmptyResult: () => setFeedback("沒有聽清楚內容，請再說一次，或直接在文字框輸入。"),
    onInterrupted: () => setFeedback("錄音已結束。可再按麥克風說話，或改用文字指令。"),
    onError: (message) => setFeedback(message),
    onStart: () => {
      setOpen(true);
      setPendingCommand(null);
      setFeedback("正在聽你說…說完停頓一下會自動結束，也可按「說完了」。");
    },
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable;
      if (isTyping) return;

      // Ctrl+Shift+V：開啟並開始聽
      if (event.ctrlKey && event.shiftKey && (event.key === "V" || event.key === "v")) {
        event.preventDefault();
        setOpen(true);
        if (!isListening && getVoicePreferences().autoStartGlobal) start();
        else if (!isListening) setFeedback(HELP_HINT);
        return;
      }

      // Escape：錄音中則停止；否則關閉面板
      if (event.key === "Escape") {
        if (isListening) {
          event.preventDefault();
          stop();
          return;
        }
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isListening, open, start, stop]);

  const confirmCommand = useCallback((command?: PendingCommand | null) => {
    const active = command ?? pendingCommand;
    if (!active) return;

    if (active.action === "focusedFill" && active.focusedValue) {
      const ok = fillFocusedControl(active.focusedValue);
      setFeedback(ok ? "已輸入到目前欄位。" : "目前沒有可輸入的聚焦欄位，請先點一下欄位。");
      setPendingCommand(null);
      return;
    }

    if (active.action === "clearFocused") {
      const ok = clearFocusedControl();
      setFeedback(ok ? "已清空目前欄位。" : "目前沒有可清空的聚焦欄位，請先點一下欄位。");
      setPendingCommand(null);
      return;
    }

    if (active.action === "adjustFocused" && active.adjustAmount !== undefined && active.adjustUnit) {
      const ok = adjustFocusedControl(active.adjustAmount, active.adjustUnit);
      setFeedback(ok ? "已調整目前欄位。" : "目前欄位無法調整，請先點日期或數字欄位。");
      setPendingCommand(null);
      return;
    }

    if (active.action === "scroll") {
      scrollPage(active.scrollTarget);
      setFeedback("已執行捲動。");
      setPendingCommand(null);
      return;
    }

    if (active.action === "pageSearch" && active.query) {
      if (active.moduleId) onNavigate(active.moduleId);
      const query = active.query;
      window.setTimeout(() => {
        const ok = fillVisibleSearch(query);
        setFeedback(ok ? `已搜尋：${query}` : "此頁找不到可用的搜尋欄位。");
      }, active.moduleId ? 350 : 0);
      setPendingCommand(null);
      return;
    }

    if (active.action === "pageFill" && active.fields) {
      if (active.moduleId) onNavigate(active.moduleId);
      const labels = active.labels || ["\u65b0\u589e"];
      const fields = active.fields;
      window.setTimeout(() => {
        clickVisibleControl(labels);
        window.setTimeout(() => {
          const filled = fillVisibleFormFields(fields);
          setFeedback(filled > 0 ? `已預填 ${filled} 個欄位，請檢查後再儲存。` : "已嘗試開啟表單，但沒有找到可預填欄位。");
        }, 220);
      }, active.moduleId ? 350 : 0);
      setPendingCommand(null);
      return;
    }

    if (active.action === "clickOrdinal" && active.labels && active.ordinal) {
      if (active.moduleId) onNavigate(active.moduleId);
      const labels = active.labels;
      const ordinal = active.ordinal;
      window.setTimeout(() => {
        const ok = clickNthVisibleControl(labels, ordinal);
        setFeedback(ok ? `已執行第 ${ordinal} 個匹配動作。` : `找不到第 ${ordinal} 個匹配按鈕。`);
      }, active.moduleId ? 350 : 0);
      setPendingCommand(null);
      return;
    }

    if (active.action === "pageAction" && active.labels) {
      if (active.moduleId) onNavigate(active.moduleId);
      const labels = active.labels;
      window.setTimeout(() => {
        const ok = clickVisibleControl(labels);
        setFeedback(ok ? "已執行頁面動作；若出現表單、預覽或刪除口令，仍需你再次確認。" : "此頁找不到匹配的可見按鈕。");
      }, active.moduleId ? 350 : 0);
      setPendingCommand(null);
      if (active.moduleId) setOpen(false);
      return;
    }

    if (active.action === "clickText" && active.clickText) {
      if (active.moduleId) onNavigate(active.moduleId);
      const clickText = active.clickText;
      window.setTimeout(() => {
        const ok = clickControlByText(clickText);
        setFeedback(ok ? `已點擊：${clickText}` : `找不到可見按鈕：${clickText}`);
      }, active.moduleId ? 350 : 0);
      setPendingCommand(null);
      return;
    }

    if (active.moduleId) {
      onNavigate(active.moduleId);
      setFeedback(`已切到 ${MODULE_VOICE_META[active.moduleId]?.name || active.moduleId}。`);
      setPendingCommand(null);
      setOpen(false);
    }
  }, [onNavigate, pendingCommand]);

  const handleVoiceText = useCallback((text: string) => {
    const cleaned = text.trim();
    if (!cleaned) {
      setPendingCommand(null);
      setFeedback("請先輸入或說出指令。");
      return;
    }

    setTranscript(cleaned);
    const command = parseCommand(cleaned);
    if (!command) {
      setPendingCommand(null);
      setFeedback("還無法判斷指令。可試：打開鋒兄食品、新增食品 牛奶 數量 2 到期 7 天後、編輯第一筆、搜尋 Netflix。");
      return;
    }

    if (shouldAutoExecuteVoiceRisk(command.risk)) {
      setPendingCommand(null);
      playVoiceSuccessTone();
      confirmCommand(command);
      return;
    }

    setPendingCommand(command);
    setFeedback(
      command.risk === "danger"
        ? "這是危險操作，請確認摘要後再執行；刪除口令仍會再問一次。"
        : "已理解指令，請確認摘要後再執行。"
    );
  }, [confirmCommand, parseCommand, setTranscript]);

  handleVoiceTextRef.current = handleVoiceText;

  const quickActions = ["\u65b0\u589e", "\u7de8\u8f2f\u7b2c\u4e00\u7b46", "\u8f38\u5165 ", "\u6e05\u7a7a\u6b04\u4f4d", "\u641c\u5c0b", "\u5132\u5b58", "\u53d6\u6d88", "\u532f\u51fa CSV", "\u532f\u5165 CSV", "\u91cd\u65b0\u6574\u7406", "\u5168\u9078", "\u5f80\u4e0b\u6372", "\u522a\u9664\u9078\u53d6"];
  const riskLabel =
    pendingCommand?.risk === "danger" ? "危險操作，需確認" :
    pendingCommand?.risk === "review" ? "需確認後執行" :
    "安全操作";

  return (
    {/* Keep on bottom-left so it never covers right-side scroll / queue docks. */}
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 z-[var(--z-voice)] flex max-w-[min(560px,calc(100vw-1.5rem))] flex-col items-start gap-2 md:bottom-6 md:left-6">
      {open && (
        <div className="w-full rounded-[24px] border border-[var(--line-strong)] bg-white/92 p-4 shadow-[0_24px_80px_rgba(17,24,39,0.18)] backdrop-blur-xl dark:bg-gray-950/92">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${isListening ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-200" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"}`}>
                  <Compass className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-950 dark:text-gray-100">全域語音控制</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    目前：{currentModuleName} · 說完自動結束 · Ctrl+Shift+V
                  </p>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800" aria-label="關閉語音面板">
              <X className="h-4 w-4" />
            </button>
          </div>

          {isListening && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span className="font-medium">聆聽中 {formatRecordingClock(elapsedMs)}</span>
              <span className="text-red-600/80 dark:text-red-200/80">說完停頓會自動結束 · Esc 可取消</span>
            </div>
          )}

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
              placeholder="說或輸入：搜尋 Netflix / 打開鋒兄食品 / 往下捲"
              disabled={isListening}
              aria-label="語音或文字指令"
            />
            <Button
              type="button"
              variant="outline"
              onClick={toggle}
              disabled={!isSupported && !isListening}
              className={`shrink-0 rounded-xl ${isListening ? "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-200" : ""}`}
            >
              <Mic className={`mr-1 h-4 w-4 ${isListening ? "animate-pulse text-red-500" : ""}`} />
              {isListening ? (canStop ? "說完了" : "準備中…") : "開始說話"}
            </Button>
            <Button
              type="button"
              onClick={() => handleVoiceText(transcript)}
              disabled={!transcript.trim() || isListening}
              className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700"
            >
              <Sparkles className="mr-1 h-4 w-4" />
              執行
            </Button>
          </div>

          {!isSupported && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              此瀏覽器不支援語音辨識（建議 Chrome / Edge），仍可直接輸入文字後按「執行」。
            </p>
          )}

          <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-gray-400">狀態</div>
            <div className="mt-0.5">{feedback}</div>
          </div>

          {pendingCommand && (
            <div className={`mt-3 rounded-2xl border p-3 text-sm ${
              pendingCommand.risk === "danger"
                ? "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100"
                : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
            }`}>
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                {riskLabel}
              </div>
              <div className="mt-1 leading-6">{pendingCommand.summary}</div>
              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPendingCommand(null)} className="rounded-xl bg-white/80">
                  取消
                </Button>
                <Button
                  type="button"
                  onClick={() => confirmCommand()}
                  className={pendingCommand.risk === "danger" ? "rounded-xl bg-red-600 hover:bg-red-700" : "rounded-xl bg-emerald-600 hover:bg-emerald-700"}
                >
                  確認執行
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

          <div className="mt-2 rounded-2xl border border-gray-200 bg-white/70 p-2 dark:border-gray-800 dark:bg-gray-900/60">
            <div className="mb-1 px-1 text-[11px] font-medium tracking-[0.08em] text-gray-400">
              目前頁面快捷
            </div>
            <div className="flex flex-wrap gap-1.5">
              {currentActionChips.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleVoiceText(item.labels[0] || item.key)}
                  className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
                >
                  {item.labels[0] || item.key}
                </button>
              ))}
            </div>
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

          <button
            type="button"
            onClick={() => setShowTips((prev) => !prev)}
            className="mt-3 text-xs text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
          >
            {showTips ? "收起使用說明" : "查看使用說明"}
          </button>
          {showTips && (
            <p className="mt-2 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs leading-6 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
              {HELP_HINT}
            </p>
          )}
        </div>
      )}

      <Button
        type="button"
        title="全域語音（Ctrl+Shift+V）"
        onClick={() => {
          if (isListening) {
            stop();
            return;
          }
          if (open) {
            setOpen(false);
            return;
          }
          setOpen(true);
          setFeedback(HELP_HINT);
          if (getVoicePreferences().autoStartGlobal) start();
        }}
        className={`rounded-full px-4 py-6 text-white shadow-[0_18px_48px_rgba(5,150,105,0.28)] ${
          isListening
            ? "bg-red-600 hover:bg-red-700"
            : "bg-emerald-600 hover:bg-emerald-700"
        }`}
      >
        <Mic className={`mr-2 h-5 w-5 ${isListening ? "animate-pulse" : ""}`} />
        {isListening ? `聆聽中 ${formatRecordingClock(elapsedMs)}` : open ? "關閉語音" : "全域語音"}
      </Button>
    </div>
  );
}
