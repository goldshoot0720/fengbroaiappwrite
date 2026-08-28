import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const componentPath = path.resolve(
  import.meta.dirname,
  "../../components/modules/SubscriptionManagement.tsx",
);

test("similar-service buttons expose an explicit cancel state", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /const tooltip = isActive \? "取消相似服務" : "相似服務"/);
  assert.match(source, /title=\{tooltip\}/);
  assert.match(source, /className=\{`size-9 rounded-lg/);
  assert.doesNotMatch(source, /\{isActive \? "取消相似服務" : "相似服務"\}/);
  assert.match(source, /aria-pressed=\{isActive\}/);
  assert.match(source, /restoreSubscriptionSimilarityView\(activeSimilarityView\)/);
  assert.match(source, /activeSimilarityView\?\.sourceSubscriptionId === sub\.\$id/);
  assert.match(source, /title="編輯"/);
  assert.match(source, /title="複製"/);
});
