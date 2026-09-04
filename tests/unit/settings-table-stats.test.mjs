import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { it } from "node:test";

it("database field stats do not offer per-table delete buttons", async () => {
  const source = await readFile(
    path.resolve(import.meta.dirname, "../../components/modules/SettingsManagement.tsx"),
    "utf8",
  );
  const statsStart = source.indexOf("資料庫欄位統計");
  const statsEnd = source.indexOf("資料庫資訊", statsStart);
  assert.ok(statsStart >= 0 && statsEnd > statsStart, "stats card bounds");
  const stats = source.slice(statsStart, statsEnd);
  assert.doesNotMatch(stats, />刪除</);
  assert.doesNotMatch(stats, /刪除重建/);
  assert.doesNotMatch(stats, /永久刪除整張 Table/);
});
