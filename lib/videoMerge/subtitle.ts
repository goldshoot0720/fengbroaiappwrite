/**
 * Script → timed subtitles (SRT / VTT).
 * Adapted from huang1988pioneer/VideoMerge (subtitle.js) — script path only
 * (no Whisper / Transformers.js model download).
 */

export type SubChunk = {
  timestamp: [number, number];
  text: string;
};

function formatTimestamp(sec: number, style: "srt" | "vtt"): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  if (style === "vtt") {
    return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
  }
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/** Character weight for timing (CJK = 1, latin ~0.45). */
export function scriptWeight(text: string): number {
  let w = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) w += 0.15;
    else if (/[\u3400-\u9fff\uF900-\uFAFF]/.test(ch)) w += 1;
    else if (/[0-9]/.test(ch)) w += 0.6;
    else w += 0.45;
  }
  return Math.max(0.5, w);
}

/**
 * Split plain script into subtitle lines.
 * Returns null if text already looks timed (SRT/VTT) — use parseTimedScript.
 */
export function splitScriptIntoLines(raw: string): string[] | null {
  const text = String(raw || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!text) return [];

  if (
    /^WEBVTT/i.test(text) ||
    /^\d+\s*\n\d{1,2}:\d{2}/m.test(text) ||
    /\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}\s*-->\s*/.test(text)
  ) {
    return null;
  }

  const byLine = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const lines: string[] = [];
  for (const line of byLine) {
    if (line.length <= 40 || !/[。！？!?.；;]/.test(line)) {
      lines.push(line);
      continue;
    }
    const parts = line
      .split(/(?<=[。！？!?.；;])\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length <= 1) {
      lines.push(line);
    } else {
      for (const p of parts) {
        if (p.length > 48) {
          let buf = "";
          for (const ch of p) {
            buf += ch;
            if (buf.length >= 36 && /[，,、\s]/.test(ch)) {
              lines.push(buf.trim());
              buf = "";
            }
          }
          if (buf.trim()) lines.push(buf.trim());
        } else {
          lines.push(p);
        }
      }
    }
  }

  return lines.filter(Boolean);
}

export function parseTimedScript(raw: string): SubChunk[] | null {
  const text = String(raw || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!text) return null;

  const chunks: SubChunk[] = [];

  const toSec = (h: string | number, m: string | number, s: string | number, ms?: string) => {
    const frac = ms != null ? Number(`0.${String(ms).padEnd(3, "0").slice(0, 3)}`) : 0;
    return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0) + frac;
  };

  const parseTs = (str: string): number => {
    const t = str.trim().replace(",", ".");
    let m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
    if (m) return toSec(m[1] || 0, m[2], m[3], m[4]);
    m = t.match(/^(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
    if (m) return toSec(0, m[1], m[2], m[3]);
    m = t.match(/^(\d+(?:\.\d+)?)$/);
    if (m) return Number(m[1]);
    return NaN;
  };

  if (/\d{1,2}:\d{2}.*-->/.test(text) || /^WEBVTT/i.test(text)) {
    const body = text.replace(/^WEBVTT[^\n]*\n+/i, "");
    const blocks = body.split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (!lines.length) continue;
      const timeLine = lines.find((l) => l.includes("-->"));
      if (!timeLine) continue;
      const [a, b] = timeLine.split("-->").map((x) => x.trim());
      const start = parseTs(a.split(/\s+/)[0]);
      const end = parseTs(b.split(/\s+/)[0]);
      const cueText = lines
        .filter((l) => l !== timeLine && !/^\d+$/.test(l))
        .join("\n")
        .trim();
      if (cueText && Number.isFinite(start) && Number.isFinite(end) && end > start) {
        chunks.push({ timestamp: [start, end], text: cueText });
      }
    }
    return chunks.length ? chunks : null;
  }

  const bracketRe =
    /^\[?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?|\d+(?:\.\d+)?)\s*[-–—~]\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?|\d+(?:\.\d+)?)\s*\]?\s*(.+)$/;
  for (const line of text.split("\n")) {
    const m = line.trim().match(bracketRe);
    if (!m) continue;
    const start = parseTs(m[1]);
    const end = parseTs(m[2]);
    const cue = m[3].trim();
    if (cue && Number.isFinite(start) && Number.isFinite(end) && end > start) {
      chunks.push({ timestamp: [start, end], text: cue });
    }
  }
  return chunks.length ? chunks : null;
}

export function chunksToSrt(chunks: SubChunk[]): string {
  const lines: string[] = [];
  let idx = 1;
  for (const c of chunks) {
    const text = (c.text || "").trim();
    if (!text) continue;
    let [start, end] = c.timestamp || [0, 0];
    if (!Number.isFinite(start)) start = 0;
    if (!Number.isFinite(end) || end <= start) end = start + 1.5;
    lines.push(String(idx));
    lines.push(`${formatTimestamp(start, "srt")} --> ${formatTimestamp(end, "srt")}`);
    lines.push(text);
    lines.push("");
    idx += 1;
  }
  return lines.join("\n");
}

