/**
 * Builds each 鋒兄設定 CSV menu from its list API. Free of browser APIs so the
 * daily Vercel cron can run it too; the caller supplies how to fetch.
 */
import { API_ENDPOINTS } from "@/lib/constants";
import { BANK_CSV_HEADERS, toBankCsvRow } from "@/lib/bankCsv";
import { buildFinanceCustomCsv } from "@/lib/fengbroFinanceCsv";
import { buildFengbroNewsCsv } from "@/lib/fengbroNewsCsv";
import {
  migrateFinanceGroup,
  normalizeCustomFinanceInstrument,
  normalizeFinanceRelatedLinks,
  type CustomFinanceInstrument,
} from "@/lib/fengbroFinanceCustom";
import type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";
import { buildFengbroTubeCsv } from "@/lib/fengbroTubeCsv";
import { toFengbroTubeChannelConfig, type FengbroTubeChannelConfig } from "@/lib/fengbroTubeChannels";
import { buildLandtopHistoryCsv } from "@/lib/landtopHistoryCsv";
import { buildManualPriceCsv, type ManualPriceCsvProduct } from "@/lib/manualPriceCsv";
import { buildQuotaCsv } from "@/lib/quotaCsv";
import { buildReinstallCsv } from "@/lib/reinstallCsv";
import { buildShoppingCsv } from "@/lib/shoppingCsv";
import { buildTrialPurchaseCsv } from "@/lib/trialPurchaseCsv";
import { buildUdemyCsv } from "@/lib/udemyCsv";
import type { Bank, CommonAccount, Food, Quota, ReinstallSoftware, ShoppingItem, Subscription, TrialPurchase, UdemyCourse } from "@/types";
import type { MenuBackupEntry, MenuBackupMode } from "./catalog";
import {
  buildCommonAccountCsv,
  buildFoodCsv,
  buildMusicMetaCsv,
  buildRoutineCsv,
  buildSubscriptionCsv,
  buildVideoMetaCsv,
} from "./simpleCsv";

export type BackupProgressFn = (update: {
  stage: string;
  current: number;
  total: number;
  message: string;
  menuId?: string;
}) => void;

export type MenuJobResult = {
  id: string;
  label: string;
  status: "ok" | "skipped" | "error";
  rows: number;
  message?: string;
};

export type CsvExportSource = {
  /** GET a same-origin API path (e.g. "/api/food") and return its JSON. */
  fetchJson: <T>(url: string) => Promise<T>;
  /** 鋒兄新聞 sites live in the browser only; omit where there is none. */
  newsSites?: () => FengbroNewsSiteConfig[];
};

/** Thrown when a menu cannot be exported from this source; report as skipped. */
export class CsvExportSkipped extends Error {}

type NamedDoc = { $id: string; name?: string; title?: string; language?: string; file?: string; cover?: string; hash?: string };

