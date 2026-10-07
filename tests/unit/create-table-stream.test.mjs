import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { disconnectMessage, parseSseBuffer } from "../../lib/createTableStream.js";

describe("create-table stream", () => {
  it("keeps the server error that arrives after the 0/4 start frame", () => {
    const first = parseSseBuffer("", 'data: {"type":"start","tableName":"sitevisit","totalColumns":4}\n\n');
    const second = parseSseBuffer(
      first.rest,
      'data: {"type":"error","message":"欄位 count 建立失敗：Attribute not available"}\n\n',
    );
    assert.equal(first.events[0].totalColumns, 4);
    assert.equal(second.events[0].type, "error");
    assert.match(second.events[0].message, /count/);
    const shown = { isError: true, isComplete: false, message: `錯誤: ${second.events[0].message}` };
    assert.equal(disconnectMessage(shown), null);
  });

  it("names the last step when the socket dies at 0/4 before any column", () => {
    const progress = {
      isError: false,
      isComplete: false,
      percent: 0,
      message: "Creating sitevisit collection...",
    };
    assert.equal(disconnectMessage(progress), "連線中斷：Creating sitevisit collection...");
  });
});
