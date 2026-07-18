#!/usr/bin/env node
/**
 * auto-ship.mjs — stage, commit, and push current branch changes.
 *
 * Usage:
 *   node scripts/auto-ship.mjs "feat(scope): summary" ["optional body"]
 *   node scripts/auto-ship.mjs --dry-run "chore: test"
 *   node scripts/auto-ship.mjs --no-push "fix: local only"
 *   node scripts/auto-ship.mjs --allow-empty
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const args = process.argv.slice(2);

const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));
const dryRun = flags.has("--dry-run");
const noPush = flags.has("--no-push");
const allowEmpty = flags.has("--allow-empty");

const message = positional[0] || "";
const body = positional[1] || "";

function run(cmd, cmdArgs, { capture = true } = {}) {
  if (dryRun) {
    console.log(`[dry-run] ${cmd} ${cmdArgs.join(" ")}`);
    return "";
  }
  const result = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(err || `${cmd} exited ${result.status}`);
  }
  return (result.stdout || "").trim();
}

function git(args, opts) {
  return run("git", args, opts);
}

function hasGitRepo() {
  try {
    git(["rev-parse", "--is-inside-work-tree"]);
    return true;
  } catch {
    return false;
  }
}

function statusPorcelain() {
  return git(["status", "--porcelain"]);
}

function branchName() {
  return git(["rev-parse", "--abbrev-ref", "HEAD"]);
}

function aheadBehind() {
  try {
    const out = git(["rev-list", "--left-right", "--count", "@{u}...HEAD"]);
    const [behind, ahead] = out.split(/\s+/).map((n) => Number(n) || 0);
    return { ahead, behind, hasUpstream: true };
  } catch {
    return { ahead: 0, behind: 0, hasUpstream: false };
  }
}

function blockedPaths(lines) {
  const blocked = [];
  for (const line of lines) {
    const file = line.slice(3).trim().replace(/^.* -> /, "");
    if (
      /(^|\/)\.env($|\.)/i.test(file) ||
      /\.(pem|key|p12|pfx)$/i.test(file) ||
      /(^|\/)(secrets?|credentials)\//i.test(file) ||
      file.includes("id_rsa")
    ) {
      blocked.push(file);
    }
  }
  return blocked;
}

function main() {
  if (!hasGitRepo()) {
    console.error("Not a git repository.");
    process.exit(1);
  }

  if (!existsSync(path.join(ROOT, ".git")) && !existsSync(path.join(ROOT, ".git"))) {
    // worktrees still fine via rev-parse
  }

  const porcelain = statusPorcelain();
  const dirtyLines = porcelain ? porcelain.split("\n").filter(Boolean) : [];
  const secrets = blockedPaths(dirtyLines);
  if (secrets.length) {
    console.error("Refusing to ship; possible secrets:\n" + secrets.map((s) => `  - ${s}`).join("\n"));
    process.exit(2);
  }

  const branch = branchName();
  const { ahead, behind, hasUpstream } = aheadBehind();

  if (dirtyLines.length === 0) {
    if (ahead > 0 && !noPush) {
      console.log(`Working tree clean; branch ${branch} is ahead by ${ahead}. Pushing…`);
      git(["push", "-u", "origin", "HEAD"], { capture: false });
      console.log("Push complete.");
      return;
    }
    if (allowEmpty) {
      console.log("Nothing to ship.");
      return;
    }
    console.log("Nothing to commit or push.");
    process.exit(0);
  }

  if (!message) {
    console.error('Missing commit message. Example:\n  node scripts/auto-ship.mjs "feat(scope): summary"');
    process.exit(1);
  }

  if (behind > 0) {
    console.error(
      `Remote is ahead by ${behind} commit(s). Pull/rebase before shipping (refusing auto-push).`
    );
    process.exit(3);
  }

  console.log(`Shipping on ${branch} (${dirtyLines.length} changed path(s))…`);
  git(["add", "-A"]);
  // Re-check after add in case only ignored noise
  const staged = git(["diff", "--cached", "--name-only"]);
  if (!staged && !dryRun) {
    console.log("Nothing staged after git add -A (maybe ignore rules).");
    process.exit(0);
  }

  const commitArgs = ["commit", "-m", message];
  if (body) commitArgs.push("-m", body);
  git(commitArgs, { capture: false });

  const hash = dryRun ? "DRY_RUN" : git(["rev-parse", "--short", "HEAD"]);
  console.log(`Committed ${hash}: ${message}`);

  if (!noPush) {
    git(["push", "-u", "origin", "HEAD"], { capture: false });
    console.log(hasUpstream ? "Pushed to upstream." : "Pushed and set upstream origin HEAD.");
  } else {
    console.log("Skipped push (--no-push).");
  }
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
