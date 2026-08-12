import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GIBIBYTE,
  MEDIA_TRAFFIC_ALERT_STORAGE_KEY,
  claimMediaTrafficHomepageAlert,
  getMediaTrafficAlertPolicy,
} from "../../lib/mediaTrafficAlert.ts";

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

const today = new Date("2026-08-12T04:00:00.000Z");

describe("media traffic homepage alerts", () => {
  it("maps traffic thresholds to the requested daily display limits", () => {
    assert.equal(getMediaTrafficAlertPolicy(2.5 * GIBIBYTE), null);
    assert.deepEqual(getMediaTrafficAlertPolicy(2.5 * GIBIBYTE + 1), { thresholdGiB: 2.5, dailyLimit: 1 });
    assert.deepEqual(getMediaTrafficAlertPolicy(3.5 * GIBIBYTE + 1), { thresholdGiB: 3.5, dailyLimit: 2 });
    assert.deepEqual(getMediaTrafficAlertPolicy(4 * GIBIBYTE + 1), { thresholdGiB: 4, dailyLimit: 3 });
    assert.deepEqual(getMediaTrafficAlertPolicy(4.5 * GIBIBYTE + 1), { thresholdGiB: 4.5, dailyLimit: null });
  });

  it("limits reminders by the current level and resets on the next Taiwan day", () => {
    const storage = createStorage();
    const traffic = 4.1 * GIBIBYTE;

    assert.ok(claimMediaTrafficHomepageAlert(traffic, storage, today));
    assert.ok(claimMediaTrafficHomepageAlert(traffic, storage, today));
    assert.ok(claimMediaTrafficHomepageAlert(traffic, storage, today));
    assert.equal(claimMediaTrafficHomepageAlert(traffic, storage, today), null);
    assert.ok(claimMediaTrafficHomepageAlert(traffic, storage, new Date("2026-08-12T16:00:00.000Z")));
    assert.equal(JSON.parse(storage.getItem(MEDIA_TRAFFIC_ALERT_STORAGE_KEY)).displays, 1);
  });

  it("does not cap alerts above 4.5 GiB", () => {
    const storage = createStorage();
    const traffic = 4.6 * GIBIBYTE;

    for (let index = 0; index < 8; index += 1) {
      assert.ok(claimMediaTrafficHomepageAlert(traffic, storage, today));
    }
  });
});
