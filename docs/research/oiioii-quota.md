# OiiOii remaining points source

Verified 2026-09-06: use the public [result/streaks.json](https://github.com/huang1988pioneer/AutoSignOiiOii/blob/result/streaks.json), fetched through raw.githubusercontent.com. No GitHub token is required. This replaces the previous authenticated Actions artifact integration.

The JSON contains `generatedAt` and `accounts`. Each account has numeric `account`, `name`, `status`, `currentPoints`, `remainingCredits`, and `finishedAt`. Match the quota account by exact name (case insensitive) or numeric slot. Read `currentPoints`, falling back to `remainingCredits` when absent. Only successful `checked_in` entries with finite nonnegative numeric points can update the quota. Zero is valid; missing or failed measurements preserve existing values. Use `finishedAt`, with `generatedAt` as fallback, and preserve newer stored measurements.

The observed report at 2026-09-06T08:07:49.467Z contains huang1988pioneer: 1, abuhg17: 12, goldshoot0720: 55. These are source observations, not hardcoded balances. The loader caches for 33 minutes; forced refresh bypasses that cache.
