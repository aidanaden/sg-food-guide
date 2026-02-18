import { Result } from 'better-result';
import * as z from 'zod/mini';
import { lookupSgArea, normalizeAreaLikeQuery } from '../../data/sg-areas';

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
const geocodeQuerySchema = z.object({
  q: z.string(),
  country: z.optional(z.string()),
});
const oneMapItemSchema = z.object({
  LATITUDE: z.optional(z.union([z.string(), z.number()])),
  LONGITUDE: z.optional(z.union([z.string(), z.number()])),
  BUILDING: z.optional(z.union([z.string(), z.number()])),
  ADDRESS: z.optional(z.union([z.string(), z.number()])),
});
const oneMapResponseSchema = z.object({
  results: z.optional(z.array(oneMapItemSchema)),
});
const nominatimItemSchema = z.object({
  lat: z.optional(z.union([z.string(), z.number()])),
  lon: z.optional(z.union([z.string(), z.number()])),
  display_name: z.optional(z.string()),
});
const nominatimResponseSchema = z.array(nominatimItemSchema);

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

function lookupKnownSingaporeArea(query: string): GeocodeOk | null {
  const area = lookupSgArea(query);
  if (!area) return null;

  return {
    status: 'ok',
    // Keep existing client contract without adding a new source variant.
    source: 'nominatim',
    lat: area.lat,
    lng: area.lng,
    label: area.label,
  };
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

function oneMapLabel(result: { BUILDING?: string | number; ADDRESS?: string | number }, query: string): string {
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

  const responseResult = await Result.tryPromise(() => fetch(url.toString(), {
    headers: { accept: 'application/json' },
  }));
  if (Result.isError(responseResult)) return null;

  const response = responseResult.value;
  if (!response.ok) return null;

  const payloadResult = await Result.tryPromise(() => response.json());
  if (Result.isError(payloadResult)) return null;

  const payload = oneMapResponseSchema.safeParse(payloadResult.value);
  const first = payload.success ? payload.data.results?.[0] : null;
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
}

async function geocodeWithNominatim(query: string, country: string): Promise<GeocodeOk | null> {
  const cc = COUNTRY_TO_CODE[country] || 'sg';
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);
  url.searchParams.set('countrycodes', cc === 'hk' ? 'cn,hk' : cc);

  const responseResult = await Result.tryPromise(() => fetch(url.toString(), {
    headers: { accept: 'application/json' },
  }));
  if (Result.isError(responseResult)) return null;

  const response = responseResult.value;
  if (!response.ok) return null;

  const payloadResult = await Result.tryPromise(() => response.json());
  if (Result.isError(payloadResult)) return null;

  const payload = nominatimResponseSchema.safeParse(payloadResult.value);
  const first = payload.success ? payload.data[0] : null;
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
}

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  const parsedQuery = geocodeQuerySchema.safeParse({
    q: url.searchParams.get('q') ?? '',
    country: url.searchParams.get('country') ?? undefined,
  });
  if (!parsedQuery.success) {
    return json(
      {
        status: 'error',
        error: 'Invalid geocode query parameters.',
      },
      400
    );
  }

  const query = normalizeAreaLikeQuery(parsedQuery.data.q);
  const country = normalizeCountry(parsedQuery.data.country ?? null);

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

  const sgAreaMatch = country === 'SG' ? lookupKnownSingaporeArea(query) : null;
  if (sgAreaMatch) {
    writeCache(key, sgAreaMatch);
    return json(sgAreaMatch, 200);
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
