import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadHandler() {
  const module = await import('./geocode');
  return module.onRequestGet;
}

describe('/api/geocode/search', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 400 for invalid query parameters', async () => {
    const onRequestGet = await loadHandler();
    const response = await onRequestGet({
      request: new Request('https://example.com/api/geocode/search?q=a&country=SG'),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      status: 'error',
      error: 'Query must be at least 2 characters.',
    });
  });

  it('returns OneMap success when SG lookup resolves', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              LATITUDE: '1.301234',
              LONGITUDE: '103.801234',
              BUILDING: 'Sample Building',
              ADDRESS: '123 Test Road',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const onRequestGet = await loadHandler();
    const response = await onRequestGet({
      request: new Request('https://example.com/api/geocode/search?q=zz-geocode-onemap-1&country=SG'),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      source: 'onemap',
      lat: 1.301234,
      lng: 103.801234,
      label: 'Sample Building, 123 Test Road',
    });
  });

  it('falls back to Nominatim when OneMap fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('failed', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              lat: '1.3521',
              lon: '103.8198',
              display_name: 'Fallback Place',
            },
          ]),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const onRequestGet = await loadHandler();
    const response = await onRequestGet({
      request: new Request('https://example.com/api/geocode/search?q=zz-geocode-fallback-2&country=SG'),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      source: 'nominatim',
      lat: 1.3521,
      lng: 103.8198,
      label: 'Fallback Place',
    });
  });
});
