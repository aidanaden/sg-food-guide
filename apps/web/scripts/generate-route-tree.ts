import { Generator, getConfig } from '@tanstack/router-generator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Result } from 'better-result';

function getProjectRoot(): string {
  const filePath = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(filePath), '..');
}

async function main() {
  const root = getProjectRoot();
  const config = getConfig({}, root);
  const generator = new Generator({ config, root });

  const runResult = await Result.tryPromise(async () => {
    await generator.run();
  });

  if (Result.isError(runResult)) {
    console.error(runResult.error);
    process.exit(1);
  }
}

void main();
