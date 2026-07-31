export type DownfallIndexVideoInput = {
  videoId: string;
  title: string;
  url?: string;
  publishedAt?: string;
  updatedAt?: string;
};

export type DownfallIndexUpdate = {
  value: string;
  title: string;
  url: string;
  publishedAt: string;
};

export type DownfallIndexHistoryEntry = {
  date: string;
  price: number;
};

export type DownfallIndexVideoSample<TVideo extends DownfallIndexVideoInput> = {
  video: TVideo;
  value: string;
  publishedAt: string;
};

export const DOWNFALL_INDEX_BASELINE_HISTORY: DownfallIndexHistoryEntry[] = [
  { date: "2025-10-04T00:00:00.000Z", price: 67.44 },
  { date: "2025-11-01T00:00:00.000Z", price: 68.28 },
  { date: "2026-06-07T00:00:00.000Z", price: 70.58 },
];

/** Thumbnail-only values where the title does not carry the index number. */
export const KNOWN_DOWNFALL_INDEX_BY_VIDEO_ID: Record<string, { value: string; publishedAt: string }> = {
  sticRfV28VM: { value: "67.44", publishedAt: "2025-10-04T00:00:00.000Z" },
};

export function extractDownfallIndex(title: string) {
  const normalizedTitle = normalizeDigits(title);
  const numberPattern = "([0-9]+(?:\\.[0-9]+)?)";
  const movementUnits = "飆至|飙至|升至|漲至|涨至|達到|达到|衝到|冲到|升到|達|达|突破|破|到|至";

  const movementNearLabel = normalizedTitle.match(
    new RegExp(`倒台指[數数][」』"']?.{0,40}?(?:${movementUnits})\\s*${numberPattern}`)
  );
  if (movementNearLabel?.[1]) {
    const full = movementNearLabel[0];
    const num = movementNearLabel[1];
    const nextText = full.slice(full.lastIndexOf(num) + num.length);
    if (isPlausibleDownfallIndex(num, nextText)) return formatDownfallIndex(num);
  }

  const indexAfterLabel = normalizedTitle.match(
    new RegExp(`倒台指[數数][」』"']?\\s*${numberPattern}(?![月日號号年])`)
  );
  if (indexAfterLabel?.[1] && isPlausibleDownfallIndex(indexAfterLabel[1])) {
    return formatDownfallIndex(indexAfterLabel[1]);
  }

  const labelMatch = /倒台指[數数]/.exec(normalizedTitle);
  if (labelMatch) {
    const afterLabelText = normalizedTitle.slice(
      labelMatch.index + labelMatch[0].length,
      labelMatch.index + labelMatch[0].length + 80
    );
    const movementValue = afterLabelText.match(new RegExp(`(?:${movementUnits})\\s*${numberPattern}`));
    if (movementValue?.[1] && isPlausibleDownfallIndex(movementValue[1])) {
      return formatDownfallIndex(movementValue[1]);
    }

    const afterLabelNumbers = [...afterLabelText.matchAll(new RegExp(numberPattern, "g"))];
    const firstNonDateNumber = afterLabelNumbers.find((match) => {
      const nextText = afterLabelText.slice((match.index || 0) + match[0].length).trimStart();
      return isPlausibleDownfallIndex(match[1], nextText);
    });
    if (firstNonDateNumber?.[1]) return formatDownfallIndex(firstNonDateNumber[1]);
  }

  const beforeLabel = normalizedTitle.match(new RegExp(`${numberPattern}\\s*(?:分|%|％)?\\s*倒台指[數数]`));
  if (beforeLabel?.[1] && isPlausibleDownfallIndex(beforeLabel[1])) {
    return formatDownfallIndex(beforeLabel[1]);
  }

  return "";
}

export function isDownfallIndexChannel(sourceUrl: string, title: string) {
  return /henren778/i.test(sourceUrl) || /一[個个]狠人/.test(title);
}

