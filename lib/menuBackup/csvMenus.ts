import { fetchApi } from "@/hooks/useApi";
import { API_ENDPOINTS } from "@/lib/constants";
import { parseBankCsv } from "@/lib/bankCsv";
import { mergeFinanceCustomInstruments, parseFinanceCustomCsv } from "@/lib/fengbroFinanceCsv";
import { mergeFengbroNewsSites, parseFengbroNewsCsv } from "@/lib/fengbroNewsCsv";
import type { CustomFinanceInstrument } from "@/lib/fengbroFinanceCustom";
import { FENGBRO_NEWS_SITES_KEY as NEWS_SITES_KEY, type FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";
import { mergeFengbroTubeChannels, parseFengbroTubeCsv } from "@/lib/fengbroTubeCsv";
import { toFengbroTubeChannelConfig, type FengbroTubeChannelConfig } from "@/lib/fengbroTubeChannels";
import { parseLandtopHistoryCsv } from "@/lib/landtopHistoryCsv";
import {
  mergeManualPriceProducts,
  parseManualPriceCsv,
  type ManualPriceCsvProduct,
} from "@/lib/manualPriceCsv";
import { parseQuotaCsv, quotaImportKey } from "@/lib/quotaCsv";
import { parseReinstallCsv, reinstallImportKey } from "@/lib/reinstallCsv";
import { parseShoppingCsv, shoppingImportKey } from "@/lib/shoppingCsv";
import { parseTrialPurchaseCsv, trialPurchaseImportKey } from "@/lib/trialPurchaseCsv";
import type { Bank, CommonAccount, Food, Quota, ReinstallSoftware, ShoppingItem, Subscription, TrialPurchase } from "@/types";
import { csvMenus, type MenuBackupEntry } from "./catalog";
import {
  parseCommonAccountCsv,
  parseFoodCsv,
  parseMusicMetaCsv,
  parseRoutineCsv,
  parseSubscriptionBackupCsv,
  parseVideoMetaCsv,
} from "./simpleCsv";
import { exportCsvMenuWith, financeFromDoc, type BackupProgressFn, type MenuJobResult } from "./csvExport";

export type { BackupProgressFn, MenuJobResult } from "./csvExport";

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

/** Browser export: reads through fetchApi (Appwrite config from localStorage). */
export function exportCsvMenu(
  entry: MenuBackupEntry,
  onProgress?: BackupProgressFn,
): Promise<{ csv: string; rows: number }> {
  return exportCsvMenuWith(
    entry,
    { fetchJson: (url) => fetchApi(url, { cache: "no-store" }), newsSites: loadNewsSites },
    onProgress,
  );
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
