import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getFinanceIndexEmoji, isFinanceIndex } from "../../lib/financeIndexIcon.ts";

describe("isFinanceIndex", () => {
  it("recognises known index symbols on both providers", () => {
    assert.equal(isFinanceIndex({ symbol: ".SOX" }), true);
    assert.equal(isFinanceIndex({ symbol: "^N225" }), true);
  });

  it("recognises anything named 指數 or Index", () => {
    assert.equal(isFinanceIndex({ symbol: "ABC", name: "費城半導體指數" }), true);
    assert.equal(isFinanceIndex({ symbol: "ABC", displayName: "MSCI World Index" }), true);
  });

  it("leaves individual stocks alone", () => {
    assert.equal(isFinanceIndex({ symbol: "2330.TW", name: "台積電" }), false);
    assert.equal(isFinanceIndex({ symbol: "AAPL", name: "蘋果" }), false);
    assert.equal(isFinanceIndex({}), false);
  });
});

describe("getFinanceIndexEmoji", () => {
  it("gives each well-known index its own icon", () => {
    assert.equal(getFinanceIndexEmoji({ symbol: ".SOX" }), "💾");
    assert.equal(getFinanceIndexEmoji({ symbol: ".KS11" }), "🐯");
    assert.equal(getFinanceIndexEmoji({ symbol: ".N225" }), "🗻");
    assert.equal(getFinanceIndexEmoji({ symbol: "^GSPC" }), "🦅");
    assert.equal(getFinanceIndexEmoji({ symbol: "998407.O" }), "🗻");
  });

  it("falls back to the name when the symbol is unfamiliar", () => {
    assert.equal(getFinanceIndexEmoji({ symbol: "XYZ", name: "韓國綜合指數" }), "🐯");
    assert.equal(getFinanceIndexEmoji({ symbol: "XYZ", name: "Nasdaq Composite" }), "🚀");
  });

  it("uses a generic chart icon for an unknown index", () => {
    assert.equal(getFinanceIndexEmoji({ symbol: "XYZ", name: "MSCI World Index" }), "📈");
  });

  it("returns nothing for stocks", () => {
    assert.equal(getFinanceIndexEmoji({ symbol: "2330.TW", name: "台積電" }), "");
  });

  it("normalizes case and whitespace", () => {
    assert.equal(getFinanceIndexEmoji({ symbol: " .sox " }), "💾");
  });
});