export function resolveDownfallIndexForVideo(video: DownfallIndexVideoInput): DownfallIndexUpdate | null {
  const fromTitle = extractDownfallIndex(video.title);
  if (fromTitle) {
    return {
      value: fromTitle,
      title: video.title,
      url: video.url || "",
      publishedAt: video.publishedAt || video.updatedAt || "",
    };
  }

  const known = KNOWN_DOWNFALL_INDEX_BY_VIDEO_ID[video.videoId];
  if (!known) return null;

  return {
    value: known.value,
    title: video.title,
    url: video.url || "",
    publishedAt: video.publishedAt || video.updatedAt || known.publishedAt,
  };
}

export function applyKnownDownfallIndexPublishedAt<TVideo extends DownfallIndexVideoInput>(video: TVideo): TVideo {
  const known = KNOWN_DOWNFALL_INDEX_BY_VIDEO_ID[video.videoId];
  if (!known) return video;

  return {
    ...video,
    publishedAt: known.publishedAt,
    updatedAt: video.updatedAt || known.publishedAt,
  };
}

export function normalizeDownfallIndexUpdatePublishedAt<TUpdate extends DownfallIndexUpdate>(update: TUpdate): TUpdate {
  const videoId = extractYoutubeVideoId(update.url);
  const known = videoId ? KNOWN_DOWNFALL_INDEX_BY_VIDEO_ID[videoId] : undefined;
  if (!known || Number(update.value) !== Number(known.value)) return update;
  return { ...update, publishedAt: known.publishedAt };
}

export function getDownfallIndexVideoSamples<
  TVideo extends DownfallIndexVideoInput,
  TChannel extends { sourceUrl: string; title: string; videos: TVideo[] },
>(channel: TChannel | null | undefined): Array<DownfallIndexVideoSample<TVideo>> {
  if (!channel || !isDownfallIndexChannel(channel.sourceUrl, channel.title)) return [];

  return channel.videos
    .map((video) => {
      const resolved = resolveDownfallIndexForVideo(video);
      if (!resolved) return null;
      const publishedAt = resolved.publishedAt || video.publishedAt || "";
      return {
        video,
        value: resolved.value,
        publishedAt,
      };
    })
    .filter((item): item is DownfallIndexVideoSample<TVideo> => Boolean(item));
}

export function buildDownfallIndexHistory<TVideo extends DownfallIndexVideoInput>(
  samples: Array<DownfallIndexVideoSample<TVideo>>,
  baseline: DownfallIndexHistoryEntry[] = DOWNFALL_INDEX_BASELINE_HISTORY
) {
  const byPrice = new Map<string, DownfallIndexHistoryEntry>();
  for (const point of baseline) {
    byPrice.set(Number(point.price).toFixed(2), point);
  }
  for (const sample of samples) {
    const price = Number(sample.value);
    if (Number.isFinite(price) && sample.publishedAt) {
      byPrice.set(price.toFixed(2), { date: sample.publishedAt, price });
    }
  }

  return [...byPrice.values()].sort((a, b) => getTime(a.date) - getTime(b.date));
}

export function filterRecentDownfallIndexHistory(
  history: Array<{ date: string; price: number | null | undefined }>,
  years: number,
  now = Date.now()
) {
  const cutoff = now - Math.max(0, years) * 365 * 24 * 60 * 60 * 1000;
  return history.filter((entry): entry is DownfallIndexHistoryEntry => {
    if (typeof entry.price !== "number" || !Number.isFinite(entry.price)) return false;
    const time = getTime(entry.date);
    return time >= cutoff && time <= now;
  });
}

function normalizeDigits(value: string) {
  return value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

function formatDownfallIndex(value: string) {
  return Number(value).toFixed(2);
}

function isPlausibleDownfallIndex(raw: string, nextText = "") {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1 || value > 100) return false;
  if (/^[月日號号年]/.test(nextText)) return false;
  if (value >= 40) return true;
  return raw.includes(".");
}

function extractYoutubeVideoId(url: string) {
  return url.match(/[?&]v=([\w-]{11})/)?.[1] || url.match(/youtu\.be\/([\w-]{11})/)?.[1] || "";
}

function getTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}
