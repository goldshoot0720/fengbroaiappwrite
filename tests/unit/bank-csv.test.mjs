import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BANK_CSV_HEADERS,
  parseBankCsv,
  toBankCsvRow,
} from "../../lib/bankCsv.ts";
import { classifyBankRecord } from "../../lib/bankClassification.ts";

const sample = {
  $id: "doc1",
  name: "台北富邦",
  deposit: 1000,
  site: "https://example.com",
  address: "台北市",
  withdrawals: 5,
  transfer: 3,
  activity: "",
  card: "末四碼 1234",
  account: "user01",
  note: "第一行\n第二行, 含逗號",
  category: "points",
  expiry: "2027-02-07T00:00:00.000Z",
};

describe("bank CSV", () => {
  it("round-trips multi-line notes, category and expiry", () => {
    const csv = [BANK_CSV_HEADERS.join(","), toBankCsvRow(sample)].join("\n");
    const { data, errors } = parseBankCsv(csv);

    assert.deepEqual(errors, []);
    assert.equal(data.length, 1);
    assert.equal(data[0].note, "第一行\n第二行, 含逗號");
    assert.equal(data[0].category, "points");
    assert.equal(data[0].expiry, "2027-02-07");
  });

  it("accepts older backups whose header stops before the newer columns", () => {
    const headers = BANK_CSV_HEADERS.slice(0, 9).join(",");
    const csv = `${headers}\n中華郵政,500,,,0,0,,,user02`;
    const { data, errors } = parseBankCsv(csv);

    assert.deepEqual(errors, []);
    assert.equal(data[0].name, "中華郵政");
    assert.equal(data[0].note, "");
    assert.equal(data[0].category, "");
    assert.equal(data[0].expiry, "");
  });

  it("accepts the Supabase app's Chinese headers", () => {
    const csv = [
      '"銀行名稱","存款","帳號","卡號","分行/網點","地址","提款","轉帳","活動/備註"',
      '"玉山銀行","36","末五碼 12345","金融卡","https://www.esunbank.com","","1","2","https://event.example.com"',
    ].join("\n");
    const { data, errors } = parseBankCsv(csv);

    assert.deepEqual(errors, []);
    assert.equal(data[0].name, "玉山銀行");
    assert.equal(data[0].deposit, 36);
    assert.equal(data[0].account, "末五碼 12345");
    assert.equal(data[0].card, "金融卡");
    assert.equal(data[0].site, "https://www.esunbank.com");
    assert.equal(data[0].withdrawals, 1);
    assert.equal(data[0].transfer, 2);
    assert.equal(data[0].activity, "https://event.example.com");
    assert.equal(data[0].note, "");
  });

  it("rejects a header that is not a prefix of the current columns", () => {
    const { errors } = parseBankCsv("name,deposit,site,bogus\nA,1,,x");
    assert.ok(errors.length > 0);
  });
});

describe("bank classification", () => {
  it("prefers an explicit category over the name keywords", () => {
    assert.equal(classifyBankRecord({ name: "玉山銀行", category: "points" }), "points");
    assert.equal(classifyBankRecord({ name: "玉山銀行" }), "bank");
  });
});