async function listFrom<T>(source: CsvExportSource, url: string): Promise<T[]> {
  const result = await source.fetchJson<T[] | { rows?: T[] }>(url);
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && Array.isArray((result as { rows?: T[] }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

export function formatBackupReport(kind: MenuBackupMode, results: MenuJobResult[]): string {
  const lines = [
    "鋒兄選單備份",
    `kind: ${kind}`,
    `exportedAt: ${new Date().toISOString()}`,
    "",
  ];
  for (const result of results) {
    lines.push(`${result.label} (${result.id}): ${result.status} ${result.rows} 筆${result.message ? ` — ${result.message}` : ""}`);
  }
  return lines.join("\n");
}

export function financeFromDoc(row: Record<string, unknown>): { id: string; instrument: CustomFinanceInstrument } | null {
  const imageUrls = [row.imageUrl1, row.imageUrl2, row.imageUrl3]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  const relatedLinkLines = [row.linkUrl1, row.linkUrl2, row.linkUrl3]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  const instrument = normalizeCustomFinanceInstrument({
    name: typeof row.name === "string" ? row.name : "",
    symbol: typeof row.symbol === "string" ? row.symbol : "",
    provider: row.provider === "yahoo" ? "yahoo" : "cnbc",
    group: migrateFinanceGroup(row.group),
    imageUrls,
    youtubeUrl: typeof row.youtubeUrl === "string" ? row.youtubeUrl : "",
    bilibiliUrl: typeof row.bilibiliUrl === "string" ? row.bilibiliUrl : "",
    relatedLinks: normalizeFinanceRelatedLinks(relatedLinkLines.join("\n")),
    featured: row.featured === true || row.featured === "true",
  });
  if (!instrument) return null;
  return { id: String(row.$id || row.id || ""), instrument };
}

export async function exportCsvMenuWith(
  entry: MenuBackupEntry,
  source: CsvExportSource,
  onProgress?: BackupProgressFn,
): Promise<{ csv: string; rows: number }> {
  const fetchList = <T,>(url: string) => listFrom<T>(source, url);
  onProgress?.({ stage: "export-csv", current: 0, total: 1, message: `讀取 ${entry.label}`, menuId: entry.id });

  switch (entry.id) {
    case "food": {
      const items = await fetchList<Food>(API_ENDPOINTS.FOOD);
      return { csv: buildFoodCsv(items), rows: items.length };
    }
    case "subscription": {
      const items = await fetchList<Subscription>(API_ENDPOINTS.SUBSCRIPTION);
      return { csv: buildSubscriptionCsv(items), rows: items.length };
    }
    case "trial-purchase": {
      const items = await fetchList<TrialPurchase>(API_ENDPOINTS.TRIAL_PURCHASE);
      return { csv: buildTrialPurchaseCsv(items), rows: items.length };
    }
    case "reinstall": {
      const items = await fetchList<ReinstallSoftware>(API_ENDPOINTS.REINSTALL);
      return { csv: buildReinstallCsv(items), rows: items.length };
    }
    case "quota": {
      const items = await fetchList<Quota>(API_ENDPOINTS.QUOTA);
      return { csv: buildQuotaCsv(items), rows: items.length };
    }
    case "shopping-list": {
      const items = await fetchList<ShoppingItem>(API_ENDPOINTS.SHOPPING_LIST);
      return { csv: buildShoppingCsv(items), rows: items.length };
    }
    case "udemy": {
      const items = await fetchList<UdemyCourse>(API_ENDPOINTS.UDEMY);
      return { csv: buildUdemyCsv(items), rows: items.length };
    }
    case "common": {
      const items = await fetchList<CommonAccount>(API_ENDPOINTS.COMMON_ACCOUNT);
      return { csv: buildCommonAccountCsv(items), rows: items.length };
    }
    case "bank-stats": {
      const items = await fetchList<Bank>(API_ENDPOINTS.BANK);
      return { csv: [BANK_CSV_HEADERS.join(","), ...items.map(toBankCsvRow)].join("\n"), rows: items.length };
    }
    case "routine": {
      const items = await fetchList<NamedDoc>(API_ENDPOINTS.ROUTINE);
      return { csv: buildRoutineCsv(items as never), rows: items.length };
    }
    case "music": {
      const items = await fetchList<NamedDoc>(API_ENDPOINTS.MUSIC);
      return { csv: buildMusicMetaCsv(items as never), rows: items.length };
    }
    case "videos": {
      const items = await fetchList<NamedDoc>(API_ENDPOINTS.VIDEO);
      return { csv: buildVideoMetaCsv(items as never), rows: items.length };
    }
    case "price-compare": {
      const items = await fetchList<ManualPriceCsvProduct>(API_ENDPOINTS.MANUAL_PRICE);
      return { csv: buildManualPriceCsv(items), rows: items.length };
    }
    case "landtop": {
      const payload = await source.fetchJson<{ rows?: unknown[] }>("/api/landtop/history");
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      return { csv: buildLandtopHistoryCsv(rows as never), rows: rows.length };
    }
    case "fengbro-tube": {
      const items = await fetchList<NamedDoc>(API_ENDPOINTS.TUBE_CHANNEL);
      const channels = items
        .map((row) => toFengbroTubeChannelConfig(row))
        .filter((channel): channel is FengbroTubeChannelConfig => Boolean(channel));
      return { csv: buildFengbroTubeCsv(channels), rows: channels.length };
    }
    case "fengbro-finance": {
      const items = await fetchList<NamedDoc>(API_ENDPOINTS.FINANCE_INSTRUMENT);
      const instruments = items
        .map((row) => financeFromDoc(row)?.instrument)
        .filter((item): item is CustomFinanceInstrument => Boolean(item));
      return { csv: buildFinanceCustomCsv(instruments), rows: instruments.length };
    }
    case "fengbro-news": {
      if (!source.newsSites) throw new CsvExportSkipped("新聞網站清單只存在瀏覽器，排程匯出無法讀取");
      const sites = source.newsSites();
      return { csv: buildFengbroNewsCsv(sites), rows: sites.length };
    }
    default:
      throw new Error(`未知的 CSV 選單：${entry.id}`);
  }
}
