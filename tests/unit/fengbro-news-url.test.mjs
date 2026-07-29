/**
 * Unit tests: URL helpers and article URL heuristics.
 * Run: node --test tests/unit/fengbro-news-*.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const urlMod = pathToFileURL(path.join(root, "lib/fengbroNews/url.ts")).href;
const googleUrl = pathToFileURL(path.join(root, "lib/fengbroNews/googleNews.ts")).href;

const {
  absoluteUrl,
  canonicalizeUrl,
  hostMatchesDomain,
  isJunkNewsUrl,
  isLikelyArticleUrl,
} = await import(urlMod);

const { prefersGoogleNewsFirst } = await import(googleUrl);

describe("absoluteUrl / canonicalizeUrl", () => {
  it("resolves relative href against base", () => {
    assert.equal(
      absoluteUrl("https://example.com/a/", "b.html"),
      "https://example.com/a/b.html"
    );
  });

  it("canonicalizes traffic bureau deep links", () => {
    const raw =
      "https://traffic.tycg.gov.tw/businessd/post/upt.aspx?p0=106052&foo=1&con=1#top";
    const out = canonicalizeUrl(raw);
    assert.ok(out.includes("p0=106052"));
    assert.ok(out.includes("con=1"));
    assert.ok(!out.includes("foo=1"));
    assert.ok(!out.includes("#"));
  });

  it("canonicalizes zhongli news content params", () => {
    const raw =
      "https://www.zhongli.tycg.gov.tw/News_Content.aspx?n=5605&sms=10728&s=1616891&x=1";
    const out = canonicalizeUrl(raw);
    assert.ok(out.includes("s=1616891"));
    assert.ok(out.includes("n=5605"));
    assert.ok(!out.includes("x=1"));
  });
});

describe("hostMatchesDomain", () => {
  it("matches same host and subdomain roots", () => {
    assert.equal(hostMatchesDomain("https://search.ltn.com.tw/list", "ltn.com.tw"), true);
    assert.equal(hostMatchesDomain("https://www.ltn.com.tw/news/1", "ltn.com.tw"), true);
    assert.equal(hostMatchesDomain("https://evil.com/", "ltn.com.tw"), false);
  });
});

describe("isJunkNewsUrl / isLikelyArticleUrl", () => {
  it("rejects ad and root paths", () => {
    assert.equal(isJunkNewsUrl("https://www.example.com/"), true);
    assert.equal(isJunkNewsUrl("javascript:void(0)"), true);
  });

  it("accepts PTT article paths", () => {
    const url = "https://www.ptt.cc/bbs/Railway/M.1717200000.A.ABC.html";
    assert.equal(isLikelyArticleUrl(url, "ptt.cc"), true);
  });

  it("rejects UDN category indexes", () => {
    assert.equal(isJunkNewsUrl("https://udn.com/news/cate/2/6638"), true);
  });
});

describe("prefersGoogleNewsFirst", () => {
  it("flags known bot-walled hosts", () => {
    assert.equal(prefersGoogleNewsFirst("chinatimes.com"), true);
    assert.equal(prefersGoogleNewsFirst("www.udn.com"), true);
    assert.equal(prefersGoogleNewsFirst("storm.mg"), true);
    assert.equal(prefersGoogleNewsFirst("traffic.tycg.gov.tw"), false);
  });
});
