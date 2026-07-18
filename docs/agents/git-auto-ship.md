# Git auto-ship (commit + push)

## Policy

This repository **authorizes agents to automatically commit and push** after completing meaningful work.

When a coding task finishes with local changes:

1. Run `git status` / `git diff` / recent `git log` style check as usual.
2. Stage relevant files only (no secrets: `.env`, keys, credentials).
3. Create a commit with a clear conventional message (`feat|fix|docs|chore|refactor|style|test|perf`).
4. **Push to the current branch’s remote** (`git push -u origin HEAD` when needed).
5. Report the commit hash and push result in the reply.

Do **not** wait for a second “please push” message unless push fails or the user pauses shipping.

## Safety (still required)

- Never `git push --force` / `--force-with-lease` unless the user explicitly asks for that force.
- Never `git reset --hard`, `git clean -fd`, or amend commits already on the remote.
- Never commit secrets or large generated junk (`node_modules`, `.next`, binary dumps).
- If remote rejected (non-fast-forward), pull/rebase only with user confirmation unless the branch is clearly agent-only WIP and the user already approved restack.
- Empty working tree: skip commit; if branch is ahead of remote, still push.

## Helper script

```bash
node scripts/auto-ship.mjs "feat(scope): short summary"
```

Optional second arg for body:

```bash
node scripts/auto-ship.mjs "feat(scope): short summary" "Longer body paragraph."
```

Flags:

- `--dry-run` — print actions only
- `--no-push` — commit only
- `--allow-empty` — exit 0 when there is nothing to ship

npm:

```bash
npm run ship -- "feat(scope): short summary"
```