export function chunksToVtt(chunks: SubChunk[]): string {
  const lines = ["WEBVTT", ""];
  let idx = 1;
  for (const c of chunks) {
    const text = (c.text || "").trim();
    if (!text) continue;
    let [start, end] = c.timestamp || [0, 0];
    if (!Number.isFinite(start)) start = 0;
    if (!Number.isFinite(end) || end <= start) end = start + 1.5;
    lines.push(String(idx));
    lines.push(`${formatTimestamp(start, "vtt")} --> ${formatTimestamp(end, "vtt")}`);
    lines.push(text);
    lines.push("");
    idx += 1;
  }
  return lines.join("\n");
}

export function shiftChunks(
  chunks: SubChunk[],
  deltaSec: number,
  maxEndSec?: number
): SubChunk[] {
  const d = Number(deltaSec) || 0;
  if (!d && maxEndSec == null) return chunks;
  const out: SubChunk[] = [];
  for (const c of chunks) {
    let s = c.timestamp[0] + d;
    let e = c.timestamp[1] + d;
    if (Number.isFinite(maxEndSec as number)) {
      if (s >= (maxEndSec as number)) continue;
      e = Math.min(e, maxEndSec as number);
    }
    if (s < 0) {
      e += -s;
      s = 0;
    }
    if (e <= s) e = s + 0.4;
    out.push({ timestamp: [s, e], text: c.text });
  }
  return out;
}

/** If video longer than one audio cycle (looped BGM), tile cues. */
export function tileChunksToDuration(
  chunks: SubChunk[],
  audioDurationSec: number,
  videoDurationSec: number
): SubChunk[] {
  if (!chunks.length) return chunks;
  if (
    !Number.isFinite(audioDurationSec) ||
    audioDurationSec <= 0 ||
    !Number.isFinite(videoDurationSec) ||
    videoDurationSec <= audioDurationSec + 0.25
  ) {
    return chunks;
  }

  const out: SubChunk[] = [];
  let offset = 0;
  while (offset < videoDurationSec - 0.05) {
    for (const c of chunks) {
      let [s, e] = c.timestamp || [0, 0];
      if (!Number.isFinite(s)) s = 0;
      if (!Number.isFinite(e) || e <= s) e = s + 1.5;
      const ns = s + offset;
      const ne = Math.min(e + offset, videoDurationSec);
      if (ns >= videoDurationSec) break;
      if (ne > ns + 0.05) {
        out.push({ timestamp: [ns, ne], text: c.text });
      }
    }
    offset += audioDurationSec;
    if (offset > videoDurationSec + audioDurationSec * 2) break;
  }
  return out;
}

export function resolveSubtitleTimeline(p: {
  videoDur: number;
  audioDur?: number | null;
  hasCustomAudio?: boolean;
}): { cycleDur: number; totalDur: number; mode: string } {
  const videoDur = Math.max(0, Number(p.videoDur) || 0);
  const audioDur = Math.max(0, Number(p.audioDur) || 0);
  const hasAudio = Boolean(p.hasCustomAudio) && audioDur > 0.2;

  if (!hasAudio) {
    return { cycleDur: videoDur, totalDur: videoDur, mode: "video-only" };
  }

  const totalDur = videoDur > 0.2 ? videoDur : audioDur;
  if (audioDur <= totalDur + 0.15) {
    return { cycleDur: audioDur, totalDur, mode: "audio-cycle-tile" };
  }
  return { cycleDur: totalDur, totalDur, mode: "audio-trimmed-to-video" };
}

export async function getMediaDuration(file: File | Blob): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    const type = file instanceof File ? file.type : "";
    const el = document.createElement(
      type.startsWith("video/") ? "video" : "audio"
    );
    el.preload = "metadata";
    el.src = url;
    await new Promise<void>((resolve, reject) => {
      el.addEventListener("loadedmetadata", () => resolve(), { once: true });
      el.addEventListener(
        "error",
        () => reject(new Error("無法讀取媒體時長")),
        { once: true }
      );
    });
    const d = el.duration;
    return Number.isFinite(d) ? d : 0;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type ScriptToSubtitlesResult = {
  chunks: SubChunk[];
  srt: string;
  vtt: string;
  text: string;
  source: "timed" | "script";
};

/**
 * Build timed subtitles from plain script or SRT/VTT + target duration.
 */
