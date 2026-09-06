# OiiOii remaining points source

Verified 2026-09-06 against [the requested run](https://github.com/huang1988pioneer/AutoSignOiiOii/actions/runs/34020086051), commit `d847204c26118545157f223a45b9099334477ddf`.

## Integration source

The repository has only a `main` branch at verification time; there is no public `results` branch. The [claim workflow](https://github.com/huang1988pioneer/AutoSignOiiOii/blob/d847204c26118545157f223a45b9099334477ddf/.github/workflows/claim-oiioii-lunch.yml) uploads artifact `oiioii-claim-report`, retained for 30 days. Its ZIP root contains `oiioii-daily-summary.json` and `oiioii-daily-summary.md`. Use GitHub REST to find recent completed runs of `claim-oiioii-lunch.yml`, list their artifacts, and download the latest nonexpired report. Keep authentication server-side.

The [actual report artifact](https://github.com/huang1988pioneer/AutoSignOiiOii/actions/runs/34020086051/artifacts/9985213568) was downloaded and inspected. JSON has `{ generatedAt, counts, sessions, rows }`. Each result has `account` (numeric slot), `name` (account name), `status`, `currentPoints`, and `finishedAt`. Match application account names against `name`, not numeric `account`. Prefer `finishedAt` for measurement time, with `generatedAt` as a report-time fallback. The [summary generator](https://github.com/huang1988pioneer/AutoSignOiiOii/blob/d847204c26118545157f223a45b9099334477ddf/scripts/summarize-claim-results.mjs) accepts only finite nonnegative numeric points for display; unavailable points are not zero.

Verified report examples:

| Slot | Name | Status | currentPoints | finishedAt (UTC) |
| --- | --- | --- | ---: | --- |
| 1 | huang1988pioneer | checked_in | 1 | 2026-09-06T07:48:32.468Z |
| 2 | abuhg17 | checked_in | 40 | 2026-09-06T07:48:29.170Z |
| 3 | goldshoot0720 | checked_in | 55 | 2026-09-06T07:49:11.559Z |

`checked_in` means claimed during the run or already claimed that day; `failed` means a session/claim issue; `skipped` means no configured login secret. For synchronization, use successful rows with valid numeric `currentPoints`; preserve prior application values for unavailable/failed/skipped accounts. The [claim script](https://github.com/huang1988pioneer/AutoSignOiiOii/blob/d847204c26118545157f223a45b9099334477ddf/scripts/claim-lunch.mjs) reads the points after claim handling and writes `finishedAt`. Its [points reader](https://github.com/huang1988pioneer/AutoSignOiiOii/blob/d847204c26118545157f223a45b9099334477ddf/scripts/current-points.mjs) is the upstream measurement implementation.

## Access checks

Authenticated REST inspection of [the summary check run](https://api.github.com/repos/huang1988pioneer/AutoSignOiiOii/check-runs/101451165742) returned null `output.summary`, `output.text`, and `output.title`: GitHub job summaries are not available through those fields. An unauthenticated request to its job-log download endpoint returned HTTP 403. Authenticated artifact download succeeded. Therefore a server-side GitHub token with appropriate repository Actions read access is necessary for the tested integration route; do not assume a public raw JSON URL exists or expose the token to clients.
