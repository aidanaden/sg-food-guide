import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadHandler() {
  const module = await import('./transit');
  return module.onRequestGet;
}

describe('/api/transit/plan', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 400 for invalid query parameters', async () => {
    const onRequestGet = await loadHandler();

    const response = await onRequestGet({
      request: new Request('https://example.com/api/transit/plan?mode=car&stops=1.30,103.80|1.31,103.81'),
      env: {},
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid mode. Expected "bus" or "train".',
    });
  });

  it('returns fallback response when OneMap credentials are missing', async () => {
    const onRequestGet = await loadHandler();

    const response = await onRequestGet({
      request: new Request('https://example.com/api/transit/plan?mode=train&stops=1.3000,103.8000|1.3100,103.8200'),
      env: {},
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { status: string; warnings: string[]; legs: unknown[] };
    expect(payload.status).toBe('fallback');
    expect(payload.legs.length).toBe(1);
    expect(payload.warnings).toContain('OneMap credentials are not configured on the server.');
  });

  it('returns successful planned transit response when OneMap responds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'sample-token',
            expiry_timestamp: Math.floor(Date.now() / 1000) + 3600,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            plan: {
              itineraries: [
                {
                  duration: 24,
                  legs: [
                    {
                      mode: 'RAIL',
                      distance: 2800,
                      routeShortName: 'EW',
                      numStops: 4,
                      from: { name: 'Start Station' },
                      to: { name: 'End Station' },
                      legGeometry: {
                        points: '1.3000,103.8000 1.3100,103.8200',
                      },
                    },
                  ],
                },
              ],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const onRequestGet = await loadHandler();

    const response = await onRequestGet({
      request: new Request('https://example.com/api/transit/plan?mode=train&stops=1.3000,103.8000|1.3100,103.8200'),
      env: {
        ONEMAP_EMAIL: 'user@example.com',
        ONEMAP_PASSWORD: 'secret',
      },
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      status: string;
      provider: string;
      legs: Array<{ exact: boolean; transit: { kind: string; serviceOrLine?: string } }>;
    };

    expect(payload.status).toBe('ok');
    expect(payload.provider).toBe('onemap_lta');
    expect(payload.legs.length).toBe(1);
    expect(payload.legs[0]?.exact).toBe(true);
    expect(payload.legs[0]?.transit.kind).toBe('train');
    expect(payload.legs[0]?.transit.serviceOrLine).toBe('EW');
  });
});
