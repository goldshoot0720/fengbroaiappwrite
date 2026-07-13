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
 * Build only the currently spoken cue(s) — one per language track.
 * Callers should draw with showAll=true so the time filter cannot drop line 2+.
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
 * Time-window filter used by the canvas renderer.
 * At exact boundaries, prefer the later cue (higher startAt) so line 2 is not skipped.
 */
export function filterActiveByTime(
  subtitleLines: SubtitleLine[],
  elapsed: number,
  showAll = false,
): SubtitleLine[] {
  if (showAll) return subtitleLines;
  if (subtitleLines.length === 0) return [];

  const t = Math.max(0, elapsed);
  const eps = 1e-4;

  // Group by language, pick the latest cue that has started and not fully ended
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
    if (chosen) active.push(chosen);
  }
  return active;
}
