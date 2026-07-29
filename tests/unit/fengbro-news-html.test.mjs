/**
 * Unit tests: title matching / junk title heuristics.
 * Run: node --test tests/unit/fengbro-news-*.test.mjs
 *
 * Uses dynamic import of TypeScript sources via experimental strip-types.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const htmlUrl = pathToFileURL(path.join(root, "lib/fengbroNews/html.ts")).href;

const { titleMatches, isJunkNewsTitle, normalizeSpace, stripTags, decodeHtml } = await import(
  htmlUrl
);

describe("titleMatches", () => {
  it("matches when all space-separated tokens appear", () => {
    assert.equal(titleMatches("桃園中新地下道施工進度", "中新地下道"), true);
    assert.equal(titleMatches("中新地下道 與 鐵路", "中新地下道 鐵路"), true);
  });

  it("is case-insensitive for latin tokens", () => {
    assert.equal(titleMatches("TRA Railway Update", "railway"), true);
  });

  it("rejects partial missing tokens", () => {
    assert.equal(titleMatches("桃園捷運工程", "中新地下道"), false);
    assert.equal(titleMatches("中新 工程", "中新地下道"), false);
  });

  it("empty query matches all titles", () => {
    assert.equal(titleMatches("任意標題", ""), true);
  });
});

describe("isJunkNewsTitle", () => {
  it("rejects short / nav chrome", () => {
    assert.equal(isJunkNewsTitle("首頁"), true);
    assert.equal(isJunkNewsTitle("下一頁"), true);
    assert.equal(isJunkNewsTitle("ab"), true);
  });

  it("rejects ad / tracker noise", () => {
    assert.equal(isJunkNewsTitle("googletag.defineSlot prebid bidder"), true);
  });

  it("accepts real CJK headlines", () => {
    assert.equal(isJunkNewsTitle("中壢中新地下道施工進度更新說明"), false);
  });
});

describe("html helpers", () => {
  it("decodeHtml and stripTags", () => {
    assert.equal(decodeHtml("A&amp;B&nbsp;C"), "A&B C");
    // stripTags replaces tags with spaces then normalizes
    assert.equal(stripTags("<a href='x'>中新<strong>地下道</strong></a>"), "中新 地下道");
  });

  it("normalizeSpace collapses whitespace", () => {
    assert.equal(normalizeSpace("  a\n\tb  "), "a b");
  });
});
