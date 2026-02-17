interface GeocodeOk {
  status: 'ok';
  source: 'onemap' | 'nominatim';
  lat: number;
  lng: number;
  label: string;
}

interface GeocodeError {
  status: 'error';
  error: string;
}

interface CacheEntry {
  expiresAt: number;
  value: GeocodeOk | GeocodeError;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const geocodeCache = new Map<string, CacheEntry>();

const COUNTRY_TO_CODE: Record<string, string> = {
  SG: 'sg',
  MY: 'my',
  TH: 'th',
  HK: 'hk',
  CN: 'cn',
  JP: 'jp',
  ID: 'id',
};

function json(body: GeocodeOk | GeocodeError, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function normalizeCountry(raw: string | null): string {
  const value = String(raw || '').trim().toUpperCase();
  return COUNTRY_TO_CODE[value] ? value : 'SG';
}

function cacheKey(query: string, country: string): string {
  return `${country}:${query.trim().toLowerCase()}`;
}

function readCache(key: string): GeocodeOk | GeocodeError | null {
  const entry = geocodeCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    geocodeCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key: string, value: GeocodeOk | GeocodeError): void {
  geocodeCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function parseLatLng(latRaw: unknown, lngRaw: unknown): { lat: number; lng: number } | null {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function oneMapLabel(result: Record<string, unknown>, query: string): string {
  const building = String(result.BUILDING || '').trim();
  const address = String(result.ADDRESS || '').trim();
  if (building && address) return `${building}, ${address}`;
  return building || address || query;
}

async function geocodeWithOneMap(query: string): Promise<GeocodeOk | null> {
  const url = new URL('https://www.onemap.gov.sg/api/common/elastic/search');
  url.searchParams.set('searchVal', query);
  url.searchParams.set('returnGeom', 'Y');
  url.searchParams.set('getAddrDetails', 'Y');
  url.searchParams.set('pageNum', '1');

  try {
    const res = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
    const first = Array.isArray(data.results) ? data.results[0] : null;
    if (!first) return null;

    const coords = parseLatLng(first.LATITUDE, first.LONGITUDE);
    if (!coords) return null;

    return {
      status: 'ok',
      source: 'onemap',
      lat: coords.lat,
      lng: coords.lng,
      label: oneMapLabel(first, query),
    };
  } catch {
    return null;
  }
}

async function geocodeWithNominatim(query: string, country: string): Promise<GeocodeOk | null> {
  const cc = COUNTRY_TO_CODE[country] || 'sg';
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);
  url.searchParams.set('countrycodes', cc === 'hk' ? 'cn,hk' : cc);

  try {
    const res = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) return null;

    const coords = parseLatLng(first.lat, first.lon);
    if (!coords) return null;

    return {
      status: 'ok',
      source: 'nominatim',
      lat: coords.lat,
      lng: coords.lng,
      label: String(first.display_name || query).trim() || query,
    };
  } catch {
    return null;
  }
}

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  const query = String(url.searchParams.get('q') || '').trim();
  const country = normalizeCountry(url.searchParams.get('country'));

  if (query.length < 2) {
    return json(
      {
        status: 'error',
        error: 'Query must be at least 2 characters.',
      },
      400
    );
  }

  const key = cacheKey(query, country);
  const cached = readCache(key);
  if (cached) {
    return json(cached, cached.status === 'ok' ? 200 : 404);
  }

  const sgQuery = country === 'SG' && !/singapore/i.test(query) ? `${query} Singapore` : query;
  const oneMapResult = country === 'SG' ? await geocodeWithOneMap(sgQuery) : null;
  if (oneMapResult) {
    writeCache(key, oneMapResult);
    return json(oneMapResult, 200);
  }

  const fallbackResult = await geocodeWithNominatim(query, country);
  if (fallbackResult) {
    writeCache(key, fallbackResult);
    return json(fallbackResult, 200);
  }

  const failure: GeocodeError = {
    status: 'error',
    error: 'Location not found.',
  };
  writeCache(key, failure);
  return json(failure, 404);
}
