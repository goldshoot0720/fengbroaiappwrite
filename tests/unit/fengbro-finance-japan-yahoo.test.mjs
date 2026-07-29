/**
 * Japan Yahoo local index codes (finance.yahoo.co.jp) vs global chart API.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildYahooQuoteSourceUrl,
  getJapanYahooLocalDisplayName,
  guessFinanceGroup,
  isJapanYahooLocalIndexSymbol,
  isJapanYahooQuoteTarget,
  parseFinanceQuoteInput,
  resolveYahooChartSymbol,
} from "../../lib/fengbroFinanceCustom.ts";

describe("Japan Yahoo 998407.O (日経平均)", () => {
  it("maps local code to global chart symbol ^N225", () => {
    assert.equal(resolveYahooChartSymbol("998407.O"), "^N225");
    assert.equal(resolveYahooChartSymbol("998407.o"), "^N225");
    assert.equal(resolveYahooChartSymbol("^N225"), "^N225");
    assert.equal(resolveYahooChartSymbol("7203.T"), "7203.T");
  });

  it("identifies local index and display name", () => {
    assert.equal(isJapanYahooLocalIndexSymbol("998407.O"), true);
    assert.equal(isJapanYahooLocalIndexSymbol("7203.T"), false);
    assert.equal(getJapanYahooLocalDisplayName("998407.O"), "日経平均株価");
  });

  it("parses Japan Yahoo quote URL", () => {
    const parsed = parseFinanceQuoteInput(
      "https://finance.yahoo.co.jp/quote/998407.O"
    );
    assert.ok(parsed);
    assert.equal(parsed.symbol, "998407.O");
    assert.equal(parsed.provider, "yahoo");
    assert.equal(parsed.marketHint, "jp");
  });

  it("groups as japan and links to yahoo.co.jp", () => {
    assert.equal(guessFinanceGroup("998407.O"), "japan");
    assert.equal(isJapanYahooQuoteTarget("998407.O"), true);
    assert.equal(
      buildYahooQuoteSourceUrl("998407.O"),
      "https://finance.yahoo.co.jp/quote/998407.O"
    );
  });
});
