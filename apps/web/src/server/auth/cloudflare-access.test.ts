import { Result } from "better-result";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireCloudflareAccessAdmin } from "./cloudflare-access";

vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => Symbol("jwks")),
  jwtVerify: vi.fn(),
}));

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

async function loadJoseMocks() {
  const joseModule = await import("jose");
  return {
    createRemoteJWKSetMock: vi.mocked(joseModule.createRemoteJWKSet),
    jwtVerifyMock: vi.mocked(joseModule.jwtVerify),
  };
}

describe("requireCloudflareAccessAdmin", () => {
  beforeEach(async () => {
    const { createRemoteJWKSetMock, jwtVerifyMock } = await loadJoseMocks();
    createRemoteJWKSetMock.mockClear();
    jwtVerifyMock.mockReset();
  });

  it("authorizes a valid Cloudflare Access JWT and returns email claim", async () => {
    const db = makeD1Mock();
    const { jwtVerifyMock } = await loadJoseMocks();
    jwtVerifyMock.mockResolvedValue({
      payload: {
        email: "owner@example.com",
      },
    } as any);

    const result = await requireCloudflareAccessAdmin({
      cloudflare: {
        env: {
          STALLS_DB: db,
          CLOUDFLARE_ACCESS_AUD: "access-aud",
          CLOUDFLARE_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
        },
        request: new Request("https://example.com/admin/comment-drafts", {
          headers: {
            "cf-access-jwt-assertion": "jwt-token",
            "cf-access-authenticated-user-email": "owner@example.com",
          },
        }),
      },
    });

    expect(Result.isError(result)).toBe(false);
    if (Result.isError(result)) {
      return;
    }

    expect(result.value.email).toBe("owner@example.com");
  });

  it("rejects request without Cloudflare Access JWT assertion header", async () => {
    const db = makeD1Mock();

    const result = await requireCloudflareAccessAdmin({
      cloudflare: {
        env: {
          STALLS_DB: db,
          CLOUDFLARE_ACCESS_AUD: "access-aud",
          CLOUDFLARE_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
        },
        request: new Request("https://example.com/admin/comment-drafts"),
      },
    });

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) {
      return;
    }

    expect(result.error.message).toContain("assertion header is missing");
  });

  it("rejects invalid JWT signature/claims", async () => {
    const db = makeD1Mock();
    const { jwtVerifyMock } = await loadJoseMocks();
    jwtVerifyMock.mockRejectedValue(new Error("invalid jwt"));

    const result = await requireCloudflareAccessAdmin({
      cloudflare: {
        env: {
          STALLS_DB: db,
          CLOUDFLARE_ACCESS_AUD: "access-aud",
          CLOUDFLARE_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
        },
        request: new Request("https://example.com/admin/comment-drafts", {
          headers: {
            "cf-access-jwt-assertion": "jwt-token",
          },
        }),
      },
    });

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) {
      return;
    }

    expect(result.error.message).toContain("JWT validation failed");
  });

  it("rejects when team domain/aud config is missing", async () => {
    const db = makeD1Mock();
    const result = await requireCloudflareAccessAdmin({
      cloudflare: {
        env: {
          STALLS_DB: db,
        },
        request: new Request("https://example.com/admin/comment-drafts", {
          headers: {
            "cf-access-jwt-assertion": "jwt-token",
          },
        }),
      },
    });

    expect(Result.isError(result)).toBe(true);
    if (!Result.isError(result)) {
      return;
    }

    expect(result.error.message).toContain("JWT verification is not configured");
  });
});
