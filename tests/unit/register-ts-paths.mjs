/**
 * Map TypeScript path alias `@/*` → repo root for Node unit tests.
 * Also appends `.ts` when the bare path exists as a TypeScript file.
 *
 * Usage: node --import ./tests/unit/register-ts-paths.mjs --experimental-strip-types --test tests/unit/*.test.mjs
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rootUrl = pathToFileURL(root + path.sep).href;

const loaderSource = `
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = ${JSON.stringify(root)};

function resolveTsPath(absWithoutExt) {
  const candidates = [
    absWithoutExt,
    absWithoutExt + ".ts",
    absWithoutExt + ".tsx",
    absWithoutExt + ".js",
    absWithoutExt + ".mjs",
    path.join(absWithoutExt, "index.ts"),
    path.join(absWithoutExt, "index.js"),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return pathToFileURL(c).href;
      }
    } catch {
      // continue
    }
  }
  return pathToFileURL(absWithoutExt + ".ts").href;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const abs = path.join(root, specifier.slice(2));
    return nextResolve(resolveTsPath(abs), context);
  }

  // Relative imports from .ts files often omit extension
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL &&
    /\\.ts$/.test(context.parentURL.split("?")[0])
  ) {
    try {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const abs = path.resolve(parentDir, specifier);
      if (!path.extname(specifier)) {
        const resolved = resolveTsPath(abs);
        return nextResolve(resolved, context);
      }
    } catch {
      // fall through
    }
  }

  return nextResolve(specifier, context);
}
`;

register(`data:text/javascript,${encodeURIComponent(loaderSource)}`, rootUrl);
