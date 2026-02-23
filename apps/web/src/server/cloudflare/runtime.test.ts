import { describe, expect, it } from 'vitest';

import { Result } from 'better-result';

import { getWorkerEnvFromServerContext } from './runtime';

function makeD1Mock() {
  return {
    prepare: () => ({
      bind() {
        return this;
      },
      async first() {
        return null;
      },
      async all() {
        return { results: [], success: true };
      },
      async run() {
        return { success: true };
      },
    }),
    async batch() {
      return [];
    },
    async exec() {
      return { success: true };
    },
  };
}

describe('cloudflare runtime context parsing', () => {
  it('parses direct cloudflare context', () => {
    const db = makeD1Mock();
    const result = getWorkerEnvFromServerContext({
      cloudflare: {
        env: {
          STALLS_DB: db,
        },
      },
    });

    expect(Result.isError(result)).toBe(false);
    if (Result.isError(result)) {
      return;
    }
    expect(result.value.STALLS_DB).toBe(db);
  });

  it('parses route handler requestContext wrapper', () => {
    const db = makeD1Mock();
    const result = getWorkerEnvFromServerContext({
      requestContext: {
        cloudflare: {
          env: {
            STALLS_DB: db,
          },
        },
      },
    });

    expect(Result.isError(result)).toBe(false);
    if (Result.isError(result)) {
      return;
    }
    expect(result.value.STALLS_DB).toBe(db);
  });

  it('parses nested context wrapper shape', () => {
    const db = makeD1Mock();
    const result = getWorkerEnvFromServerContext({
      context: {
        cloudflare: {
          env: {
            STALLS_DB: db,
          },
        },
      },
    });

    expect(Result.isError(result)).toBe(false);
    if (Result.isError(result)) {
      return;
    }
    expect(result.value.STALLS_DB).toBe(db);
  });
});
