import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatYyymmLabel,
  formatYyyLabel,
} from "../../lib/fengbroNews/population.ts";

describe("fengbro news population helpers", () => {
  it("formats ROC year-month labels", () => {
    assert.equal(formatYyymmLabel("11506"), "115年6月");
    assert.equal(formatYyymmLabel("11412"), "114年12月");
  });

  it("formats year-end labels", () => {
    assert.equal(formatYyyLabel("114"), "114年底");
    assert.equal(formatYyyLabel("106"), "106年底");
  });
});
