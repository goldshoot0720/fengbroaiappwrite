import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  readStoredCommandCodeCredential,
  serializeCommandCodeCredential,
} from "../../lib/commandCodeSession.ts";
import {
  normalizeCommandCodeUsage,
  toCommandCodeQuotaFields,
} from "../../lib/commandCodeUsage.ts";

const authFile = JSON.stringify({
  apiKey: "cmd-test-key",
  userId: "user-123",
  userName: "goldshoot0720",
  keyName: "desktop-cli",
  authenticatedAt: "2026-09-06T08:00:00.000Z",
});

describe("Command Code credential", () => {
  it("reads the raw CLI auth.json and persists only the fields needed for usage", () => {
    const credential = readStoredCommandCodeCredential(authFile);
    assert.deepEqual(credential, {
      apiKey: "cmd-test-key",
      userId: "user-123",
      userName: "goldshoot0720",
      keyName: "desktop-cli",
      authenticatedAt: "2026-09-06T08:00:00.000Z",
    });
    assert.deepEqual(JSON.parse(serializeCommandCodeCredential(credential)), {
      commandCode: credential,
    });
  });

  it("does not mistake arbitrary JSON for a Command Code credential", () => {
    assert.equal(readStoredCommandCodeCredential('{"accessToken":"eyJ..."}'), null);
    assert.equal(readStoredCommandCodeCredential('{"apiKey":"cmd-test-key"}'), null);
  });
});

describe("Command Code usage", () => {
  it("maps the 5-hour, weekly, and monthly meters into remaining quota fields", () => {
    const snapshot = normalizeCommandCodeUsage(
      {
        credits: {
          credits: {
            planId: "individual-pro",
            monthlyCredits: 15,
            purchasedCredits: 0,
            freeCredits: 0,
          },
          windowLimits: {
            limited: true,
            fiveHour: { used: 0, cap: 16, resetAt: "2026-09-06T18:00:00.000Z" },
            weekly: { used: 40, cap: 40, resetAt: "2026-09-08T18:00:00.000Z" },
          },
        },
        subscription: {
          data: {
            planId: "individual-pro",
            status: "active",
            currentPeriodEnd: "2026-10-02T00:00:00.000Z",
          },
        },
      },
      "https://api.commandcode.ai/alpha",
    );

    assert.deepEqual(
      snapshot.windows.map((window) => [window.key, window.usedPercent, window.remainingPercent]),
      [
        ["fiveHour", 0, 100],
        ["weekly", 100, 0],
      ],
    );
    assert.equal(snapshot.monthly?.usedPercent, 50);
    assert.equal(snapshot.monthly?.remainingPercent, 50);
    assert.deepEqual(toCommandCodeQuotaFields(snapshot, "UTC"), {
      ratio5h: 100,
      expiry5h: "18:00",
      ratioWeek: 0,
      expiryWeek: "2026-09-08",
      ratioMonth: 50,
      expiryMonth: "2026-10-02",
    });
  });

  it("leaves unrecognised response fields unset instead of writing a false zero", () => {
    const fields = toCommandCodeQuotaFields(
      normalizeCommandCodeUsage({ credits: {}, subscription: {} }, "test"),
      "UTC",
    );
    assert.deepEqual(fields, {
      ratio5h: null,
      expiry5h: null,
      ratioWeek: null,
      expiryWeek: null,
      ratioMonth: null,
      expiryMonth: null,
    });
  });
});
