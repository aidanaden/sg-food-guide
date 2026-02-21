import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SEARCH_ROOTS = ["apps", "libs", "configs"];
const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".css"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".astro", ".tanstack", ".turbo"]);
const COLOR_OPACITY_REGEX =
  /\b(?:bg|text|border|ring|from|via|to|stroke|fill|outline|decoration|shadow)-[A-Za-z0-9_\-\[\]\(\)]+\/\d{1,3}\b/g;

const OVERLAY_ALLOWLIST = new Set([
  `libs${sep}ui${sep}src${sep}components${sep}ui${sep}dialog${sep}dialog-primitives.tsx`,
  `libs${sep}ui${sep}src${sep}components${sep}ui${sep}drawer.tsx`,
]);

type Violation = {
  file: string;
  token: string;
};

function walk(dir: string, files: string[]) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) {
      continue;
    }

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (!stat.isFile()) {
      continue;
    }

    const dotIndex = entry.lastIndexOf(".");
    const extension = dotIndex === -1 ? "" : entry.slice(dotIndex);
    if (!FILE_EXTENSIONS.has(extension)) {
      continue;
    }

    files.push(fullPath);
  }
}

function isAllowedToken(relativeFile: string, token: string) {
  if (token.startsWith("shadow-")) {
    return true;
  }

  if (token.startsWith("bg-black/") && OVERLAY_ALLOWLIST.has(relativeFile)) {
    return true;
  }

  return false;
}

function collectViolations() {
  const files: string[] = [];
  for (const searchRoot of SEARCH_ROOTS) {
    const fullSearchRoot = join(ROOT, searchRoot);
    walk(fullSearchRoot, files);
  }

  const violations: Violation[] = [];

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf8");
    const matches = content.matchAll(COLOR_OPACITY_REGEX);
    const relativeFile = relative(ROOT, filePath);

    for (const match of matches) {
      const token = match[0];
      if (isAllowedToken(relativeFile, token)) {
        continue;
      }

      violations.push({ file: relativeFile, token });
    }
  }

  return violations;
}

const violations = collectViolations();

if (violations.length === 0) {
  console.log("check-color-opacity: passed (no disallowed color-opacity classes)");
  process.exit(0);
}

console.error("check-color-opacity: found disallowed color-opacity classes:");
for (const violation of violations) {
  console.error(`- ${violation.file}: ${violation.token}`);
}
process.exit(1);
