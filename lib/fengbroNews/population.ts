/**
 * Taoyuan / Zhongli household population from MOI Household Registration (RIS) open data.
 * - Monthly village totals: ODRP012 (aggregate 桃園市* / 桃園市中壢區)
 * - Year-end township density: ODRP048 (sum districts for city; 中壢 row for district)
 */

export const RIS_ODRP012_URL = "https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP012";
export const RIS_ODRP048_URL = "https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP048";
export const RIS_OPEN_DATA_PORTAL = "https://www.ris.gov.tw/app/portal/346";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Taoyuan villages appear on pages 1–2 of ODRP012 (nationwide ~4 pages). */
const ODRP012_TAOYUAN_PAGES = 2;
const MONTHLY_FETCH_TIMEOUT_MS = 45_000;
const ANNUAL_FETCH_TIMEOUT_MS = 20_000;

export type PopulationMonthPoint = {
  yyymm: string;
  label: string;
  population: number;
  /** 較上月增減（新增人口數） */
  delta: number | null;
};

export type PopulationYearPoint = {
  yyy: string;
  label: string;
  population: number;
  /** year-end snapshot unless note says otherwise */
  note?: string;
};

export type RegionPopulationStats = {
  id: "taoyuan" | "zhongli";
  name: string;
  recentMonths: PopulationMonthPoint[];
  decade: PopulationYearPoint[];
};

export type PopulationStatsResult = {
  fetchedAt: string;
  sourceLabel: string;
  sourceUrl: string;
  latestYyymm: string;
  regions: RegionPopulationStats[];
  warning?: string;
  error?: string;
};

type RisPage = {
  responseCode?: string;
  responseMessage?: string;
  totalPage?: string | number;
  totalDataSize?: string | number;
  page?: string | number;
  responseData?: Array<Record<string, string>>;
};

type MonthTotals = {
  yyymm: string;
  taoyuan: number;
  zhongli: number;
};

function rocNow(d = new Date()): { yyy: number; mm: number; yyymm: string } {
  const yyy = d.getFullYear() - 1911;
  const mm = d.getMonth() + 1;
  return { yyy, mm, yyymm: `${yyy}${String(mm).padStart(2, "0")}` };
}

