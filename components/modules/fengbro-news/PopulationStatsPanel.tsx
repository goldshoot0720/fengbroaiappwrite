"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Users } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { Button } from "@/components/ui/button";
import type {
  PopulationMonthPoint,
  PopulationStatsResult,
  PopulationYearPoint,
  RegionPopulationStats,
} from "@/lib/fengbroNews/population";

function formatPeople(n: number): string {
  return n.toLocaleString("zh-TW");
}

function formatDelta(delta: number | null): { text: string; className: string } {
  if (delta === null) return { text: "—", className: "text-muted-foreground" };
  if (delta > 0) return { text: `+${formatPeople(delta)}`, className: "text-emerald-600" };
  if (delta < 0) return { text: formatPeople(delta), className: "text-rose-600" };
  return { text: "0", className: "text-muted-foreground" };
}

function buildChartPath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function DecadeTrendChart({
  points,
  accent,
}: {
  points: PopulationYearPoint[];
  accent: "emerald" | "sky";
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chart = useMemo(() => {
    if (points.length === 0) return null;
    const width = 720;
    const height = 240;
    const padding = { top: 20, right: 20, bottom: 36, left: 64 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const values = points.map((p) => p.population);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const range = Math.max(maxV - minV, Math.max(1, maxV * 0.02));
    const domainMin = Math.max(0, minV - range * 0.25);
    const domainMax = maxV + range * 0.2;
    const domain = Math.max(domainMax - domainMin, 1);

    const mapped = points.map((entry, index) => {
      const x =
        padding.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
      const y = padding.top + ((domainMax - entry.population) / domain) * innerHeight;
      return { ...entry, x, y };
    });

    const linePath = buildChartPath(mapped);
    const areaPath = `${linePath} L ${mapped[mapped.length - 1].x.toFixed(2)} ${(height - padding.bottom).toFixed(2)} L ${mapped[0].x.toFixed(2)} ${(height - padding.bottom).toFixed(2)} Z`;

    return {
      width,
      height,
      padding,
      mapped,
      linePath,
      areaPath,
      minV,
      maxV,
      domainMin,
      domainMax,
      latest: mapped[mapped.length - 1],
      earliest: mapped[0],
    };
  }, [points]);

  if (!chart) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-muted-foreground">
        尚無近十年人口資料可繪製。
      </div>
    );
  }

  const stroke = accent === "emerald" ? "#059669" : "#0284c7";
  const delta = chart.latest.population - chart.earliest.population;
  const deltaTone = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-muted-foreground";

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scaleX = chart.width / rect.width;
    const svgX = x * scaleX;
    let closest = 0;
    let minDiff = Infinity;
    chart.mapped.forEach((p, i) => {
      const d = Math.abs(p.x - svgX);
      if (d < minDiff) {
        minDiff = d;
        closest = i;
      }
    });
    setHoveredIndex(closest);
  };

  const hover = hoveredIndex !== null ? chart.mapped[hoveredIndex] : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">10-year trend</p>
          <h5 className="mt-0.5 text-sm font-semibold text-foreground">近十年走勢圖</h5>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-xl bg-slate-50 px-2.5 py-1 text-muted-foreground">
            區間變化{" "}
            <span className={`font-semibold ${deltaTone}`}>
              {delta > 0 ? "+" : ""}
              {formatPeople(delta)}
            </span>
          </span>
          <span className="rounded-xl bg-slate-50 px-2.5 py-1 text-muted-foreground">
            最新 <span className="font-semibold text-foreground">{formatPeople(chart.latest.population)}</span>
          </span>
        </div>
      </div>
      <div className="relative px-2 pb-2 pt-1 sm:px-3">
        {hover && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 text-xs shadow-md">
            <span className="font-medium text-foreground">{hover.label}</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="tabular-nums text-foreground">{formatPeople(hover.population)}</span>
            {hover.note ? <span className="ml-1 text-muted-foreground">({hover.note})</span> : null}
          </div>
        )}
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="h-auto w-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIndex(null)}
          role="img"
          aria-label="近十年人口走勢"
        >
          <defs>
            <linearGradient id={`pop-area-${accent}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* y grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = chart.padding.top + t * (chart.height - chart.padding.top - chart.padding.bottom);
            const val = Math.round(chart.domainMax - t * (chart.domainMax - chart.domainMin));
            return (
              <g key={t}>
                <line
                  x1={chart.padding.left}
                  x2={chart.width - chart.padding.right}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                />
                <text x={chart.padding.left - 8} y={y + 4} textAnchor="end" className="fill-slate-400" fontSize="11">
                  {(val / 10000).toFixed(val >= 1_000_000 ? 0 : 1)}萬
                </text>
              </g>
            );
          })}
          <path d={chart.areaPath} fill={`url(#pop-area-${accent})`} />
          <path d={chart.linePath} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
          {chart.mapped.map((p, i) => (
            <g key={p.yyy}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredIndex === i ? 5.5 : 3.5}
                fill={stroke}
                stroke="#fff"
                strokeWidth="1.5"
              />
              <text
                x={p.x}
                y={chart.height - 12}
                textAnchor="middle"
                className="fill-slate-500"
                fontSize="10"
              >
                {p.yyy}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function RegionBlock({
  region,
  accent,
}: {
  region: RegionPopulationStats;
  accent: "emerald" | "sky";
}) {
  const header =
    accent === "emerald"
      ? {
          bar: "border-emerald-100 bg-[linear-gradient(135deg,rgba(209,250,229,0.95),rgba(255,255,255,0.96))]",
          icon: "bg-emerald-100 text-emerald-700",
          eyebrow: "text-emerald-700/80",
          badge: "border-emerald-200 bg-white text-emerald-800",
        }
      : {
          bar: "border-sky-100 bg-[linear-gradient(135deg,rgba(224,242,254,0.95),rgba(255,255,255,0.96))]",
          icon: "bg-sky-100 text-sky-700",
          eyebrow: "text-sky-700/80",
          badge: "border-sky-200 bg-white text-sky-800",
        };

  const latest = region.recentMonths[region.recentMonths.length - 1];

  return (
    <DataCard className="overflow-hidden p-0">
      <div className={`flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-end sm:justify-between ${header.bar}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${header.icon}`}>
            <Users size={20} />
          </div>
          <div>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${header.eyebrow}`}>
              {region.id === "taoyuan" ? "Taoyuan City" : "Zhongli District"}
            </p>
            <h3 className="mt-0.5 text-lg font-semibold text-foreground">{region.name}人口統計</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              最近三個月人口數、新增人口數，以及近十年走勢
            </p>
          </div>
        </div>
        {latest && (
          <div className={`rounded-2xl border px-3 py-2 text-right ${header.badge}`}>
            <p className="text-[11px] opacity-80">{latest.label}</p>
            <p className="text-lg font-semibold tabular-nums">{formatPeople(latest.population)}</p>
            <p className={`text-xs font-medium ${formatDelta(latest.delta).className}`}>
              新增 {formatDelta(latest.delta).text}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">最近三個月</h4>
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead className="bg-slate-50/80 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-medium">統計期</th>
                  <th className="px-3 py-2.5 font-medium">人口數</th>
                  <th className="px-3 py-2.5 font-medium">新增人口數</th>
                </tr>
              </thead>
              <tbody>
                {region.recentMonths.map((row: PopulationMonthPoint) => {
                  const d = formatDelta(row.delta);
                  return (
                    <tr key={row.yyymm} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 font-medium text-foreground">{row.label}</td>
                      <td className="px-3 py-2.5 tabular-nums text-foreground">{formatPeople(row.population)}</td>
                      <td className={`px-3 py-2.5 tabular-nums font-medium ${d.className}`}>{d.text}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">新增人口數＝本月人口 − 上月人口（淨增減）</p>
        </div>

        <DecadeTrendChart points={region.decade} accent={accent} />
      </div>
    </DataCard>
  );
}

export function PopulationStatsPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PopulationStatsResult | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/fengbro-news/population${refresh ? "?refresh=1" : ""}`);
      const data = (await response.json()) as PopulationStatsResult & { cached?: boolean };
      if (!response.ok || data.error) {
        throw new Error(data.error || "人口統計讀取失敗");
      }
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "人口統計讀取失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const taoyuan = result?.regions.find((r) => r.id === "taoyuan");
  const zhongli = result?.regions.find((r) => r.id === "zhongli");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Population</p>
          <h3 className="text-base font-semibold text-foreground">桃園／中壢人口統計</h3>
          <p className="text-xs text-muted-foreground">
            來源：內政部戶政司開放資料（月報村里彙總、年報鄉鎮市區）
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {result?.sourceUrl && (
            <a
              href={result.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <ExternalLink size={12} />
              戶政司人口統計
            </a>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => void load(true)}
            disabled={loading}
            className="gap-1.5 rounded-xl"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {loading ? "讀取中" : "更新"}
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {result?.warning && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {result.warning}
        </p>
      )}

      {loading && !result ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-center text-sm text-muted-foreground">
          讀取桃園／中壢人口統計…
        </p>
      ) : (
        <div className="space-y-4">
          {taoyuan && <RegionBlock region={taoyuan} accent="emerald" />}
          {zhongli && <RegionBlock region={zhongli} accent="sky" />}
          {!taoyuan && !zhongli && !error && (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-muted-foreground">
              尚無人口統計資料
            </p>
          )}
        </div>
      )}

      {result?.fetchedAt && (
        <p className="text-right text-[11px] text-muted-foreground">
          更新：{new Date(result.fetchedAt).toLocaleString("zh-TW")}
          {result.latestYyymm ? ` · 最新月報 ${result.latestYyymm}` : ""}
        </p>
      )}
    </div>
  );
}
