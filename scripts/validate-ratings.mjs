import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DATA_ROOT = join(process.cwd(), 'src', 'data');
const RATING_FIELD = /rating(?:Original|Moderated):\s*([^,\n}]+)\s*,/g;
const ALLOWED_VALUES = new Set(['0', '1', '2', '3', 'null']);

function collectTsFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
      continue;
    }
    if (fullPath.endsWith('.ts')) files.push(fullPath);
  }
  return files;
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

const violations = [];
for (const file of collectTsFiles(DATA_ROOT)) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(RATING_FIELD)) {
    const rawValue = match[1].trim();
    if (ALLOWED_VALUES.has(rawValue)) continue;
    violations.push({
      file,
      line: lineNumberAt(source, match.index ?? 0),
      value: rawValue,
    });
  }
}

if (violations.length > 0) {
  console.error('Rating contract violations found (expected 0..3 or null):');
  for (const v of violations) {
    console.error(`- ${v.file}:${v.line} -> ${v.value}`);
  }
  process.exit(1);
}

console.log('Ratings are valid (0..3 or null).');
