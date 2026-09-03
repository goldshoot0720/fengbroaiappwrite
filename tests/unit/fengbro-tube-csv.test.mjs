/**
 * 鋒兄Tube CSV 匯入：已下架預設頻道要明確回報，不能靜默失敗。
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildFengbroTubeCsv,
  parseFengbroTubeCsv,
} from "../../lib/fengbroTubeCsv.ts";

describe("fengbroTubeCsv", () => {
  it("exports then re-imports a normal channel unchanged", () => {
    const channels = [{ alias: "ABC", sourceUrl: "https://www.youtube.com/@abc/videos" }];
    const result = parseFengbroTubeCsv(buildFengbroTubeCsv(channels));
    assert.deepEqual(result.data, channels);
    assert.deepEqual(result.errors, []);
  });

  it("reports removed default channels instead of silently returning empty data", () => {
    const csv = "alias,sourceUrl\n政經孫老師,https://www.youtube.com/@sunlao";
    const result = parseFengbroTubeCsv(csv);
    assert.deepEqual(result.data, []);
    assert.deepEqual(result.errors, ["略過已下架的預設頻道 1 個：@sunlao"]);
  });

  it("keeps valid channels and only reports the removed ones in warnings", () => {
    const csv = [
      "alias,sourceUrl",
      "正常頻道,https://www.youtube.com/@abc/videos",
      "政經孫老師,https://www.youtube.com/@sunlao",
    ].join("\n");
    const result = parseFengbroTubeCsv(csv);
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].sourceUrl, "https://www.youtube.com/@abc/videos");
    assert.deepEqual(result.errors, ["略過已下架的預設頻道 1 個：@sunlao"]);
  });

  it("does not report removed channels when the CSV has none", () => {
    const result = parseFengbroTubeCsv("alias,sourceUrl\n,https://www.youtube.com/@normal/videos");
    assert.equal(result.data.length, 1);
    assert.deepEqual(result.errors, []);
  });
});
