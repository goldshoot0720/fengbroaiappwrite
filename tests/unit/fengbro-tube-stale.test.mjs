/**
 * 鋒兄Tube 停更提示：超過三個月沒有新影片的頻道要被標記出來。
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FENGBRO_TUBE_STALE_DAYS,
  formatFengbroTubeStaleDuration,
  getFengbroTubeLatestPublishedAt,
  getFengbroTubeStaleDays,
  getStaleFengbroTubeChannels,
} from "../../lib/fengbroTubeStale.ts";

const NOW = Date.parse("2026-09-10T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days) {
  return new Date(NOW - days * DAY_MS).toISOString();
}

function channel(sourceUrl, title, publishedDates) {
  return {
    sourceUrl,
    title,
    videos: publishedDates.map((publishedAt, index) => ({ videoId: `v${index}`, publishedAt })),
  };
}

describe("fengbroTubeStale", () => {
  it("picks the newest video regardless of list order", () => {
    const target = channel("https://www.youtube.com/@a/videos", "A", [daysAgo(200), daysAgo(10), daysAgo(50)]);
    assert.equal(getFengbroTubeLatestPublishedAt(target), daysAgo(10));
    assert.equal(getFengbroTubeStaleDays(target, NOW), 10);
  });

  it("returns null when no video has a usable date", () => {
    assert.equal(getFengbroTubeStaleDays({ sourceUrl: "x", videos: [] }, NOW), null);
    assert.equal(getFengbroTubeStaleDays({ sourceUrl: "x", videos: [{ publishedAt: "" }] }, NOW), null);
    assert.equal(getFengbroTubeStaleDays({ sourceUrl: "x", videos: [{ publishedAt: "not-a-date" }] }, NOW), null);
  });

  it("treats future timestamps as 0 days instead of reporting a stale channel", () => {
    const future = { sourceUrl: "x", videos: [{ publishedAt: new Date(NOW + 5 * DAY_MS).toISOString() }] };
    assert.equal(getFengbroTubeStaleDays(future, NOW), 0);
    assert.deepEqual(getStaleFengbroTubeChannels([future], NOW), []);
  });

  it("flags only channels past the 90-day threshold, longest gap first", () => {
    const channels = [
      channel("https://www.youtube.com/@fresh/videos", "剛更新", [daysAgo(2)]),
      channel("https://www.youtube.com/@stale/videos", "停更四個月", [daysAgo(125)]),
      channel("https://www.youtube.com/@gone/videos", "停更兩年", [daysAgo(730)]),
      { sourceUrl: "https://www.youtube.com/@empty/videos", title: "抓不到影片", videos: [] },
    ];

    const stale = getStaleFengbroTubeChannels(channels, NOW);
    assert.deepEqual(
      stale.map((item) => [item.title, item.staleDays]),
      [["停更兩年", 730], ["停更四個月", 125]],
    );
    assert.equal(stale[0].latestPublishedAt, daysAgo(730));
  });

  it("keeps a channel sitting exactly on the threshold out of the warning", () => {
    const edge = channel("https://www.youtube.com/@edge/videos", "剛好 90 天", [daysAgo(FENGBRO_TUBE_STALE_DAYS)]);
    assert.deepEqual(getStaleFengbroTubeChannels([edge], NOW), []);
    assert.equal(getStaleFengbroTubeChannels([channel("u", "T", [daysAgo(91)])], NOW).length, 1);
  });

  it("falls back to the source url when a channel has no title", () => {
    const untitled = channel("https://www.youtube.com/@untitled/videos", "  ", [daysAgo(400)]);
    assert.equal(getStaleFengbroTubeChannels([untitled], NOW)[0].title, "https://www.youtube.com/@untitled/videos");
  });

  it("formats the gap in months and years", () => {
    assert.equal(formatFengbroTubeStaleDuration(95), "3 個月");
    assert.equal(formatFengbroTubeStaleDuration(91), "3 個月");
    assert.equal(formatFengbroTubeStaleDuration(365), "1 年");
    assert.equal(formatFengbroTubeStaleDuration(430), "1 年 2 個月");
    assert.equal(formatFengbroTubeStaleDuration(0), "1 個月");
  });
});
