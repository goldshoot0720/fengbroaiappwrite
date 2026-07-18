@AGENTS.md

## Agent skills

### Issue tracker

GitHub Issues on `goldshoot0720/fengbroaiappwrite` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five roles: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

### Git auto-ship

**Default for this repo:** after finishing meaningful code/docs work, agents **must auto-commit and auto-push** to the current branch (no extra user confirmation). Policy and helper: `docs/agents/git-auto-ship.md`, `node scripts/auto-ship.mjs "type(scope): summary"`. Still forbid force-push, hard reset, secret commits, and amending published history.
