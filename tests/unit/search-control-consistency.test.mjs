import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

async function readSource(...segments) {
  return readFile(path.join(root, ...segments), "utf8");
}

describe("shared search control consistency", () => {
  it("keeps the workbench shell on the canonical search control", async () => {
    const source = await readSource("components", "ui", "friendly-ai-crud-shell.tsx");

    assert.match(source, /import \{ RecentSearchInput \}/);
    assert.match(source, /<RecentSearchInput/);
    assert.doesNotMatch(source, /useRecentSearches/);
  });

  it("gives the canonical control submit, clear, and visible history behavior", async () => {
    const source = await readSource("components", "ui", "recent-search-input.tsx");

    assert.match(source, /onClearSearch\?: \(\) => void/);
    assert.match(source, /showRecentSearches\?: boolean/);
    assert.match(source, /aria-label="清除搜尋內容"/);
    assert.match(source, /aria-label="提交搜尋"/);
    assert.match(source, /event\.key === "Escape"/);
  });

  it("does not let account and notes pages render a second recent-search owner", async () => {
    const [accountsSource, notesSource] = await Promise.all([
      readSource("components", "modules", "CommonAccountManagement.tsx"),
      readSource("components", "modules", "NotesManagement.tsx"),
    ]);

    for (const source of [accountsSource, notesSource]) {
      assert.match(source, /<RecentSearchInput/);
      assert.doesNotMatch(source, /useRecentSearches/);
      assert.doesNotMatch(source, /recentSearches/);
    }
  });
});