export function scriptToSubtitles(
  scriptText: string,
  durationSec: number,
  opts: {
    minCueSec?: number;
    maxCueSec?: number;
    gapSec?: number;
    charsPerSec?: number;
    leadInSec?: number;
    leadOutSec?: number;
  } = {}
): ScriptToSubtitlesResult {
  const minCueSec = opts.minCueSec ?? 0.85;
  const maxCueSec = opts.maxCueSec ?? 7.5;
  const gapSec = opts.gapSec ?? 0.06;
  const charsPerSec = opts.charsPerSec ?? 3.2;
  const leadInSec = opts.leadInSec ?? 0.12;
  const leadOutSec = opts.leadOutSec ?? 0.15;

  const timed = parseTimedScript(scriptText);
  if (timed?.length) {
    return {
      chunks: timed,
      srt: chunksToSrt(timed),
      vtt: chunksToVtt(timed),
      text: timed.map((c) => c.text).join(" "),
      source: "timed",
    };
  }

  const lines = splitScriptIntoLines(scriptText);
  if (!lines?.length) {
    throw new Error("語音稿是空的，請貼上或上傳文字稿");
  }

  const dur = Number(durationSec);
  if (!Number.isFinite(dur) || dur <= 0.5) {
    throw new Error("無法取得影片／音訊時長，請先加入影片（或選擇音軌）再上字幕");
  }

  const weights = lines.map((l) => scriptWeight(l));
  let ideals = weights.map((w) => {
    const ideal = w / charsPerSec;
    return Math.min(maxCueSec, Math.max(minCueSec, ideal));
  });
  const gapsTotal = Math.max(0, lines.length - 1) * gapSec;
  const lead = leadInSec + leadOutSec;
  let sumIdeal = ideals.reduce((a, b) => a + b, 0) + gapsTotal + lead;

  const usable = Math.max(dur - 0.02, lines.length * minCueSec * 0.4);
  if (sumIdeal > 1e-6) {
    const scale = (usable - gapsTotal - lead) / (sumIdeal - gapsTotal - lead);
    if (Number.isFinite(scale) && scale > 0) {
      ideals = ideals.map((x) =>
        Math.min(maxCueSec, Math.max(minCueSec * 0.7, x * scale))
      );
    }
  }

  let sumCues = ideals.reduce((a, b) => a + b, 0);
  const targetCues = Math.max(usable - gapsTotal - lead, lines.length * minCueSec * 0.5);
  if (sumCues > 1e-6) {
    const s2 = targetCues / sumCues;
    ideals = ideals.map((x) => Math.max(0.5, x * s2));
  }

  const chunks: SubChunk[] = [];
  let t = leadInSec;
  for (let i = 0; i < lines.length; i++) {
    let len = ideals[i];
    if (i === lines.length - 1) {
      const endTarget = Math.max(t + minCueSec, dur - leadOutSec);
      len = endTarget - t;
    }
    let end = t + len;
    if (end > dur) end = dur;
    if (end <= t) end = Math.min(dur, t + 0.5);
    chunks.push({ timestamp: [t, end], text: lines[i] });
    t = end + (i < lines.length - 1 ? gapSec : 0);
  }

  if (chunks.length) {
    chunks[0].timestamp[0] = Math.max(0, chunks[0].timestamp[0]);
    chunks[chunks.length - 1].timestamp[1] = dur;
  }

  return {
    chunks,
    srt: chunksToSrt(chunks),
    vtt: chunksToVtt(chunks),
    text: lines.join(" "),
    source: "script",
  };
}

/**
 * Build final SRT for merge: plain script or timed file, paced to video/audio cycle.
 * When custom audio is shorter than final video, tiles cues across loops.
 */
export function buildMergeSubtitles(params: {
  scriptText: string;
  videoDur: number;
  audioDur?: number | null;
  hasCustomAudio?: boolean;
}): {
  srt: string;
  vtt: string;
  chunks: SubChunk[];
  cueCount: number;
  source: string;
  mode: string;
} {
  const scriptText = String(params.scriptText || "").trim();
  if (!scriptText) {
    return {
      srt: "",
      vtt: "",
      chunks: [],
      cueCount: 0,
      source: "empty",
      mode: "none",
    };
  }

  const timeline = resolveSubtitleTimeline({
    videoDur: params.videoDur,
    audioDur: params.audioDur,
    hasCustomAudio: params.hasCustomAudio,
  });

  const built = scriptToSubtitles(scriptText, timeline.cycleDur);
  let chunks = built.chunks;

  if (timeline.mode === "audio-cycle-tile" && params.audioDur) {
    chunks = tileChunksToDuration(
      chunks,
      Number(params.audioDur),
      timeline.totalDur
    );
  } else if (
    timeline.totalDur > timeline.cycleDur + 0.25 &&
    built.source === "timed"
  ) {
    // Timed SRT only covers one cycle — tile if final video is longer (loop).
    chunks = tileChunksToDuration(chunks, timeline.cycleDur, timeline.totalDur);
  }

  return {
    srt: chunksToSrt(chunks),
    vtt: chunksToVtt(chunks),
    chunks,
    cueCount: chunks.length,
    source: built.source,
    mode: timeline.mode,
  };
}
