import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REINSTALL_CSV_HEADERS,
  buildReinstallCsv,
  parseReinstallCsv,
  reinstallImportKey,
} from "../../lib/reinstallCsv.ts";

const sample = {
  $id: "doc1",
  name: "Adobe Acrobat",
  system: "win",
  softwareType: "paid",
  licenseType: "paid_serial",
  serial: "AAAA-BBBB,CCCC",
  viewPassword: "secret",
  subscriptionSoftware: true,
  subscriptionPeriod: "1年",
  subscriptionPrice: 990,
  subscriptionCurrency: "USD",
  site: "https://example.test/acrobat",
  note: "主機, 含逗號",
};

describe("reinstall CSV", () => {
  it("exports the twelve Appwrite fields and round-trips quoted notes and serials", () => {
    assert.deepEqual(REINSTALL_CSV_HEADERS, [
      "name",
      "system",
      "softwareType",
      "licenseType",
      "serial",
      "viewPassword",
      "subscriptionSoftware",
      "subscriptionPeriod",
      "subscriptionPrice",
      "subscriptionCurrency",
      "site",
      "note",
    ]);

    const csv = buildReinstallCsv([sample]);
    assert.match(csv, /^name,system,softwareType,licenseType,serial,viewPassword,subscriptionSoftware,subscriptionPeriod,subscriptionPrice,subscriptionCurrency,site,note\n/);
    assert.match(csv, /"AAAA-BBBB,CCCC"/);
    assert.match(csv, /"主機, 含逗號"/);

    const { data, errors } = parseReinstallCsv(`\uFEFF${csv}`);
    assert.deepEqual(errors, []);
    assert.deepEqual(data, [
      {
        name: "Adobe Acrobat",
        system: "win",
        softwareType: "paid",
        licenseType: "paid_serial",
        serial: "AAAA-BBBB,CCCC",
        viewPassword: "secret",
        subscriptionSoftware: true,
        subscriptionPeriodCount: 1,
        subscriptionPeriodUnit: "year",
        subscriptionPrice: 990,
        subscriptionCurrency: "USD",
        site: "https://example.test/acrobat",
        note: "主機, 含逗號",
      },
    ]);
  });

  it("accepts Chinese headers and labels, and matches 服務×系統", () => {
    const csv = [
      "服務名稱,使用系統,軟體類型,授權方式,訂閱制軟體,訂閱週期,訂閱費用,幣別,備註",
      " 7-Zip ,Windows,免費軟體,無序號,否,,,台幣,壓縮",
    ].join("\n");

    const { data, errors } = parseReinstallCsv(csv);
    assert.deepEqual(errors, []);
    assert.equal(data[0].system, "win");
    assert.equal(data[0].softwareType, "free");
    assert.equal(data[0].licenseType, "none");
    assert.equal(data[0].subscriptionSoftware, false);
    assert.equal(
      reinstallImportKey(data[0]),
      reinstallImportKey({ name: "7-zip", system: "win" }),
    );
  });

  it("skips invalid rows and requires a service name", () => {
    const csv = [
      REINSTALL_CSV_HEADERS.join(","),
      ",win,free,none,,,,,,,",
      "工具,linux,free,none,,,,,,,",
      "工具,win,unknown,none,,,,,,,",
      "工具,win,free,maybe,,,,,,,",
      "工具,win,paid,none,,,,,,,javascript:alert(1),",
      "訂閱,win,paid,none,, ,true,一年,0,USD,,",
    ].join("\n");

    const { data, errors } = parseReinstallCsv(csv);
    assert.equal(data.length, 0);
    assert.ok(errors.some((error) => error.includes("name")));
    assert.ok(errors.some((error) => error.includes("使用系統")));
    assert.ok(errors.some((error) => error.includes("軟體類型")));
    assert.ok(errors.some((error) => error.includes("授權方式")));
    assert.ok(errors.some((error) => error.includes("網址") || error.includes("http")));
    assert.ok(errors.some((error) => error.includes("訂閱週期")));
  });

  it("fills defaults when optional columns are omitted", () => {
    const { data, errors } = parseReinstallCsv("name\n7-Zip");
    assert.deepEqual(errors, []);
    assert.deepEqual(data, [
      {
        name: "7-Zip",
        system: "win",
        softwareType: "free",
        licenseType: "none",
        serial: "",
        viewPassword: "",
        subscriptionSoftware: false,
        subscriptionPeriodCount: 1,
        subscriptionPeriodUnit: "month",
        subscriptionPrice: 0,
        subscriptionCurrency: "TWD",
        site: "",
        note: "",
      },
    ]);
  });
});
