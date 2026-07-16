/**
 * Smoke test: subtitle timing must never surface all script lines at once.
 * Run: node scratch/test-subtitle-timing.mjs
 */

function computeSegmentStarts(segmentDurations) {
  const starts = [];
  for (let i = 0; i < segmentDurations.length; i++) {
    starts.push(i === 0 ? 0 : starts[i - 1] + segmentDurations[i - 1]);
  }
  return starts;
}

function segmentIndexAt(elapsed, segmentStarts) {
  const n = segmentStarts.length;
  if (n === 0) return -1;
  const t = Math.max(0, elapsed);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    if (t + 1e-6 >= segmentStarts[i]) idx = i;
    else break;
  }
  return Math.min(idx, n - 1);
}

function activeSubtitlesForElapsed(spokenByTrack, languages, segmentStarts, segmentDurations, elapsed) {
  const idx = segmentIndexAt(elapsed, segmentStarts);
  if (idx < 0) return [];
  const startAt = segmentStarts[idx] ?? 0;
  const endAt = startAt + (segmentDurations[idx] ?? 0);
  const out = [];
  for (let t = 0; t < spokenByTrack.length; t++) {
    const text = (spokenByTrack[t][idx] ?? '').trim();
    if (!text) continue;
    out.push({ text, startAt, endAt, language: languages[t] ?? `track-${t}` });
  }
  return out;
}

function pickOnePerLanguage(subtitleLines, elapsed, fallbackToLatest) {
  if (subtitleLines.length === 0) return [];
  const t = Math.max(0, elapsed);
  const eps = 1e-4;
  const byLang = new Map();
  for (const line of subtitleLines) {
    const key = line.language || '';
    if (!byLang.has(key)) byLang.set(key, []);
    byLang.get(key).push(line);
  }
  const active = [];
  for (const [, cues] of byLang) {
    const sorted = [...cues].sort((a, b) => a.startAt - b.startAt);
    let chosen = null;
    for (const cue of sorted) {
      const isLast = cue === sorted[sorted.length - 1];
      const inWindow = isLast
        ? t + eps >= cue.startAt && t <= cue.endAt + eps
        : t + eps >= cue.startAt && t < cue.endAt + eps;
      if (inWindow) {
        if (!chosen || cue.startAt >= chosen.startAt) chosen = cue;
      }
    }
    if (!chosen) {
      for (const cue of sorted) {
        if (t + eps >= cue.startAt) chosen = cue;
      }
      if (chosen && t > chosen.endAt + 0.25) chosen = null;
    }
    if (!chosen && fallbackToLatest && sorted.length > 0) {
      chosen = sorted[sorted.length - 1];
    }
    if (chosen) active.push(chosen);
  }
  return active;
}

const spoken = [['語音稿第一行', '語音稿第二行', '語音稿第三行']];
const durs = [2, 2, 2];
const starts = computeSegmentStarts(durs);
const langs = ['zh-TW'];

let failed = 0;
for (const t of [0, 0.5, 1.99, 2.0, 2.01, 3.5, 4.0, 5.5, 5.99]) {
  const active = activeSubtitlesForElapsed(spoken, langs, starts, durs, t);
  if (active.length !== 1) {
    console.error('FAIL: expected 1 cue at', t, active);
    failed++;
  }
  const texts = active.map((a) => a.text);
  if (texts.some((x) => x.includes(' / '))) {
    console.error('FAIL: joined text at', t, texts);
    failed++;
  }
  console.log(t, '->', texts.join('|'));
}

// Old preview bug: all lines + showAll must collapse to one
const allLines = spoken[0].map((text, i) => ({
  text,
  startAt: i,
  endAt: i + 1,
  language: 'zh-TW',
}));
const collapsed0 = pickOnePerLanguage(allLines, 0, true);
const collapsed1 = pickOnePerLanguage(allLines, 1.2, false);
const collapsed2 = pickOnePerLanguage(allLines, 2.1, false);

if (collapsed0.length !== 1 || collapsed0[0].text !== '語音稿第一行') {
  console.error('FAIL collapse t=0', collapsed0);
  failed++;
} else {
  console.log('collapse t=0 OK', collapsed0[0].text);
}
if (collapsed1.length !== 1 || collapsed1[0].text !== '語音稿第二行') {
  console.error('FAIL collapse t=1.2', collapsed1);
  failed++;
} else {
  console.log('collapse t=1.2 OK', collapsed1[0].text);
}
if (collapsed2.length !== 1 || collapsed2[0].text !== '語音稿第三行') {
  console.error('FAIL collapse t=2.1', collapsed2);
  failed++;
} else {
  console.log('collapse t=2.1 OK', collapsed2[0].text);
}

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nAll subtitle timing checks passed.');
