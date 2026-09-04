import { fetchApi } from "@/hooks/useApi";
import { uploadToAppwriteStorage } from "@/lib/appwriteStorage";
import { API_ENDPOINTS } from "@/lib/constants";
import { parseCsvObjects, escapeCsvValue } from "@/lib/csvText";
import { isMultipartFiletype, resolveMultipartFileBlob } from "@/lib/fileMultipart";
import { formatDate } from "@/lib/formatters";
import { loadJSZip } from "@/lib/loadJSZip";

type ZipCtor = Awaited<ReturnType<typeof loadJSZip>>;
type ZipInstance = InstanceType<ZipCtor>;
import { getAppwriteDownloadUrl, getProxiedMediaUrl } from "@/lib/utils";
import { resolveVideoBlob } from "@/lib/videoMultipart";
import type { MenuBackupEntry } from "./catalog";
import type { BackupProgressFn, MenuJobResult } from "./csvMenus";

type MediaDoc = {
  $id: string;
  name?: string;
  title?: string;
  file?: string;
  cover?: string;
  filetype?: string;
  category?: string;
  note?: string;
  ref?: string;
  hash?: string;
  language?: string;
  lyrics?: string;
  content?: string;
  newDate?: string;
  url1?: string;
  url2?: string;
  url3?: string;
  file1?: string;
  file1name?: string;
  file1type?: string;
  file2?: string;
  file2name?: string;
  file2type?: string;
  file3?: string;
  file3name?: string;
  file3type?: string;
  [key: string]: unknown;
};

