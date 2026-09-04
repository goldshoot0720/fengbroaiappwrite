/** Catalog of menus that 鋒兄設定 can one-click export / import. */

export const MENU_BACKUP_VERSION = 1;
export const CSV_BUNDLE_DIR = "csv";
export const ZIP_BUNDLE_DIR = "zip";
export const MANIFEST_NAME = "manifest.json";
export const REPORT_NAME = "report.txt";

export type MenuBackupKind = "csv" | "zip";
export type MenuBackupMode = "csv" | "all";

export type MenuBackupEntry = {
  id: string;
  label: string;
  /** Filename stem used by getExportFilename / matching. */
  csvStem?: string;
  /** Nested ZIP stem inside the all-menus bundle. */
  zipStem?: string;
  /** Include this menu's standalone CSV in the CSV-only bundle. */
  csvOnly: boolean;
  /** Include this menu's media ZIP in the all-menus bundle. */
  zipBundle: boolean;
};

export const MENU_BACKUP_ENTRIES: readonly MenuBackupEntry[] = [
  { id: "food", label: "鋒兄食品", csvStem: "food", csvOnly: true, zipBundle: false },
  { id: "subscription", label: "鋒兄訂閱", csvStem: "subscription", csvOnly: true, zipBundle: false },
  { id: "trial-purchase", label: "鋒兄試用/首購", csvStem: "trialpurchase", csvOnly: true, zipBundle: false },
  { id: "reinstall", label: "鋒兄重灌", csvStem: "reinstall", csvOnly: true, zipBundle: false },
  { id: "quota", label: "鋒兄額度", csvStem: "quota", csvOnly: true, zipBundle: false },
  { id: "shopping-list", label: "鋒兄購物清單", csvStem: "shoppinglist", csvOnly: true, zipBundle: false },
  { id: "common", label: "鋒兄常用", csvStem: "commonaccount", csvOnly: true, zipBundle: false },
  { id: "bank-stats", label: "鋒兄銀行", csvStem: "bank", csvOnly: true, zipBundle: false },
  { id: "routine", label: "鋒兄例行", csvStem: "routine", csvOnly: true, zipBundle: false },
  { id: "price-compare", label: "鋒兄比價", csvStem: "manual-price", csvOnly: true, zipBundle: false },
  { id: "landtop", label: "手機比價", csvStem: "landtop-history", csvOnly: true, zipBundle: false },
  { id: "fengbro-tube", label: "鋒兄Tube", csvStem: "fengbro-tube", csvOnly: true, zipBundle: false },
  { id: "fengbro-finance", label: "鋒兄金融", csvStem: "fengbro-finance", csvOnly: true, zipBundle: false },
  { id: "fengbro-news", label: "鋒兄新聞", csvStem: "fengbro-news", csvOnly: true, zipBundle: false },
  { id: "music", label: "鋒兄音樂", csvStem: "music", zipStem: "music", csvOnly: true, zipBundle: true },
  { id: "videos", label: "鋒兄影片", csvStem: "video", zipStem: "videos", csvOnly: true, zipBundle: true },
  { id: "images", label: "鋒兄圖片", zipStem: "images", csvOnly: false, zipBundle: true },
  { id: "podcast", label: "鋒兄播客", zipStem: "podcast", csvOnly: false, zipBundle: true },
  { id: "documents", label: "鋒兄文件", zipStem: "documents", csvOnly: false, zipBundle: true },
  { id: "notes", label: "鋒兄筆記", zipStem: "notes", csvOnly: false, zipBundle: true },
] as const;

const CSV_STEM_ALIASES: Record<string, string> = {
  food: "food",
  subscription: "subscription",
  trialpurchase: "trial-purchase",
  "trial-purchase": "trial-purchase",
  reinstall: "reinstall",
  quota: "quota",
  shoppinglist: "shopping-list",
  "shopping-list": "shopping-list",
  commonaccount: "common",
  common: "common",
  bank: "bank-stats",
  "bank-stats": "bank-stats",
  routine: "routine",
  "manual-price": "price-compare",
  manualprice: "price-compare",
  "landtop-history": "landtop",
  landtop: "landtop",
  "fengbro-tube": "fengbro-tube",
  tubechannel: "fengbro-tube",
  "fengbro-finance": "fengbro-finance",
  financeinstrument2: "fengbro-finance",
  "fengbro-news": "fengbro-news",
  music: "music",
  video: "videos",
};

const ZIP_STEM_ALIASES: Record<string, string> = {
  images: "images",
  image: "images",
  videos: "videos",
  video: "videos",
  music: "music",
  podcast: "podcast",
  documents: "documents",
  document: "documents",
  commondocument: "documents",
  notes: "notes",
  article: "notes",
  "appwrite-article": "notes",
};

export function csvMenus(): MenuBackupEntry[] {
  return MENU_BACKUP_ENTRIES.filter((entry) => entry.csvOnly);
}

export function zipMenus(): MenuBackupEntry[] {
  return MENU_BACKUP_ENTRIES.filter((entry) => entry.zipBundle);
}

export function csvPathFor(entry: MenuBackupEntry): string {
  return `${CSV_BUNDLE_DIR}/${entry.csvStem}.csv`;
}

export function zipPathFor(entry: MenuBackupEntry): string {
  return `${ZIP_BUNDLE_DIR}/${entry.zipStem}.zip`;
}

export function basenameOf(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() || "";
}

function stripDateSuffix(name: string): string {
  return name.replace(/-\d{8}$/, "");
}

function knownStems(kind: MenuBackupKind): string[] {
  const aliases = kind === "csv" ? CSV_STEM_ALIASES : ZIP_STEM_ALIASES;
  return Object.keys(aliases).sort((a, b) => b.length - a.length);
}

/** Pull the catalog stem out of appwrite-{nickname}-{stem}-{YYYYMMDD}.ext names. */
export function extractFileStem(filename: string): string {
  let name = basenameOf(filename).toLowerCase();
  name = name.replace(/\.(csv|zip)$/i, "");
  if (name.startsWith("appwrite-")) name = name.slice("appwrite-".length);
  name = stripDateSuffix(name);
  return name;
}

export function identifyBackupFile(path: string): { id: string; kind: MenuBackupKind } | null {
  const base = basenameOf(path).toLowerCase();
  if (base === MANIFEST_NAME || base === REPORT_NAME) return null;

  let kind: MenuBackupKind | null = null;
  if (base.endsWith(".csv")) kind = "csv";
  else if (base.endsWith(".zip")) kind = "zip";
  if (!kind) return null;

  const stem = extractFileStem(base);
  const aliases = kind === "csv" ? CSV_STEM_ALIASES : ZIP_STEM_ALIASES;
  if (aliases[stem]) return { id: aliases[stem], kind };

  for (const known of knownStems(kind)) {
    if (stem === known || stem.endsWith(`-${known}`)) {
      return { id: aliases[known], kind };
    }
  }
  return null;
}

export type MenuBackupManifest = {
  version: number;
  kind: MenuBackupMode;
  exportedAt: string;
  menus: string[];
};

export function buildManifest(kind: MenuBackupMode, menus: string[]): MenuBackupManifest {
  return {
    version: MENU_BACKUP_VERSION,
    kind,
    exportedAt: new Date().toISOString(),
    menus,
  };
}
