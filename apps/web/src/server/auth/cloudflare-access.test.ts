import { describe, expect, it } from 'vitest';

import { Result } from 'better-result';

import { requireCloudflareAccessAdmin } from './cloudflare-access';

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

describe('requireCloudflareAccessAdmin', () => {
  it('authorizes allowlisted Cloudflare Access email', () => {
    const db = makeD1Mock();
    const result = requireCloudflareAccessAdmin({
      cloudflare: {
        env: {
          STALLS_DB: db,
          CLOUDFLARE_ACCESS_ADMIN_EMAILS: 'admin@example.com,owner@example.com',
        },
        request: new Request('https://example.com/admin/comment-drafts', {
          headers: {
            'cf-access-authenticated-user-email': 'owner@example.com',
          },
        }),
      },
    });

    expect(Result.isError(result)).toBe(false);
    if (Result.isError(result)) {
      return;
    }

    expect(result.value.email).toBe('owner@example.com');
  });

  it('rejects non-allowlisted Cloudflare Access email', () => {
    const db = makeD1Mock();
    const result = requireCloudflareAccessAdmin({
      cloudflare: {
        env: {
          STALLS_DB: db,
          CLOUDFLARE_ACCESS_ADMIN_EMAILS: 'admin@example.com',
        },
        request: new Request('https://example.com/admin/comment-drafts', {
          headers: {
            'cf-access-authenticated-user-email': 'intruder@example.com',
          },
        }),
      },
    });

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) {
      return;
    }

    expect(result.error.message).toContain('not authorized');
  });
});
