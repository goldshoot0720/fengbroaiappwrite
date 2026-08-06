/**
 * 鋒兄金融 CSV ↔ Appwrite Storage image URLs round-trip.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalizeFinanceImageUrl,
  normalizeFinanceImageUrls,
  unwrapFinanceMediaProxyUrl,
} from "../../lib/fengbroFinanceCustom.ts";
import {
  buildFinanceCustomCsv,
  imageUrlsToCsvCell,
  parseFinanceCustomCsv,
} from "../../lib/fengbroFinanceCsv.ts";

const APPWRITE_A =
  "https://cloud.appwrite.io/v1/storage/buckets/bucket1/files/fileA/view?project=proj1";
const APPWRITE_B =
  "https://fra.cloud.appwrite.io/v1/storage/buckets/my-bucket/files/fileBxyz/view?project=myproj&mode=admin";

describe("finance image URL canonicalize (Appwrite)", () => {
  it("keeps full Appwrite Storage view URLs", () => {
    assert.equal(canonicalizeFinanceImageUrl(APPWRITE_A), APPWRITE_A);
    assert.equal(canonicalizeFinanceImageUrl(APPWRITE_B), APPWRITE_B);
  });

  it("unwraps media-proxy to original storage URL (no API key in result)", () => {
    const proxied = `/api/media-proxy?url=${encodeURIComponent(APPWRITE_A)}&_key=super-secret-key&_project=proj1`;
    assert.equal(unwrapFinanceMediaProxyUrl(proxied), APPWRITE_A);
    assert.equal(canonicalizeFinanceImageUrl(proxied), APPWRITE_A);
    assert.ok(!canonicalizeFinanceImageUrl(proxied)?.includes("super-secret"));
  });

  it("parses multi-value cells with semicolon without mangling query strings", () => {
    const urls = normalizeFinanceImageUrls(`${APPWRITE_A};${APPWRITE_B}`);
    assert.deepEqual(urls, [APPWRITE_A, APPWRITE_B]);
  });

  it("does not split a single Appwrite URL on punctuation", () => {
    const urls = normalizeFinanceImageUrls(APPWRITE_B);
    assert.deepEqual(urls, [APPWRITE_B]);
  });
});

describe("finance CSV imageUrls column", () => {
  it("exports Appwrite Storage URLs in imageUrls and re-imports them", () => {
    const instruments = [
      {
        name: "KOSPI 測試",
        symbol: "^KS11",
        provider: "yahoo",
        group: "korea",
        imageUrl: APPWRITE_A,
        imageUrls: [APPWRITE_A, APPWRITE_B],
        featured: true,
      },
    ];

    const csv = buildFinanceCustomCsv(instruments);
    assert.ok(csv.includes("imageUrls"));
    assert.ok(csv.includes("storage/buckets/"));
    assert.ok(csv.includes(APPWRITE_A));
    assert.ok(csv.includes(APPWRITE_B));
    // multi-value should be quoted for Excel safety
    assert.match(csv, /"https:\/\/cloud\.appwrite\.io[^"]+;https:\/\/fra\.cloud\.appwrite\.io[^"]+"/);

    const { data, errors } = parseFinanceCustomCsv(csv);
    assert.equal(errors.length, 0, errors.join("; "));
    assert.equal(data.length, 1);
    assert.deepEqual(data[0].imageUrls, [APPWRITE_A, APPWRITE_B]);
    assert.equal(data[0].imageUrl, APPWRITE_A);
    assert.equal(data[0].featured, true);
  });

  it("imports imageUrls that were media-proxy links as clean storage URLs", () => {
    const proxied = `/api/media-proxy?url=${encodeURIComponent(APPWRITE_A)}&_key=secret`;
    const csv = [
      "name,symbol,provider,group,imageUrls,youtubeUrl,bilibiliUrl,relatedLinks,featured",
      `TSMC,2330.TW,yahoo,taiwan,"${proxied}",,,,0`,
    ].join("\n");

    const { data, errors } = parseFinanceCustomCsv(csv);
    assert.equal(errors.length, 0, errors.join("; "));
    assert.equal(data.length, 1);
    assert.deepEqual(data[0].imageUrls, [APPWRITE_A]);
  });

  it("imageUrlsToCsvCell joins with semicolon", () => {
    const cell = imageUrlsToCsvCell({
      name: "x",
      symbol: "X",
      provider: "yahoo",
      group: "us",
      imageUrls: [APPWRITE_A, APPWRITE_B],
    });
    assert.equal(cell, `${APPWRITE_A};${APPWRITE_B}`);
  });
});
