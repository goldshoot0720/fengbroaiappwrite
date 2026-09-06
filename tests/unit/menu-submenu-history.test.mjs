import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import { getLastSubmenu, rememberLastSubmenu } from "../../lib/menuSubmenuHistory.ts";

function memoryStore() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
  };
}

describe("每個分類記住的最後一個子選單", () => {
  before(() => {
    const localStorage = memoryStore();
    globalThis.localStorage = localStorage;
    globalThis.window = { localStorage };
  });

  afterEach(() => {
    globalThis.localStorage.clear();
  });

  it("沒記錄過回傳 undefined", () => {
    assert.equal(getLastSubmenu("daily-mgmt"), undefined);
  });

  it("記住之後可以讀回同一個分類的子選單", () => {
    rememberLastSubmenu("daily-mgmt", "quota");
    assert.equal(getLastSubmenu("daily-mgmt"), "quota");
  });

  it("不同分類的紀錄互不影響", () => {
    rememberLastSubmenu("daily-mgmt", "quota");
    rememberLastSubmenu("tools", "fengbro-tube");
    assert.equal(getLastSubmenu("daily-mgmt"), "quota");
    assert.equal(getLastSubmenu("tools"), "fengbro-tube");
  });

  it("同一分類再點別的子選單會覆蓋舊紀錄", () => {
    rememberLastSubmenu("daily-mgmt", "quota");
    rememberLastSubmenu("daily-mgmt", "subscription");
    assert.equal(getLastSubmenu("daily-mgmt"), "subscription");
  });

  it("localStorage 壞掉時安靜地當作沒記錄過", () => {
    const originalWindow = globalThis.window;
    globalThis.window = {
      get localStorage() {
        throw new Error("blocked");
      },
    };
    assert.doesNotThrow(() => rememberLastSubmenu("daily-mgmt", "quota"));
    assert.equal(getLastSubmenu("daily-mgmt"), undefined);
    globalThis.window = originalWindow;
  });
});