function shiftYyymm(yyymm: string, deltaMonths: number): string {
  const y = Number(yyymm.slice(0, -2));
  const m = Number(yyymm.slice(-2));
  const total = y * 12 + (m - 1) + deltaMonths;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}${String(nm).padStart(2, "0")}`;
}

export function formatYyymmLabel(yyymm: string): string {
  const y = yyymm.slice(0, -2);
  const m = Number(yyymm.slice(-2));
  return `${y}年${m}月`;
}

export function formatYyyLabel(yyy: string): string {
  return `${yyy}年底`;
}

function formatPeople(n: number): string {
  return n.toLocaleString("zh-TW");
}

export { formatPeople };

async function fetchJson(url: string, timeoutMs: number): Promise<RisPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json,text/plain,*/*",
        "accept-language": "zh-TW,zh;q=0.9",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as RisPage;
  } finally {
    clearTimeout(timer);
  }
}

function isOk(page: RisPage): boolean {
  return page.responseCode === "OD-0101-S" && Array.isArray(page.responseData);
}

function aggregateOdRp012(rows: Array<Record<string, string>>): {
  taoyuan: number;
  zhongli: number;
} {
  let taoyuan = 0;
  let zhongli = 0;
  for (const row of rows) {
    const site = String(row.site_id || "");
    const people = Number(row.people_total || 0);
    if (!Number.isFinite(people)) continue;
    if (site.startsWith("桃園市")) {
      taoyuan += people;
    }
    if (site === "桃園市中壢區") {
      zhongli += people;
    }
  }
  return { taoyuan, zhongli };
}

async function fetchMonthTotals(yyymm: string): Promise<MonthTotals | null> {
  let rows: Array<Record<string, string>> = [];
  for (let page = 1; page <= ODRP012_TAOYUAN_PAGES; page++) {
    const data = await fetchJson(`${RIS_ODRP012_URL}/${yyymm}?page=${page}`, MONTHLY_FETCH_TIMEOUT_MS);
    if (!isOk(data)) {
      if (page === 1) return null;
      break;
    }
    rows = rows.concat(data.responseData || []);
  }
  if (rows.length === 0) return null;
  const { taoyuan, zhongli } = aggregateOdRp012(rows);
  if (taoyuan <= 0 && zhongli <= 0) return null;
  return { yyymm, taoyuan, zhongli };
}

/** Probe backward from current ROC month for the newest ODRP012 release. */
export async function findLatestYyymm(maxLookback = 8): Promise<string | null> {
  let cursor = rocNow().yyymm;
  for (let i = 0; i < maxLookback; i++) {
    const data = await fetchJson(`${RIS_ODRP012_URL}/${cursor}?page=1`, 15_000);
    if (isOk(data)) return cursor;
    cursor = shiftYyymm(cursor, -1);
  }
  return null;
}

function aggregateOdRp048(rows: Array<Record<string, string>>): {
  taoyuan: number;
  zhongli: number;
} {
  let taoyuan = 0;
  let zhongli = 0;
  for (const row of rows) {
    const site = String(row.site_id || "");
    const people = Number(row.people_total || 0);
    if (!Number.isFinite(people)) continue;
    if (site.startsWith("桃園市")) {
      taoyuan += people;
    }
    if (site === "桃園市中壢區") {
      zhongli += people;
    }
  }
  return { taoyuan, zhongli };
}

async function fetchAnnualTotals(yyy: number): Promise<{ yyy: string; taoyuan: number; zhongli: number } | null> {
  const data = await fetchJson(`${RIS_ODRP048_URL}/${yyy}`, ANNUAL_FETCH_TIMEOUT_MS);
  if (!isOk(data)) return null;
  const { taoyuan, zhongli } = aggregateOdRp048(data.responseData || []);
  if (taoyuan <= 0 && zhongli <= 0) return null;
  return { yyy: String(yyy), taoyuan, zhongli };
}

function buildMonthSeries(
  months: MonthTotals[],
  pick: (m: MonthTotals) => number
): PopulationMonthPoint[] {
  // months sorted ascending; first may be baseline-only for delta
  const points: PopulationMonthPoint[] = [];
  for (let i = 0; i < months.length; i++) {
    const cur = months[i];
    const prev = i > 0 ? months[i - 1] : null;
    const population = pick(cur);
    const delta = prev ? population - pick(prev) : null;
    points.push({
      yyymm: cur.yyymm,
      label: formatYyymmLabel(cur.yyymm),
      population,
      delta,
    });
  }
  return points;
}

/**
 * Load 桃園市 / 中壢區: last 3 months (+1 baseline for delta) and ~10 year-end points.
 */
export async function loadPopulationStats(): Promise<PopulationStatsResult> {
  const fetchedAt = new Date().toISOString();
  const sourceLabel = "內政部戶政司開放資料（村里戶數人口月報 ODRP012、鄉鎮市區人口密度年報 ODRP048）";
  const sourceUrl = RIS_OPEN_DATA_PORTAL;

  try {
    const latest = await findLatestYyymm();
    if (!latest) {
      return {
        fetchedAt,
        sourceLabel,
        sourceUrl,
        latestYyymm: "",
        regions: [],
        error: "找不到可用的戶政月報人口資料",
      };
    }

    // 4 months: 1 baseline + 3 display
    const monthKeys = [3, 2, 1, 0].map((back) => shiftYyymm(latest, -back));
    const monthResults = await Promise.all(monthKeys.map((k) => fetchMonthTotals(k)));
    const months = monthResults.filter((m): m is MonthTotals => Boolean(m));
    if (months.length < 2) {
      return {
        fetchedAt,
        sourceLabel,
        sourceUrl,
        latestYyymm: latest,
        regions: [],
        error: "月報人口資料不足（需至少兩個月才能計算新增）",
      };
    }

    // Prefer last 4 available in order; display last 3 with deltas
    const displayMonths = months.length >= 4 ? months.slice(-4) : months;
    const recentSlice = buildMonthSeries(displayMonths, (m) => m.taoyuan);
    const recentZhongli = buildMonthSeries(displayMonths, (m) => m.zhongli);
    // drop baseline if we have 4 points (first has null delta and is only for computing)
    const taoyuanRecent =
      recentSlice.length === 4 ? recentSlice.slice(1) : recentSlice.filter((p) => p.delta !== null || recentSlice.length <= 3);
    const zhongliRecent =
      recentZhongli.length === 4
        ? recentZhongli.slice(1)
        : recentZhongli.filter((p) => p.delta !== null || recentZhongli.length <= 3);

    // Ensure we show up to 3 months (if only 3 total including baseline, show 2 with delta + maybe first without)
    const takeRecent = (pts: PopulationMonthPoint[]) => {
      if (pts.length > 3) return pts.slice(-3);
      // if first has null delta and we have more, keep all for display but prefer those with delta
      return pts.slice(-3);
    };

    const latestRocYear = Number(latest.slice(0, -2));
    // Year-end series: 10 years ending at previous full year (ODRP048 has no current year until year-end)
    const endYear = latestRocYear - 1;
    const startYear = endYear - 9;
    const yearNums = Array.from({ length: 10 }, (_, i) => startYear + i).filter((y) => y >= 106);
    const annualResults = await Promise.all(yearNums.map((y) => fetchAnnualTotals(y)));
    const annuals = annualResults.filter(
      (a): a is { yyy: string; taoyuan: number; zhongli: number } => Boolean(a)
    );

    // Append latest monthly as open-year point when current year has no ODRP048 yet
    const latestMonth = months[months.length - 1];
    const hasCurrentAnnual = annuals.some((a) => a.yyy === String(latestRocYear));
    const decadeTaoyuan: PopulationYearPoint[] = annuals.map((a) => ({
      yyy: a.yyy,
      label: formatYyyLabel(a.yyy),
      population: a.taoyuan,
    }));
    const decadeZhongli: PopulationYearPoint[] = annuals.map((a) => ({
      yyy: a.yyy,
      label: formatYyyLabel(a.yyy),
      population: a.zhongli,
    }));
    if (!hasCurrentAnnual && latestMonth) {
      decadeTaoyuan.push({
        yyy: String(latestRocYear),
        label: formatYyymmLabel(latestMonth.yyymm),
        population: latestMonth.taoyuan,
        note: "最新月報（尚未有年底定稿）",
      });
      decadeZhongli.push({
        yyy: String(latestRocYear),
        label: formatYyymmLabel(latestMonth.yyymm),
        population: latestMonth.zhongli,
        note: "最新月報（尚未有年底定稿）",
      });
    }

    let warning: string | undefined;
    if (months.length < 4) {
      warning = `月報僅取得 ${months.length} 期，已盡力顯示最近資料。`;
    }
    if (decadeTaoyuan.length < 8) {
      warning = [warning, `年報僅取得 ${decadeTaoyuan.length} 年，走勢圖可能較短。`].filter(Boolean).join(" ");
    }

    return {
      fetchedAt,
      sourceLabel,
      sourceUrl,
      latestYyymm: latest,
      regions: [
        {
          id: "taoyuan",
          name: "桃園市",
          recentMonths: takeRecent(taoyuanRecent),
          decade: decadeTaoyuan,
        },
        {
          id: "zhongli",
          name: "中壢區",
          recentMonths: takeRecent(zhongliRecent),
          decade: decadeZhongli,
        },
      ],
      warning,
    };
  } catch (err) {
    return {
      fetchedAt,
      sourceLabel,
      sourceUrl,
      latestYyymm: "",
      regions: [],
      error: err instanceof Error ? err.message : "人口統計讀取失敗",
    };
  }
}