function sanitizeName(value: string): string {
  return (value || "item").replace(/[<>:"/\\|?*]/g, "_");
}

function seqBase(index: number, name: string, extra = ""): string {
  return `${String(index + 1).padStart(3, "0")}_${sanitizeName(name)}${extra}`;
}

async function fetchList(url: string): Promise<MediaDoc[]> {
  const result = await fetchApi<MediaDoc[]>(url, { cache: "no-store" });
  return Array.isArray(result) ? result : [];
}

async function downloadUrl(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(getProxiedMediaUrl(getAppwriteDownloadUrl(url)));
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

function guessExt(url: string, fallback: string): string {
  const lower = (url || "").toLowerCase();
  const match = lower.match(/\.([a-z0-9]{2,5})(?:\?|$)/);
  if (match) return match[1];
  return fallback;
}

function zipEntry(zip: ZipInstance, path: string) {
  if (!path) return null;
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  if (zip.files[normalized]) return zip.files[normalized];
  const found = Object.keys(zip.files).find((name) => name.replace(/\\/g, "/") === normalized);
  return found ? zip.files[found] : null;
}

async function uploadPath(zip: ZipInstance, path: string): Promise<string> {
  const entry = zipEntry(zip, path);
  if (!entry || entry.dir) return "";
  const blob = await entry.async("blob");
  const fileName = path.split("/").pop() || "file.bin";
  const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
  const uploaded = await uploadToAppwriteStorage(file);
  return uploaded.url;
}

function csvTable(headers: string[], rows: string[][]): string {
  return [headers.join(","), ...rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))].join("\n");
}

type MediaSpec = {
  listUrl: string;
  innerCsvName: string;
  folders: string[];
  csvHeaders: string[];
  exportItem: (zip: ZipInstance, item: MediaDoc, index: number) => Promise<string[]>;
  importRow: (zip: ZipInstance, row: Record<string, string>, existing: MediaDoc[]) => Promise<Record<string, unknown>>;
  match: (item: MediaDoc, row: Record<string, string>) => boolean;
};

const IMAGE_SPEC: MediaSpec = {
  listUrl: API_ENDPOINTS.IMAGE,
  innerCsvName: "image.csv",
  folders: ["images"],
  csvHeaders: ["name", "file", "filetype", "category", "note", "ref", "hash"],
  match: (item, row) => item.name === row.name,
  async exportItem(zip, item, index) {
    const base = seqBase(index, item.name || "image");
    const ext = item.filetype || guessExt(item.file || "", "jpg");
    let imagePath = "";
    if (item.file) {
      const blob = await downloadUrl(item.file);
      if (blob) {
        imagePath = `images/${base}.${ext}`;
        zip.file(imagePath, blob);
      }
    }
    return [item.name || "", imagePath, item.filetype || "", item.category || "", item.note || "", item.ref || "", item.hash || ""];
  },
  async importRow(zip, row, existing) {
    const file = row.file ? await uploadPath(zip, row.file) : "";
    const match = existing.find((item) => item.name === row.name);
    return {
      name: row.name || "",
      file: file || match?.file || "",
      filetype: row.filetype || "",
      category: row.category || "",
      note: row.note || "",
      ref: row.ref || "",
      hash: row.hash || match?.hash || `zip_import_${Date.now()}`,
      cover: false,
    };
  },
};

const VIDEO_SPEC: MediaSpec = {
  listUrl: API_ENDPOINTS.VIDEO,
  innerCsvName: "video.csv",
  folders: ["videos", "covers"],
  csvHeaders: ["name", "file", "cover", "filetype", "category", "note", "ref", "hash"],
  match: (item, row) => item.name === row.name,
  async exportItem(zip, item, index) {
    const base = seqBase(index, item.name || "video");
    let videoPath = "";
    let coverPath = "";
    let filetype = String(item.filetype || "");
    if (item.file) {
      try {
        const resolved = await resolveVideoBlob({ file: item.file, filetype: item.filetype, name: item.name });
        filetype = resolved.filetype || filetype;
        videoPath = `videos/${base}.${filetype || "mp4"}`;
        zip.file(videoPath, resolved.blob);
      } catch {
        const blob = await downloadUrl(item.file);
        if (blob) {
          videoPath = `videos/${base}.${guessExt(item.file, "mp4")}`;
          zip.file(videoPath, blob);
        }
      }
    }
    if (item.cover) {
      const cover = await downloadUrl(item.cover);
      if (cover) {
        coverPath = `covers/${base}.${guessExt(item.cover, "png")}`;
        zip.file(coverPath, cover);
      }
    }
    return [item.name || "", videoPath, coverPath, filetype, item.category || "", item.note || "", item.ref || "", item.hash || ""];
  },
  async importRow(zip, row, existing) {
    const file = row.file ? await uploadPath(zip, row.file) : "";
    const cover = row.cover ? await uploadPath(zip, row.cover) : "";
    const match = existing.find((item) => item.name === row.name);
    return {
      name: row.name || "",
      file: file || match?.file || "",
      cover: cover || match?.cover || "",
      filetype: row.filetype || "",
      category: row.category || "",
      note: row.note || "",
      ref: row.ref || "",
      hash: row.hash || match?.hash || `zip_import_${Date.now()}`,
    };
  },
};

const MUSIC_SPEC: MediaSpec = {
  listUrl: API_ENDPOINTS.MUSIC,
  innerCsvName: "music.csv",
  folders: ["music", "lyrics", "covers"],
  csvHeaders: ["name", "file", "cover", "filetype", "category", "language", "lyrics", "note", "ref", "hash"],
  match: (item, row) => item.name === row.name && String(item.language || "") === (row.language || ""),
  async exportItem(zip, item, index) {
    const langSuffix = item.language ? `_${sanitizeName(item.language)}` : "";
    const base = seqBase(index, item.name || "music", langSuffix);
    let musicPath = "";
    let coverPath = "";
    let lyricsPath = "";
    if (item.file) {
      const blob = await downloadUrl(item.file);
      if (blob) {
        musicPath = `music/${base}.${guessExt(item.file, "mp3")}`;
        zip.file(musicPath, blob);
      }
    }
    if (item.lyrics) {
      lyricsPath = `lyrics/${base}.txt`;
      zip.file(lyricsPath, item.lyrics);
    }
    if (item.cover) {
      const cover = await downloadUrl(item.cover);
      if (cover) {
        coverPath = `covers/${base}.${guessExt(item.cover, "png")}`;
        zip.file(coverPath, cover);
      }
    }
    return [
      item.name || "",
      musicPath,
      coverPath,
      item.filetype || "",
      item.category || "",
      item.language || "",
      lyricsPath,
      item.note || "",
      item.ref || "",
      item.hash || "",
    ];
  },
  async importRow(zip, row, existing) {
    const file = row.file ? await uploadPath(zip, row.file) : "";
    const cover = row.cover ? await uploadPath(zip, row.cover) : "";
    let lyrics = row.lyrics || "";
    if (lyrics && zipEntry(zip, lyrics)) {
      lyrics = await zipEntry(zip, lyrics)!.async("string");
    }
    const match = existing.find((item) => item.name === row.name && String(item.language || "") === (row.language || ""));
    return {
      name: row.name || "",
      file: file || match?.file || "",
      cover: cover || match?.cover || "",
      filetype: row.filetype || "",
      category: row.category || "",
      language: row.language || "",
      lyrics,
      note: row.note || "",
      ref: row.ref || "",
      hash: row.hash || match?.hash || `zip_import_${Date.now()}`,
    };
  },
};

const PODCAST_SPEC: MediaSpec = {
  listUrl: API_ENDPOINTS.PODCAST,
  innerCsvName: "podcast.csv",
  folders: ["podcast", "covers"],
  csvHeaders: ["name", "file", "cover", "filetype", "category", "note", "ref", "hash"],
  match: (item, row) => item.name === row.name,
  async exportItem(zip, item, index) {
    const base = seqBase(index, item.name || "podcast");
    let podcastPath = "";
    let coverPath = "";
    if (item.file) {
      const blob = await downloadUrl(item.file);
      if (blob) {
        podcastPath = `podcast/${base}.${guessExt(item.file, "mp3")}`;
        zip.file(podcastPath, blob);
      }
    }
    if (item.cover) {
      const cover = await downloadUrl(item.cover);
      if (cover) {
        coverPath = `covers/${base}.${guessExt(item.cover, "png")}`;
        zip.file(coverPath, cover);
      }
    }
    return [item.name || "", podcastPath, coverPath, item.filetype || "", item.category || "", item.note || "", item.ref || "", item.hash || ""];
  },
  async importRow(zip, row, existing) {
    const file = row.file ? await uploadPath(zip, row.file) : "";
    const cover = row.cover ? await uploadPath(zip, row.cover) : "";
    const match = existing.find((item) => item.name === row.name);
    return {
      name: row.name || "",
      file: file || match?.file || "",
      cover: cover || match?.cover || "",
      filetype: row.filetype || "",
      category: row.category || "",
      note: row.note || "",
      ref: row.ref || "",
      hash: row.hash || match?.hash || `zip_import_${Date.now()}`,
    };
  },
};

const DOCUMENT_SPEC: MediaSpec = {
  listUrl: API_ENDPOINTS.COMMONDOCUMENT,
  innerCsvName: "document.csv",
  folders: ["files", "covers"],
  csvHeaders: ["name", "file", "cover", "filetype", "category", "note", "ref", "hash"],
  match: (item, row) => item.name === row.name,
  async exportItem(zip, item, index) {
    const base = seqBase(index, item.name || "document");
    let filePath = "";
    let coverPath = "";
    if (item.file) {
      const blob = await downloadUrl(item.file);
      if (blob) {
        filePath = `files/${base}.${guessExt(item.file, "pdf")}`;
        zip.file(filePath, blob);
      }
    }
    if (item.cover) {
      const cover = await downloadUrl(item.cover);
      if (cover) {
        coverPath = `covers/${base}.${guessExt(item.cover, "png")}`;
        zip.file(coverPath, cover);
      }
    }
    return [item.name || "", filePath, coverPath, item.filetype || "", item.category || "", item.note || "", item.ref || "", item.hash || ""];
  },
  async importRow(zip, row, existing) {
    const file = row.file ? await uploadPath(zip, row.file) : "";
    const cover = row.cover ? await uploadPath(zip, row.cover) : "";
    const match = existing.find((item) => item.name === row.name);
    return {
      name: row.name || "",
      file: file || match?.file || "",
      cover: cover || match?.cover || "",
      filetype: row.filetype || "",
      category: row.category || "",
      note: row.note || "",
      ref: row.ref || "",
      hash: row.hash || match?.hash || `zip_import_${Date.now()}`,
    };
  },
};

const SPECS: Record<string, MediaSpec> = {
  images: IMAGE_SPEC,
  videos: VIDEO_SPEC,
  music: MUSIC_SPEC,
  podcast: PODCAST_SPEC,
  documents: DOCUMENT_SPEC,
};

async function exportNotesZip(onProgress?: BackupProgressFn): Promise<Blob> {
  const items = await fetchList(API_ENDPOINTS.ARTICLE);
  const zip = new (await loadJSZip())();
  zip.folder("files");
  const headers = [
    "title",
    "content",
    "category",
    "newDate",
    "url1",
    "url2",
    "url3",
    "file1",
    "file1name",
    "file1type",
    "file2",
    "file2name",
    "file2type",
    "file3",
    "file3name",
    "file3type",
  ];
  const rows: string[][] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress?.({
      stage: "export-zip",
      current: i + 1,
      total: items.length,
      message: `筆記 ${item.title || item.name || i + 1}`,
      menuId: "notes",
    });
    const paths = ["", "", ""];
    const files = [
      { url: item.file1, name: item.file1name, type: item.file1type, slot: 0 },
      { url: item.file2, name: item.file2name, type: item.file2type, slot: 1 },
      { url: item.file3, name: item.file3name, type: item.file3type, slot: 2 },
    ];
    for (const file of files) {
      if (!file.url) continue;
      const localName = `${i}_${file.slot + 1}_${file.name || `file${file.slot + 1}`}`;
      try {
        const blob = isMultipartFiletype(file.type)
          ? (await resolveMultipartFileBlob({ file: file.url, filetype: file.type, name: file.name })).blob
          : await downloadUrl(file.url);
        if (blob) {
          zip.file(`files/${localName}`, blob);
          paths[file.slot] = `files/${localName}`;
        }
      } catch {
        // skip failed attachment
      }
    }
    rows.push([
      item.title || "",
      item.content || "",
      item.category || "",
      formatDate(item.newDate || "") || "",
      item.url1 || "",
      item.url2 || "",
      item.url3 || "",
      paths[0],
      item.file1name || "",
      item.file1type || "",
      paths[1],
      item.file2name || "",
      item.file2type || "",
      paths[2],
      item.file3name || "",
      item.file3type || "",
    ]);
  }
  zip.file("appwrite-article.csv", `\uFEFF${csvTable(headers, rows)}`);
  return zip.generateAsync({ type: "blob" });
}

