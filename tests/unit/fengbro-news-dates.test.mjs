/**
 * Unit tests: date parsing and max-age filter.
 * Run: node --test tests/unit/fengbro-news-*.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const datesUrl = pathToFileURL(path.join(root, "lib/fengbroNews/dates.ts")).href;

const {
  parseFlexibleDate,
  parseRocDate,
  filterArticlesByMaxAge,
  inferArticleDate,
  toIsoDate,
} = await import(datesUrl);

describe("parseRocDate / parseFlexibleDate", () => {
  it("parses ROC calendar to Gregorian", () => {
    const d = parseRocDate(115, 5, 5);
    assert.ok(d);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 4);
    assert.equal(d.getDate(), 5);
  });

  it("parses YYYY/MM/DD and ISO-ish strings", () => {
    const a = parseFlexibleDate("2024/08/18");
    assert.ok(a);
    assert.equal(a.getFullYear(), 2024);
    assert.equal(a.getMonth(), 7);
    assert.equal(a.getDate(), 18);

    const b = parseFlexibleDate("2024-05-01");
    assert.ok(b);
    assert.equal(b.getFullYear(), 2024);
  });

  it("parses ROC slash form 115/05/05", () => {
    const d = parseFlexibleDate("115/05/05");
    assert.ok(d);
    assert.equal(d.getFullYear(), 2026);
  });

  it("returns null for empty / garbage", () => {
    assert.equal(parseFlexibleDate(""), null);
    assert.equal(parseFlexibleDate("not-a-date"), null);
  });
});

describe("inferArticleDate", () => {
  it("reads publishedAt and PTT unix from URL", () => {
    const fromPub = inferArticleDate({
      title: "x",
      url: "https://example.com/a",
      publishedAt: "2024-06-01T00:00:00.000Z",
    });
    assert.ok(fromPub);
    assert.equal(fromPub.toISOString().slice(0, 10), "2024-06-01");

    const ptt = inferArticleDate({
      title: "標題",
      url: "https://www.ptt.cc/bbs/Railway/M.1717200000.A.ABC.html",
    });
    assert.ok(ptt);
    assert.equal(ptt.getTime(), 1717200000 * 1000);
  });
});

describe("filterArticlesByMaxAge", () => {
  const now = Date.parse("2026-07-01T00:00:00.000Z");

  it("keeps recent dated articles and drops old ones", () => {
    const kept = filterArticlesByMaxAge(
      [
        {
          title: "近期中新地下道消息報導全文",
          url: "https://www.ltn.com.tw/news/local/1234567",
          siteId: "ltn",
          siteName: "自由時報",
          domain: "ltn.com.tw",
          publishedAt: "2025-01-01T00:00:00.000Z",
        },
        {
          title: "很舊的中新地下道消息報導全文",
          url: "https://www.ltn.com.tw/news/local/9999999",
          siteId: "ltn",
          siteName: "自由時報",
          domain: "ltn.com.tw",
          publishedAt: "2019-01-01T00:00:00.000Z",
        },
      ],
      now
    );
    assert.equal(kept.length, 1);
    assert.match(kept[0].title, /近期/);
  });

  it("drops undated media hosts that require dates", () => {
    const kept = filterArticlesByMaxAge(
      [
        {
          title: "沒有日期的自由時報中新地下道標題",
          url: "https://news.ltn.com.tw/news/society/breakingnews/1",
          siteId: "ltn",
          siteName: "自由時報",
          domain: "ltn.com.tw",
        },
      ],
      now
    );
    assert.equal(kept.length, 0);
  });

  it("keeps undated gov-style hosts", () => {
    const kept = filterArticlesByMaxAge(
      [
        {
          title: "交通局中新地下道施工公告說明文件",
          url: "https://traffic.tycg.gov.tw/businessd/post/upt.aspx?p0=106052&con=1",
          siteId: "tycg-traffic",
          siteName: "桃園市政府交通局",
          domain: "traffic.tycg.gov.tw",
        },
      ],
      now
    );
    assert.equal(kept.length, 1);
  });

  it("toIsoDate formats valid dates", () => {
    const d = new Date(Date.UTC(2024, 0, 2, 12, 0, 0));
    assert.equal(toIsoDate(d)?.startsWith("2024-01-02"), true);
    assert.equal(toIsoDate(null), undefined);
  });
});
