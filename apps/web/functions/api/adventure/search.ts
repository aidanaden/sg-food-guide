type ActivityType = 'horse_riding' | 'dirt_biking';

interface ActivityOption {
  id: string;
  activity: ActivityType;
  label: string;
  address: string;
  lat: number;
  lng: number;
  mapsUrl: string;
  source: 'nominatim';
}

interface ActivityGroup {
  activity: ActivityType;
  label: string;
  options: ActivityOption[];
}

interface SuccessResponse {
  status: 'ok';
  query: {
    city: string;
    country: string;
    activities: ActivityType[];
    limit: number;
  };
  groups: ActivityGroup[];
  warnings: string[];
}

interface ErrorResponse {
  status: 'error';
  error: string;
}

interface CacheEntry {
  expiresAt: number;
  options: ActivityOption[];
}

interface NominatimResult {
  place_id?: number;
  osm_id?: number;
  osm_type?: string;
  category?: string;
  type?: string;
  importance?: number;
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, string>;
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  horse_riding: 'Horse Riding',
  dirt_biking: 'Dirt Biking',
};

const ACTIVITY_KEYWORDS: Record<ActivityType, string[]> = {
  horse_riding: ['horse riding', 'horseback riding', 'equestrian center'],
  dirt_biking: ['dirt bike track', 'motocross track', 'off road motorcycle'],
};

const DEFAULT_ACTIVITIES: ActivityType[] = ['horse_riding', 'dirt_biking'];
const CACHE_TTL_MS = 5 * 60_000;
const MIN_LIMIT = 3;
const MAX_LIMIT = 12;
const DEFAULT_LIMIT = 8;
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

const searchCache = new Map<string, CacheEntry>();

function json(body: SuccessResponse | ErrorResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function sanitizeInput(value: string | null, label: string): string {
  const sanitized = (value || '').trim().replace(/\s+/g, ' ');
  if (!sanitized) {
    throw new Error(`Missing required "${label}" query parameter.`);
  }
  if (sanitized.length > 80) {
    throw new Error(`"${label}" is too long. Max length is 80 characters.`);
  }
  return sanitized;
}

function normalizeLimit(value: string | null): number {
  const parsed = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, Math.round(parsed)));
}

function normalizeActivities(value: string | null): ActivityType[] {
  if (!value) return DEFAULT_ACTIVITIES;
  const list = value
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .filter((v): v is ActivityType => v === 'horse_riding' || v === 'dirt_biking');
  return [...new Set(list)];
}

function addressFromParts(address: Record<string, string> | undefined, fallback: string): string {
  if (!address) return fallback;
  const parts = [
    address.road,
    address.suburb,
    address.city || address.town || address.village,
    address.state,
    address.country,
  ].filter(Boolean);
  if (!parts.length) return fallback;
  return parts.join(', ');
}

function getLabel(result: NominatimResult): string {
  if (typeof result.name === 'string' && result.name.trim()) return result.name.trim();
  if (typeof result.display_name === 'string' && result.display_name.trim()) {
    return result.display_name.split(',')[0].trim();
  }
  return 'Unnamed Place';
}

function makeMapsUrl(label: string, lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${label} ${lat},${lng}`)}`;
}

function toActivityOption(activity: ActivityType, result: NominatimResult): ActivityOption | null {
  const lat = Number(result.lat);
  const lng = Number(result.lon);
  const osmId = Number(result.osm_id);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(osmId)) {
    return null;
  }

  const label = getLabel(result);
  const fallbackAddress = typeof result.display_name === 'string' ? result.display_name : '';
  const address = addressFromParts(result.address, fallbackAddress);
  const osmType = (result.osm_type || 'unknown').toLowerCase();
  const id = `${activity}:${osmType}:${osmId}`;

  return {
    id,
    activity,
    label,
    address,
    lat,
    lng,
    mapsUrl: makeMapsUrl(label, lat, lng),
    source: 'nominatim',
  };
}

function dedupeOptions(options: ActivityOption[]): ActivityOption[] {
  const unique = new Map<string, ActivityOption>();
  for (const option of options) {
    if (!unique.has(option.id)) unique.set(option.id, option);
  }
  return [...unique.values()];
}

async function fetchNominatim(query: string, limit: number): Promise<NominatimResult[]> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
    },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data as NominatimResult[];
}

function cacheKey(activity: ActivityType, city: string, country: string, limit: number): string {
  return `${activity}:${city.toLowerCase()}:${country.toLowerCase()}:${limit}`;
}

async function researchActivity(
  activity: ActivityType,
  city: string,
  country: string,
  limit: number
): Promise<ActivityOption[]> {
  const key = cacheKey(activity, city, country, limit);
  const cached = searchCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.options;

  const keywords = ACTIVITY_KEYWORDS[activity];
  const perKeywordLimit = Math.max(2, Math.ceil(limit / keywords.length));
  const settled = await Promise.all(
    keywords.map((keyword) => fetchNominatim(`${keyword} in ${city}, ${country}`, perKeywordLimit))
  );

  const options = dedupeOptions(
    settled
      .flat()
      .map((row) => toActivityOption(activity, row))
      .filter((row): row is ActivityOption => row !== null)
  ).slice(0, limit);

  searchCache.set(key, {
    expiresAt: now + CACHE_TTL_MS,
    options,
  });

  return options;
}

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const { searchParams } = new URL(context.request.url);

  let city = '';
  let country = '';
  let activities: ActivityType[] = [];

  try {
    city = sanitizeInput(searchParams.get('city'), 'city');
    country = sanitizeInput(searchParams.get('country'), 'country');
    activities = normalizeActivities(searchParams.get('activities'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request.';
    return json({ status: 'error', error: message }, 400);
  }

  if (!activities.length) {
    return json(
      {
        status: 'error',
        error: 'Select at least one activity. Supported values: horse_riding,dirt_biking.',
      },
      400
    );
  }

  const limit = normalizeLimit(searchParams.get('limit'));

  const groups = await Promise.all(
    activities.map(async (activity): Promise<ActivityGroup> => {
      const options = await researchActivity(activity, city, country, limit);
      return {
        activity,
        label: ACTIVITY_LABELS[activity],
        options,
      };
    })
  );

  const warnings = groups
    .filter((group) => group.options.length === 0)
    .map((group) => `No ${group.label.toLowerCase()} results found for ${city}, ${country}.`);

  return json({
    status: 'ok',
    query: {
      city,
      country,
      activities,
      limit,
    },
    groups,
    warnings,
  });
}
