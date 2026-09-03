import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displaySiteVisitStreak,
  nextSiteVisitStreak,
  toVisitDateKey,
} from "../../lib/siteVisitStreak.ts";

describe("toVisitDateKey", () => {
  it("keeps YYYY-MM-DD keys", () => {
    assert.equal(toVisitDateKey("2026-09-03"), "2026-09-03");
  });

  it("converts UTC timestamps to Taipei calendar dates", () => {
    // 2026-09-02 16:00 UTC = 2026-09-03 00:00 Taipei
    assert.equal(toVisitDateKey("2026-09-02T16:00:00.000Z"), "2026-09-03");
  });
});

describe("nextSiteVisitStreak", () => {
  const now = new Date("2026-09-03T04:00:00.000Z"); // 12:00 Taipei

  it("starts at 1 on the first visit", () => {
    const result = nextSiteVisitStreak({ now });
    assert.equal(result.today, "2026-09-03");
    assert.equal(result.currentStreak, 1);
  });

  it("keeps the streak on a second session the same day", () => {
    const result = nextSiteVisitStreak({
      lastVisitDate: "2026-09-03",
      currentStreak: 4,
      now,
    });
    assert.equal(result.currentStreak, 4);
  });

  it("increments when the last visit was yesterday", () => {
    const result = nextSiteVisitStreak({
      lastVisitDate: "2026-09-02",
      currentStreak: 4,
      now,
    });
    assert.equal(result.currentStreak, 5);
  });

  it("resets after a gap", () => {
    const result = nextSiteVisitStreak({
      lastVisitDate: "2026-08-30",
      currentStreak: 12,
      now,
    });
    assert.equal(result.currentStreak, 1);
  });

  it("bootstraps from lastVisitAt when lastVisitDate is missing", () => {
    const result = nextSiteVisitStreak({
      lastVisitAt: "2026-09-02T15:30:00.000Z",
      currentStreak: 0,
      now,
    });
    assert.equal(result.currentStreak, 2);
  });
});

describe("displaySiteVisitStreak", () => {
  const now = new Date("2026-09-03T04:00:00.000Z");

  it("shows the stored streak if last visit was today or yesterday", () => {
    assert.equal(
      displaySiteVisitStreak({ lastVisitDate: "2026-09-03", currentStreak: 6, now }),
      6
    );
    assert.equal(
      displaySiteVisitStreak({ lastVisitDate: "2026-09-02", currentStreak: 6, now }),
      6
    );
  });

  it("shows 0 after a missed day", () => {
    assert.equal(
      displaySiteVisitStreak({ lastVisitDate: "2026-09-01", currentStreak: 6, now }),
      0
    );
  });

  it("shows 1 when last visit is recent but streak was never stored", () => {
    assert.equal(
      displaySiteVisitStreak({ lastVisitDate: "2026-09-03", currentStreak: 0, now }),
      1
    );
  });
});
