import type { SubtitleLine } from '@/hooks/imageVoiceVideo/useCanvasRenderer';

/** Prefix sums → segment start times (seconds). */
export function computeSegmentStarts(segmentDurations: number[]): number[] {
  const starts: number[] = [];
  for (let i = 0; i < segmentDurations.length; i++) {
    starts.push(i === 0 ? 0 : starts[i - 1] + segmentDurations[i - 1]);
  }
  return starts;
}

/**
 * Which script line is active at `elapsed` seconds.
 * Uses half-open windows [start, end) and keeps the last segment through the end.
 */
export function segmentIndexAt(
  elapsed: number,
  segmentStarts: number[],
  segmentDurations: number[],
): number {
  const n = segmentStarts.length;
  if (n === 0) return -1;

  const t = Math.max(0, elapsed);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    if (t + 1e-6 >= segmentStarts[i]) idx = i;
    else break;
  }

  // Stay on last line through the final frame (inclusive end)
  return Math.min(idx, n - 1);
}

/**
 * Build only the currently spoken cue(s) — one per language track for this segment.
 * Never returns multiple script lines for the same language (avoids stacked duplicates).
 */
export function activeSubtitlesForElapsed(
  spokenByTrack: string[][],
  languages: string[],
  segmentStarts: number[],
  segmentDurations: number[],
  elapsed: number,
): SubtitleLine[] {
  const idx = segmentIndexAt(elapsed, segmentStarts, segmentDurations);
  if (idx < 0) return [];

  const startAt = segmentStarts[idx] ?? 0;
  const endAt = startAt + (segmentDurations[idx] ?? 0);

  const out: SubtitleLine[] = [];
  for (let t = 0; t < spokenByTrack.length; t++) {
    const text = (spokenByTrack[t][idx] ?? '').trim();
    if (!text) continue;
    out.push({
      text,
      startAt,
      endAt,
      language: languages[t] ?? `track-${t}`,
    });
  }
  return out;
}

/**
 * Collapse to at most one cue per language.
 * Prefer the latest-starting cue whose time window contains `elapsed`.
 * Never return every script line at once (that produced "行1 / 行2 / 行3" duplicates).
 */
function pickOnePerLanguage(
  subtitleLines: SubtitleLine[],
  elapsed: number,
  /** When true, if nothing matches time, keep the latest cue (caller pre-selected). */
  fallbackToLatest: boolean,
): SubtitleLine[] {
  if (subtitleLines.length === 0) return [];

  const t = Math.max(0, elapsed);
  const eps = 1e-4;

  const byLang = new Map<string, SubtitleLine[]>();
  for (const line of subtitleLines) {
    const key = line.language || '';
    if (!byLang.has(key)) byLang.set(key, []);
    byLang.get(key)!.push(line);
  }

  const active: SubtitleLine[] = [];
  for (const [, cues] of byLang) {
    const sorted = [...cues].sort((a, b) => a.startAt - b.startAt);
    let chosen: SubtitleLine | null = null;
    for (const cue of sorted) {
      const start = cue.startAt;
      const end = cue.endAt;
      // Inclusive end for the last cue of this language so the final frame still shows text
      const isLast = cue === sorted[sorted.length - 1];
      const inWindow = isLast
        ? t + eps >= start && t <= end + eps
        : t + eps >= start && t < end + eps;
      if (inWindow) {
        // Prefer later start when overlapping at a boundary
        if (!chosen || cue.startAt >= chosen.startAt) chosen = cue;
      }
    }
    // Fallback: if floating-point left a tiny gap, keep the latest started cue
    if (!chosen) {
      for (const cue of sorted) {
        if (t + eps >= cue.startAt) chosen = cue;
      }
      if (chosen && t > chosen.endAt + 0.25) chosen = null;
    }
    // Recording passes only the current segment cue(s); accept them even if
    // wall-clock / AudioContext drift slightly outside [start, end).
    if (!chosen && fallbackToLatest && sorted.length > 0) {
      chosen = sorted[sorted.length - 1];
    }
    if (chosen) active.push(chosen);
  }
  return active;
}

/**
 * Time-window filter used by the canvas renderer.
 * Always ≤1 cue per language — never joins all script lines into one caption.
 * At exact boundaries, prefer the later cue (higher startAt) so line 2 is not skipped.
 *
 * `showAll=true` means "caller already chose the active set; still collapse per language
 * and prefer time match, else keep latest" — it does NOT mean "draw every line at once".
 */
export function filterActiveByTime(
  subtitleLines: SubtitleLine[],
  elapsed: number,
  showAll = false,
): SubtitleLine[] {
  return pickOnePerLanguage(subtitleLines, elapsed, showAll);
}
