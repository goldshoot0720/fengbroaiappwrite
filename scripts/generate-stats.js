const fs = require("fs");
const path = require("path");

const EXTS = [".tsx", ".ts", ".js", ".json", ".md", ".css", ".html"];
const IGNORE_DIRS = ["node_modules", ".next", ".git", "dist", "build", "coverage", "out", "public"];
const IGNORE_FILES = ["package-lock.json", "codebase-stats.json"];

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) {
        results = results.concat(walkDir(filePath));
      }
    } else {
      if (IGNORE_FILES.includes(file)) continue;
      const ext = path.extname(file).toLowerCase();
      if (EXTS.includes(ext)) {
        results.push(filePath);
      }
    }
  }
  return results;
}

const rootDir = process.cwd();
const files = walkDir(rootDir);

const extLabels = {
  ".tsx": "TSX",
  ".ts": "TypeScript",
  ".js": "JavaScript",
  ".json": "JSON",
  ".md": "Markdown",
  ".css": "CSS",
  ".html": "HTML"
};

const breakdownMap = {};
let totalFiles = 0;
let totalLines = 0;

for (const ext of EXTS) {
  breakdownMap[ext] = { label: extLabels[ext], files: 0, lines: 0 };
}

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n").length;
  
  breakdownMap[ext].files += 1;
  breakdownMap[ext].lines += lines;
  
  totalFiles += 1;
  totalLines += lines;
}

const breakdown = Object.values(breakdownMap)
  .filter(item => item.files > 0)
  .sort((a, b) => b.lines - a.lines);

const today = new Date();
const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

const stats = {
  snapshotDate: formattedDate,
  totalFiles,
  totalLines,
  breakdown
};

const configDir = path.join(rootDir, "config");
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

fs.writeFileSync(
  path.join(configDir, "codebase-stats.json"),
  JSON.stringify(stats, null, 2),
  "utf8"
);

console.log(`Generated codebase stats: ${totalFiles} files, ${totalLines} lines.`);
