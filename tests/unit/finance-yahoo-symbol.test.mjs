import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveYahooChartSymbol } from "../../lib/fengbroFinanceCustom.ts";

describe("resolveYahooChartSymbol", () => {
  it("turns CNBC leading-dot index codes into Yahoo caret codes", () => {
    // CNBC 的 .SOX／.KS11／.N225 直接丟給 Yahoo 會 404，走勢圖與 26 週波段都是空的。
    assert.equal(resolveYahooChartSymbol(".SOX"), "^SOX");
    assert.equal(resolveYahooChartSymbol(".KS11"), "^KS11");
    assert.equal(resolveYahooChartSymbol(".N225"), "^N225");
    assert.equal(resolveYahooChartSymbol(".DJI"), "^DJI");
  });

  it("uses the Yahoo symbol where the two differ", () => {
    assert.equal(resolveYahooChartSymbol(".SPX"), "^GSPC");
    assert.equal(resolveYahooChartSymbol(".COMP"), "^IXIC");
  });

  it("keeps Japan local index codes working", () => {
    assert.equal(resolveYahooChartSymbol("998407.O"), "^N225");
  });

  it("maps CNBC crypto codes to Yahoo crypto pairs", () => {
    // BTC.CM= 直接查 Yahoo 會 404，26 週高低因此永遠是「--」。
    assert.equal(resolveYahooChartSymbol("BTC.CM="), "BTC-USD");
    assert.equal(resolveYahooChartSymbol("ETH.CM="), "ETH-USD");
    assert.equal(resolveYahooChartSymbol("SOL.CM="), "SOL-USD");
  });

  it("maps CNBC commodity codes to Yahoo futures", () => {
    assert.equal(resolveYahooChartSymbol("@LCO.1"), "BZ=F");
    assert.equal(resolveYahooChartSymbol("@CL.1"), "CL=F");
    assert.equal(resolveYahooChartSymbol("@GC.1"), "GC=F");
    assert.equal(resolveYahooChartSymbol("@SI.1"), "SI=F");
  });

  it("leaves ordinary tickers untouched", () => {
    assert.equal(resolveYahooChartSymbol("AAPL"), "AAPL");
    assert.equal(resolveYahooChartSymbol("2330.TW"), "2330.TW");
    assert.equal(resolveYahooChartSymbol("^N225"), "^N225");
  });

  it("normalizes case and whitespace", () => {
    assert.equal(resolveYahooChartSymbol(" .sox "), "^SOX");
    assert.equal(resolveYahooChartSymbol(""), "");
  });
});
