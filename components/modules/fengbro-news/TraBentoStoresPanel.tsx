"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, MapPin, RefreshCw, UtensilsCrossed } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { Button } from "@/components/ui/button";
import type { TraBentoStoresResult } from "@/lib/fengbroNews/types";

export const TRA_BENTO_STORE_URL =
  "https://www.railway.gov.tw/tra-tip-web/tip/tip004/tip421/storeLocation";

export function TraBentoStoresPanel() {
  const [bentoLoading, setBentoLoading] = useState(false);
  const [bentoError, setBentoError] = useState("");
  const [bentoResult, setBentoResult] = useState<TraBentoStoresResult | null>(null);
  const [bentoFocusOnly, setBentoFocusOnly] = useState(true);

  const loadBentoStores = useCallback(async (focusOnly: boolean) => {
    setBentoLoading(true);
    setBentoError("");
    try {
      const response = await fetch(`/api/fengbro-news/bento-stores?focus=${focusOnly ? "1" : "0"}`);
      const data = (await response.json()) as TraBentoStoresResult;
      if (!response.ok) {
        throw new Error(data.error || "台鐵便當門市讀取失敗");
      }
      setBentoResult(data);
    } catch (err) {
      setBentoResult(null);
      setBentoError(err instanceof Error ? err.message : "台鐵便當門市讀取失敗");
    } finally {
      setBentoLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBentoStores(true);
  }, [loadBentoStores]);

  return (
    <DataCard className="overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b border-amber-100 bg-[linear-gradient(135deg,rgba(254,243,199,0.95),rgba(255,255,255,0.96))] p-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <UtensilsCrossed size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700/80">TRA Bento</p>
            <h3 className="mt-0.5 text-lg font-semibold text-foreground">台鐵便當門市據點</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              來源：臺鐵官網門市據點（預設顯示桃園／中壢）
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={TRA_BENTO_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:border-amber-400 hover:bg-amber-50"
          >
            <ExternalLink size={12} />
            官方門市據點
          </a>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const next = !bentoFocusOnly;
              setBentoFocusOnly(next);
              void loadBentoStores(next);
            }}
            className="rounded-xl text-xs"
          >
            {bentoFocusOnly ? "顯示臺北分處全部" : "只看桃園／中壢"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void loadBentoStores(bentoFocusOnly)}
            disabled={bentoLoading}
            className="gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700"
          >
            <RefreshCw size={14} className={bentoLoading ? "animate-spin" : ""} />
            {bentoLoading ? "讀取中" : "更新"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        <p className="break-all text-[11px] text-muted-foreground">{TRA_BENTO_STORE_URL}</p>

        {bentoError && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{bentoError}</p>
        )}
        {bentoResult?.warning && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {bentoResult.warning}
          </p>
        )}

        {bentoLoading && !bentoResult ? (
          <p className="py-8 text-center text-sm text-muted-foreground">讀取台鐵便當門市…</p>
        ) : bentoResult && bentoResult.stores.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {bentoResult.stores.map((store) => (
              <div
                key={`${store.name}-${store.detail}`}
                className={`rounded-2xl border p-4 shadow-sm ${
                  store.focus
                    ? "border-amber-300 bg-gradient-to-br from-amber-50 to-white"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-2">
                  <MapPin
                    size={16}
                    className={`mt-0.5 shrink-0 ${store.focus ? "text-amber-600" : "text-slate-400"}`}
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground">{store.name}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{store.detail}</p>
                    {store.stationHint && (
                      <span className="inline-flex rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        {store.stationHint}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-muted-foreground">
            尚無門市資料
          </p>
        )}

        {bentoResult?.fetchedAt && (
          <p className="text-right text-[11px] text-muted-foreground">
            {bentoResult.live ? "即時" : "備援"} · {new Date(bentoResult.fetchedAt).toLocaleString("zh-TW")}
          </p>
        )}
      </div>
    </DataCard>
  );
}