async function importNotesZip(zip: ZipInstance, onProgress?: BackupProgressFn): Promise<MenuJobResult> {
  const csvEntry =
    zipEntry(zip, "appwrite-article.csv") ||
    Object.values(zip.files).find((file) => !file.dir && /article\.csv$/i.test(file.name));
  if (!csvEntry) {
    return { id: "notes", label: "鋒兄筆記", status: "error", rows: 0, message: "ZIP 裡沒有 appwrite-article.csv" };
  }
  const parsed = parseCsvObjects(await csvEntry.async("string"));
  const existing = await fetchList(API_ENDPOINTS.ARTICLE);
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];
    onProgress?.({
      stage: "import-zip",
      current: i + 1,
      total: parsed.rows.length,
      message: `筆記 ${row.title || i + 1}`,
      menuId: "notes",
    });
    try {
      const file1 = row.file1 ? await uploadPath(zip, row.file1) : "";
      const file2 = row.file2 ? await uploadPath(zip, row.file2) : "";
      const file3 = row.file3 ? await uploadPath(zip, row.file3) : "";
      const match = existing.find((item) => item.title === row.title);
      const body = {
        title: row.title || "",
        content: row.content || "",
        category: row.category || "",
        newDate: row.newDate || "",
        url1: row.url1 || "",
        url2: row.url2 || "",
        url3: row.url3 || "",
        file1: file1 || match?.file1 || "",
        file1name: row.file1name || "",
        file1type: row.file1type || "",
        file2: file2 || match?.file2 || "",
        file2name: row.file2name || "",
        file2type: row.file2type || "",
        file3: file3 || match?.file3 || "",
        file3name: row.file3name || "",
        file3type: row.file3type || "",
      };
      if (match) {
        await fetchApi(`${API_ENDPOINTS.ARTICLE}/${encodeURIComponent(match.$id)}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        const created = await fetchApi<MediaDoc>(API_ENDPOINTS.ARTICLE, {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (created?.$id) existing.push({ ...created, title: body.title });
      }
      ok += 1;
    } catch {
      fail += 1;
    }
  }
  return {
    id: "notes",
    label: "鋒兄筆記",
    status: fail ? "error" : "ok",
    rows: ok,
    message: fail ? `成功 ${ok}、失敗 ${fail}` : undefined,
  };
}

export async function exportZipMenu(entry: MenuBackupEntry, onProgress?: BackupProgressFn): Promise<Blob> {
  if (entry.id === "notes") return exportNotesZip(onProgress);
  const spec = SPECS[entry.id];
  if (!spec) throw new Error(`未知的 ZIP 選單：${entry.id}`);
  const items = await fetchList(spec.listUrl);
  const zip = new (await loadJSZip())();
  for (const folder of spec.folders) zip.folder(folder);
  const rows: string[][] = [];
  for (let i = 0; i < items.length; i++) {
    onProgress?.({
      stage: "export-zip",
      current: i + 1,
      total: items.length,
      message: `${entry.label} ${items[i].name || i + 1}`,
      menuId: entry.id,
    });
    rows.push(await spec.exportItem(zip, items[i], i));
  }
  zip.file(spec.innerCsvName, csvTable(spec.csvHeaders, rows));
  return zip.generateAsync({ type: "blob" });
}

export async function importZipMenu(
  entry: MenuBackupEntry,
  data: Blob | ZipInstance,
  onProgress?: BackupProgressFn,
): Promise<MenuJobResult> {
  const zip = "files" in data ? (data as ZipInstance) : await (await loadJSZip()).loadAsync(data);
  if (entry.id === "notes") return importNotesZip(zip, onProgress);
  const spec = SPECS[entry.id];
  if (!spec) {
    return { id: entry.id, label: entry.label, status: "skipped", rows: 0, message: "此選單沒有 ZIP 備份" };
  }
  const csvEntry =
    zipEntry(zip, spec.innerCsvName) ||
    Object.values(zip.files).find((file) => !file.dir && file.name.replace(/\\/g, "/").endsWith(spec.innerCsvName));
  if (!csvEntry) {
    return { id: entry.id, label: entry.label, status: "error", rows: 0, message: `ZIP 裡沒有 ${spec.innerCsvName}` };
  }
  const parsed = parseCsvObjects(await csvEntry.async("string"));
  const existing = await fetchList(spec.listUrl);
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];
    onProgress?.({
      stage: "import-zip",
      current: i + 1,
      total: parsed.rows.length,
      message: `${entry.label} ${row.name || i + 1}`,
      menuId: entry.id,
    });
    try {
      const body = await spec.importRow(zip, row, existing);
      const match = existing.find((item) => spec.match(item, row));
      if (match) {
        await fetchApi(`${spec.listUrl}/${encodeURIComponent(match.$id)}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        const created = await fetchApi<MediaDoc>(spec.listUrl, {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (created?.$id) existing.push(created);
      }
      ok += 1;
    } catch {
      fail += 1;
    }
  }
  return {
    id: entry.id,
    label: entry.label,
    status: fail ? "error" : "ok",
    rows: ok,
    message: fail ? `成功 ${ok}、失敗 ${fail}` : undefined,
  };
}
