const fs = require("fs");
const path = require("path");

/** Core product source trees only (not skills/docs/agent copies). */
const SOURCE_DIRS = ["app", "components", "hooks", "lib", "types", "scripts", "tests"];

const EXTS = [".tsx", ".ts", ".js", ".mjs", ".css"];
const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "coverage",
  "out",
  "public",
  "test-results",
]);
const IGNORE_FILES = new Set(["package-lock.json", "codebase-stats.json", "pnpm-lock.yaml"]);

const EXT_LABELS = {
  ".tsx": "TSX",
  ".ts": "TypeScript",
  ".js": "JavaScript",
  ".mjs": "ES Module",
  ".css": "CSS",
};

function walkDir(dir) {
  let results = [];
  let list;
  try {
    list = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const ent of list) {
    const filePath = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(ent.name) || ent.name.startsWith(".")) continue;
      results = results.concat(walkDir(filePath));
      continue;
    }
    if (IGNORE_FILES.has(ent.name)) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (EXTS.includes(ext)) results.push(filePath);
  }
  return results;
}

function countLines(content) {
  if (!content) return 0;
  // Count physical lines the same way most editors do (split on \n).
  return content.split("\n").length;
}

const rootDir = process.cwd();
const files = SOURCE_DIRS.flatMap((dir) => {
  const abs = path.join(rootDir, dir);
  if (!fs.existsSync(abs)) return [];
  return walkDir(abs);
});

const breakdownMap = {};
for (const ext of EXTS) {
  breakdownMap[ext] = { label: EXT_LABELS[ext], files: 0, lines: 0 };
}

let totalFiles = 0;
let totalLines = 0;

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  const content = fs.readFileSync(file, "utf8");
  const lines = countLines(content);

  breakdownMap[ext].files += 1;
  breakdownMap[ext].lines += lines;
  totalFiles += 1;
  totalLines += lines;
}

const breakdown = Object.values(breakdownMap)
  .filter((item) => item.files > 0)
  .sort((a, b) => b.lines - a.lines);

const today = new Date();
const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

const stats = {
  snapshotDate: formattedDate,
  totalFiles,
  totalLines,
  scope: "core-source",
  sourceDirs: SOURCE_DIRS,
  breakdown,
};

const configDir = path.join(rootDir, "config");
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

fs.writeFileSync(
  path.join(configDir, "codebase-stats.json"),
  JSON.stringify(stats, null, 2) + "\n",
  "utf8"
);

console.log(
  `Generated codebase stats (${stats.scope}): ${totalFiles} files, ${totalLines} lines.`
);
