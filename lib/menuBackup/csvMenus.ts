import { fetchApi } from "@/hooks/useApi";
import { API_ENDPOINTS } from "@/lib/constants";
import { parseBankCsv, toBankCsvRow, BANK_CSV_HEADERS } from "@/lib/bankCsv";
import {
  buildFinanceCustomCsv,
  mergeFinanceCustomInstruments,
  parseFinanceCustomCsv,
} from "@/lib/fengbroFinanceCsv";
import {
  buildFengbroNewsCsv,
  mergeFengbroNewsSites,
  parseFengbroNewsCsv,
} from "@/lib/fengbroNewsCsv";
import {
  migrateFinanceGroup,
  normalizeCustomFinanceInstrument,
  normalizeFinanceRelatedLinks,
  type CustomFinanceInstrument,
} from "@/lib/fengbroFinanceCustom";
import { FENGBRO_NEWS_SITES_KEY as NEWS_SITES_KEY, type FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";
import {
  buildFengbroTubeCsv,
  mergeFengbroTubeChannels,
  parseFengbroTubeCsv,
} from "@/lib/fengbroTubeCsv";
import { toFengbroTubeChannelConfig, type FengbroTubeChannelConfig } from "@/lib/fengbroTubeChannels";
import { buildLandtopHistoryCsv, parseLandtopHistoryCsv } from "@/lib/landtopHistoryCsv";
import {
  buildManualPriceCsv,
  mergeManualPriceProducts,
  parseManualPriceCsv,
  type ManualPriceCsvProduct,
} from "@/lib/manualPriceCsv";
import { buildQuotaCsv, parseQuotaCsv, quotaImportKey } from "@/lib/quotaCsv";
import { buildReinstallCsv, parseReinstallCsv, reinstallImportKey } from "@/lib/reinstallCsv";
import { buildShoppingCsv, parseShoppingCsv, shoppingImportKey } from "@/lib/shoppingCsv";
import { buildTrialPurchaseCsv, parseTrialPurchaseCsv, trialPurchaseImportKey } from "@/lib/trialPurchaseCsv";
import type { Bank, CommonAccount, Food, Quota, ReinstallSoftware, ShoppingItem, Subscription, TrialPurchase } from "@/types";
import { csvMenus, type MenuBackupEntry } from "./catalog";
import {
  buildCommonAccountCsv,
  buildFoodCsv,
  buildMusicMetaCsv,
  buildRoutineCsv,
  buildSubscriptionCsv,
  buildVideoMetaCsv,
  parseCommonAccountCsv,
  parseFoodCsv,
  parseMusicMetaCsv,
  parseRoutineCsv,
  parseSubscriptionBackupCsv,
  parseVideoMetaCsv,
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

type NamedDoc = { $id: string; name?: string; title?: string; language?: string; file?: string; cover?: string; hash?: string };

async function fetchList<T>(url: string): Promise<T[]> {
  const result = await fetchApi<T[] | { rows?: T[] }>(url, { cache: "no-store" });
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && Array.isArray((result as { rows?: T[] }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

async function upsertRows<T extends { $id: string }>(
  listUrl: string,
  existing: T[],
  rows: Array<Record<string, unknown>>,
  keyOfExisting: (item: T) => string,
  keyOfRow: (row: Record<string, unknown>) => string,
  onRow?: (index: number, total: number, name: string) => void,
): Promise<{ ok: number; fail: number }> {
  const index = new Map(existing.map((item) => [keyOfExisting(item), item.$id]));
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    onRow?.(i + 1, rows.length, String(row.name || row.title || i + 1));
    try {
      const key = keyOfRow(row);
      const existingId = index.get(key);
      if (existingId) {
        await fetchApi(`${listUrl}/${encodeURIComponent(existingId)}`, {
          method: "PUT",
          body: JSON.stringify(row),
        });
      } else {
        const created = await fetchApi<T>(listUrl, {
          method: "POST",
          body: JSON.stringify(row),
        });
        if (created?.$id) index.set(key, created.$id);
      }
      ok += 1;
    } catch {
      fail += 1;
    }
  }
  return { ok, fail };
}

function byName(item: { name?: string }): string {
  return (item.name || "").trim().toLocaleLowerCase("zh-Hant");
}

function financeFromDoc(row: Record<string, unknown>): { id: string; instrument: CustomFinanceInstrument } | null {
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

function financeKey(instrument: CustomFinanceInstrument): string {
  return `${instrument.provider}|${instrument.symbol.trim().toUpperCase()}`;
}

function financeBody(instrument: CustomFinanceInstrument): Record<string, unknown> {
  return {
    name: instrument.name,
    symbol: instrument.symbol,
    provider: instrument.provider,
    group: instrument.group,
    imageUrls: Array.isArray(instrument.imageUrls)
      ? instrument.imageUrls
      : instrument.imageUrl
        ? [instrument.imageUrl]
        : [],
    youtubeUrl: instrument.youtubeUrl || "",
    bilibiliUrl: instrument.bilibiliUrl || "",
    relatedLinks: instrument.relatedLinks || [],
    featured: Boolean(instrument.featured),
  };
}

function loadNewsSites(): FengbroNewsSiteConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NEWS_SITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNewsSites(sites: FengbroNewsSiteConfig[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NEWS_SITES_KEY, JSON.stringify(sites));
}

function normalizeSubscriptionImportKey(item: {
  name?: string;
  account?: string;
  site?: string;
  price?: number;
  nextdate?: string;
  currency?: string;
}): string {
  const name = (item.name || "").trim().toLocaleLowerCase("zh-Hant");
  const account = (item.account || "").trim().toLocaleLowerCase("zh-Hant");
  return `${name}::${account}`;
}

export async function exportCsvMenu(
  entry: MenuBackupEntry,
  onProgress?: BackupProgressFn,
): Promise<{ csv: string; rows: number }> {
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
      const payload = await fetchApi<{ rows?: unknown[] }>("/api/landtop/history", { cache: "no-store" });
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
      const sites = loadNewsSites();
      return { csv: buildFengbroNewsCsv(sites), rows: sites.length };
    }
    default:
      throw new Error(`未知的 CSV 選單：${entry.id}`);
  }
}

export async function importCsvMenu(
  entry: MenuBackupEntry,
  csv: string,
  onProgress?: BackupProgressFn,
): Promise<MenuJobResult> {
  const report = (status: MenuJobResult["status"], rows: number, message?: string): MenuJobResult => ({
    id: entry.id,
    label: entry.label,
    status,
    rows,
    message,
  });

  const progress = (message: string, current = 0, total = 1) =>
    onProgress?.({ stage: "import-csv", current, total, message, menuId: entry.id });

  try {
    progress(`匯入 ${entry.label}`);

    switch (entry.id) {
      case "food": {
        const parsed = parseFoodCsv(csv);
        if (parsed.errors.length && parsed.data.length === 0) {
          return report("error", 0, parsed.errors[0]);
        }
        const existing = await fetchList<Food>(API_ENDPOINTS.FOOD);
        const { ok, fail } = await upsertRows(
          API_ENDPOINTS.FOOD,
          existing,
          parsed.data,
          (item) => byName(item),
          (row) => byName(row),
          (current, total, name) => progress(`${entry.label} ${name}`, current, total),
        );
        return report(fail ? "error" : "ok", ok, fail ? `成功 ${ok}、失敗 ${fail}` : undefined);
      }
      case "subscription": {
        const parsed = parseSubscriptionBackupCsv(csv);
        if (parsed.errors.length && parsed.data.length === 0) {
          return report("error", 0, parsed.errors[0]);
        }
        const existing = await fetchList<Subscription>(API_ENDPOINTS.SUBSCRIPTION);
        const { ok, fail } = await upsertRows(
          API_ENDPOINTS.SUBSCRIPTION,
          existing,
          parsed.data as unknown as Array<Record<string, unknown>>,
          (item) => normalizeSubscriptionImportKey(item),
          (row) => normalizeSubscriptionImportKey(row),
          (current, total, name) => progress(`${entry.label} ${name}`, current, total),
        );
        return report(fail ? "error" : "ok", ok, fail ? `成功 ${ok}、失敗 ${fail}` : undefined);
      }
      case "trial-purchase": {
        const parsed = parseTrialPurchaseCsv(csv);
        if (parsed.errors.length && parsed.data.length === 0) {
          return report("error", 0, parsed.errors[0]);
        }
        const existing = await fetchList<TrialPurchase>(API_ENDPOINTS.TRIAL_PURCHASE);
        const { ok, fail } = await upsertRows(
          API_ENDPOINTS.TRIAL_PURCHASE,
          existing,
          parsed.data as unknown as Array<Record<string, unknown>>,
          (item) => trialPurchaseImportKey({ name: item.name, account: item.account }),
          (row) => trialPurchaseImportKey({ name: String(row.name || ""), account: String(row.account || "") }),
          (current, total, name) => progress(`${entry.label} ${name}`, current, total),
        );
        return report(fail ? "error" : "ok", ok, fail ? `成功 ${ok}、失敗 ${fail}` : undefined);
      }
      case "reinstall": {
        const parsed = parseReinstallCsv(csv);
        if (parsed.errors.length && parsed.data.length === 0) {
          return report("error", 0, parsed.errors[0]);
        }
        const existing = await fetchList<ReinstallSoftware>(API_ENDPOINTS.REINSTALL);
        const { ok, fail } = await upsertRows(
          API_ENDPOINTS.REINSTALL,
          existing,
          parsed.data as unknown as Array<Record<string, unknown>>,
          (item) => reinstallImportKey({ name: item.name, system: item.system }),
          (row) => reinstallImportKey({ name: String(row.name || ""), system: String(row.system || "win") }),
          (current, total, name) => progress(`${entry.label} ${name}`, current, total),
        );
        return report(fail ? "error" : "ok", ok, fail ? `成功 ${ok}、失敗 ${fail}` : undefined);
      }
      case "quota": {
        const parsed = parseQuotaCsv(csv);
        if (parsed.errors.length && parsed.data.length === 0) {
          return report("error", 0, parsed.errors[0]);
        }
        const existing = await fetchList<Quota>(API_ENDPOINTS.QUOTA);
        const { ok, fail } = await upsertRows(
          API_ENDPOINTS.QUOTA,
          existing,
          parsed.data as unknown as Array<Record<string, unknown>>,
          (item) => quotaImportKey({ name: item.name, account: item.account }),
          (row) => quotaImportKey({ name: String(row.name || ""), account: String(row.account || "") }),
          (current, total, name) => progress(`${entry.label} ${name}`, current, total),
        );
        return report(fail ? "error" : "ok", ok, fail ? `成功 ${ok}、失敗 ${fail}` : undefined);
      }
      case "shopping-list": {
        const parsed = parseShoppingCsv(csv);
        if (parsed.errors.length && parsed.data.length === 0) {
          return report("error", 0, parsed.errors[0]);
        }
        const existing = await fetchList<ShoppingItem>(API_ENDPOINTS.SHOPPING_LIST);
        const { ok, fail } = await upsertRows(
          API_ENDPOINTS.SHOPPING_LIST,
          existing,
          parsed.data as unknown as Array<Record<string, unknown>>,
          (item) => shoppingImportKey({ name: item.name }),
          (row) => shoppingImportKey({ name: String(row.name || "") }),
          (current, total, name) => progress(`${entry.label} ${name}`, current, total),
        );
        return report(fail ? "error" : "ok", ok, fail ? `成功 ${ok}、失敗 ${fail}` : undefined);
      }
      case "common": {
        const parsed = parseCommonAccountCsv(csv);
        if (parsed.errors.length && parsed.data.length === 0) {
          return report("error", 0, parsed.errors[0]);
        }
        const existing = await fetchList<CommonAccount>(API_ENDPOINTS.COMMON_ACCOUNT);
        const { ok, fail } = await upsertRows(
          API_ENDPOINTS.COMMON_ACCOUNT,
          existing,
          parsed.data,
          (item) => byName(item),
          (row) => byName(row),
          (current, total, name) => progress(`${entry.label} ${name}`, current, total),
        );
        return report(fail ? "error" : "ok", ok, fail ? `成功 ${ok}、失敗 ${fail}` : undefined);
      }
      case "bank-stats": {
        const parsed = parseBankCsv(csv);
        if (parsed.errors.length && parsed.data.length === 0) {
          return report("error", 0, parsed.errors[0]);
        }
        const existing = await fetchList<Bank>(API_ENDPOINTS.BANK);
        const { ok, fail } = await upsertRows(
          API_ENDPOINTS.BANK,
          existing,
          parsed.data as unknown as Array<Record<string, unknown>>,
          (item) => byName(item),
          (row) => byName(row),
          (current, total, name) => progress(`${entry.label} ${name}`, current, total),
        );
        return report(fail ? "error" : "ok", ok, fail ? `成功 ${ok}、失敗 ${fail}` : undefined);
      }
      case "routine": {
        const parsed = parseRoutineCsv(csv);
        if (parsed.errors.length && parsed.data.length === 0) {
          return report("error", 0, parsed.errors[0]);
        }
        const existing = await fetchList<NamedDoc>(API_ENDPOINTS.ROUTINE);
        const { ok, fail } = await upsertRows(
          API_ENDPOINTS.ROUTINE,
          existing,
          parsed.data as unknown as Array<Record<string, unknown>>,
          (item) => byName(item),
          (row) => byName(row),
          (current, total, name) => progress(`${entry.label} ${name}`, current, total),
        );
        return report(fail ? "error" : "ok", ok, fail ? `成功 ${ok}、失敗 ${fail}` : undefined);
      }
      case "music": {
        const parsed = parseMusicMetaCsv(csv);
        if (parsed.errors.length && parsed.data.length === 0) {
          return report("error", 0, parsed.errors[0]);
        }
        const existing = await fetchList<NamedDoc>(API_ENDPOINTS.MUSIC);
        const { ok, fail } = await upsertRows(
          API_ENDPOINTS.MUSIC,
          existing,
          parsed.data.map((row) => {
            const match = existing.find(
              (item) => item.name === row.name && String(item.language || "") === row.language,
            );
            return {
              ...row,
              file: match?.file || "",
              cover: match?.cover || "",
              hash: match?.hash || `csv_import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            };
          }),
          (item) => `${byName(item)}\0${String(item.language || "").trim()}`,
          (row) => `${byName(row)}\0${String(row.language || "").trim()}`,
          (current, total, name) => progress(`${entry.label} ${name}`, current, total),
        );
        return report(fail ? "error" : "ok", ok, fail ? `成功 ${ok}、失敗 ${fail}` : undefined);
      }
      case "videos": {
        const parsed = parseVideoMetaCsv(csv);
        if (parsed.errors.length && parsed.data.length === 0) {
          return report("error", 0, parsed.errors[0]);
        }
        const existing = await fetchList<NamedDoc>(API_ENDPOINTS.VIDEO);
        const { ok, fail } = await upsertRows(
          API_ENDPOINTS.VIDEO,
          existing,
          parsed.data.map((row) => {
            const match = existing.find((item) => item.name === row.name);
            return {
              ...row,
              file: match?.file || "",
              cover: match?.cover || "",
              hash: match?.hash || `csv_import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            };
          }),
          (item) => byName(item),
          (row) => byName(row),
          (current, total, name) => progress(`${entry.label} ${name}`, current, total),
        );
        return report(fail ? "error" : "ok", ok, fail ? `成功 ${ok}、失敗 ${fail}` : undefined);
      }
      case "price-compare": {
        const parsed = parseManualPriceCsv(csv);
        if (parsed.errors.length && parsed.data.length === 0) {
          return report("error", 0, parsed.errors[0]);
        }
        const existing = await fetchList<ManualPriceCsvProduct>(API_ENDPOINTS.MANUAL_PRICE);
        const merged = mergeManualPriceProducts(existing, parsed.data);
        let ok = 0;
        let fail = 0;
        const existingIds = new Set(existing.map((item) => item.id));
        for (let i = 0; i < merged.length; i++) {
          const product = merged[i];
          progress(`${entry.label} ${product.name}`, i + 1, merged.length);
          try {
            const body = {
              name: product.name,
              currency: product.currency,
              records: product.records,
              localId: product.id,
            };
            if (existingIds.has(product.id)) {
              await fetchApi(`${API_ENDPOINTS.MANUAL_PRICE}/${encodeURIComponent(product.id)}`, {
                method: "PUT",
                body: JSON.stringify(body),
              });
            } else {
              await fetchApi(API_ENDPOINTS.MANUAL_PRICE, {
                method: "POST",
                body: JSON.stringify(body),
              });
            }
            ok += 1;
          } catch {
            fail += 1;
          }
        }
        return report(fail ? "error" : "ok", ok, fail ? `成功 ${ok}、失敗 ${fail}` : undefined);
      }
      case "landtop": {
        const parsed = parseLandtopHistoryCsv(csv);
        if (parsed.data.length === 0) {
          return report("error", 0, parsed.errors[0] || "CSV 沒有可匯入的歷史價格");
        }
        const result = await fetchApi<{ imported?: number; error?: string }>("/api/landtop/history", {
          method: "POST",
          body: JSON.stringify({ rows: parsed.data }),
        });
        return report("ok", result.imported || parsed.data.length, result.error);
      }
      case "fengbro-tube": {
        const parsed = parseFengbroTubeCsv(csv);
        if (parsed.data.length === 0) {
          return report("error", 0, parsed.errors[0] || "CSV 沒有可匯入的頻道");
        }
        const existingDocs = await fetchList<NamedDoc>(API_ENDPOINTS.TUBE_CHANNEL);
        const existing = existingDocs
          .map((row) => ({ id: row.$id, channel: toFengbroTubeChannelConfig(row) }))
          .filter((item): item is { id: string; channel: FengbroTubeChannelConfig } => Boolean(item.channel));
        const merged = mergeFengbroTubeChannels(
          existing.map((item) => item.channel),
          parsed.data,
        );
        const idByUrl = new Map(existing.map((item) => [item.channel.sourceUrl, item.id]));
        let ok = 0;
        let fail = 0;
        for (let i = 0; i < merged.length; i++) {
          const channel = merged[i];
          progress(`${entry.label} ${channel.alias || channel.sourceUrl}`, i + 1, merged.length);
          try {
            const existingId = idByUrl.get(channel.sourceUrl);
            if (existingId) {
              await fetchApi(`${API_ENDPOINTS.TUBE_CHANNEL}/${encodeURIComponent(existingId)}`, {
                method: "PUT",
                body: JSON.stringify(channel),
              });
            } else {
              await fetchApi(API_ENDPOINTS.TUBE_CHANNEL, {
                method: "POST",
                body: JSON.stringify(channel),
              });
            }
            ok += 1;
          } catch {
            fail += 1;
          }
        }
        return report(fail ? "error" : "ok", ok, fail ? `成功 ${ok}、失敗 ${fail}` : undefined);
      }
      case "fengbro-finance": {
        const parsed = parseFinanceCustomCsv(csv);
        if (parsed.data.length === 0) {
          return report("error", 0, parsed.errors[0] || "CSV 沒有可匯入的標的");
        }
        const existingDocs = await fetchList<NamedDoc>(API_ENDPOINTS.FINANCE_INSTRUMENT);
        const existing = existingDocs
          .map((row) => financeFromDoc(row))
          .filter((item): item is { id: string; instrument: CustomFinanceInstrument } => Boolean(item));
        const merged = mergeFinanceCustomInstruments(
          existing.map((item) => item.instrument),
          parsed.data,
        );
        const idByKey = new Map(existing.map((item) => [financeKey(item.instrument), item.id]));
        let ok = 0;
        let fail = 0;
        for (let i = 0; i < merged.length; i++) {
          const instrument = merged[i];
          progress(`${entry.label} ${instrument.name}`, i + 1, merged.length);
          try {
            const existingId = idByKey.get(financeKey(instrument));
            const body = financeBody(instrument);
            if (existingId) {
              await fetchApi(`${API_ENDPOINTS.FINANCE_INSTRUMENT}/${encodeURIComponent(existingId)}`, {
                method: "PUT",
                body: JSON.stringify(body),
              });
            } else {
              await fetchApi(API_ENDPOINTS.FINANCE_INSTRUMENT, {
                method: "POST",
                body: JSON.stringify(body),
              });
            }
            ok += 1;
          } catch {
            fail += 1;
          }
        }
        return report(fail ? "error" : "ok", ok, fail ? `成功 ${ok}、失敗 ${fail}` : undefined);
      }
      case "fengbro-news": {
        const parsed = parseFengbroNewsCsv(csv);
        if (parsed.data.length === 0) {
          return report("error", 0, parsed.errors[0] || "CSV 沒有可匯入的新聞來源");
        }
        const merged = mergeFengbroNewsSites(loadNewsSites(), parsed.data);
        saveNewsSites(merged);
        return report("ok", parsed.data.length);
      }
      default:
        return report("skipped", 0, "此選單沒有 CSV 備份");
    }
  } catch (error) {
    return report("error", 0, error instanceof Error ? error.message : "匯入失敗");
  }
}

export function csvMenuById(id: string): MenuBackupEntry | undefined {
  return csvMenus().find((entry) => entry.id === id);
}
