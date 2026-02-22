import { Result } from 'better-result';
import * as z from 'zod/mini';

import type { WorkerEnv } from '../cloudflare/runtime';
import { normalizeComparableText, normalizeDisplayText } from './normalize';
import type { SheetStallRow } from './sheet-source';

const GOOGLE_PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const GOOGLE_PLACES_DETAILS_URL = 'https://places.googleapis.com/v1/places';
const GOOGLE_PLACES_DETAILS_FIELD_MASK =
  'id,displayName.text,formattedAddress,regularOpeningHours.weekdayDescriptions,currentOpeningHours.weekdayDescriptions';
const GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK =
  'places.id,places.displayName.text,places.formattedAddress,places.regularOpeningHours.weekdayDescriptions,places.currentOpeningHours.weekdayDescriptions';

const placeCandidateSchema = z.object({
  id: z.optional(z.string()),
  displayName: z.optional(
    z.object({
      text: z.string(),
    })
  ),
  formattedAddress: z.optional(z.string()),
  regularOpeningHours: z.optional(
    z.object({
      weekdayDescriptions: z.optional(z.array(z.string())),
    })
  ),
  currentOpeningHours: z.optional(
    z.object({
      weekdayDescriptions: z.optional(z.array(z.string())),
    })
  ),
});

type PlaceCandidate = z.infer<typeof placeCandidateSchema>;

const placesTextSearchResponseSchema = z.object({
  places: z.optional(z.array(placeCandidateSchema)),
});

interface OpeningHoursEnrichmentResult {
  rows: SheetStallRow[];
  warnings: string[];
}

interface PlacesTextSearchArgs {
  apiKey: string;
  mapsUrl: string;
  fallbackTextQuery: string;
  countryCode: string;
}

interface PlaceLookupArgs {
  apiKey: string;
  mapsUrl: string;
  rowName: string;
  rowAddress: string;
  countryCode: string;
}

interface LocationBias {
  latitude: number;
  longitude: number;
}

function readApiKey(env: WorkerEnv): string {
  return normalizeDisplayText(env.GOOGLE_PLACES_API_KEY ?? '');
}

function buildDerivedMapsSearchUrl(name: string, address: string): string {
  const query = normalizeDisplayText(`${name} ${address}`);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function normalizePlaceId(value: string): string {
  return normalizeDisplayText(value).replace(/^places\//i, '');
}

function decodeSafe(value: string): string {
  const decodedResult = Result.try(() => decodeURIComponent(value));
  if (Result.isError(decodedResult)) {
    return value;
  }

  return decodedResult.value;
}

function isLikelyGoogleMapsHost(hostname: string): boolean {
  return (
    hostname === 'google.com' ||
    hostname.endsWith('.google.com') ||
    hostname === 'maps.app.goo.gl' ||
    hostname.endsWith('.maps.app.goo.gl') ||
    hostname === 'goo.gl'
  );
}

function parseMapsUrl(value: string): Result<URL, Error> {
  const parsedUrlResult = Result.try(() => new URL(value));
  if (Result.isError(parsedUrlResult)) {
    return Result.err(new Error('Invalid Google Maps URL.'));
  }

  const hostname = parsedUrlResult.value.hostname.replace(/^www\./, '').toLowerCase();
  if (!isLikelyGoogleMapsHost(hostname)) {
    return Result.err(new Error('Unsupported Google Maps host.'));
  }

  return Result.ok(parsedUrlResult.value);
}

function extractPlaceIdFromMapsUrl(mapsUrl: string): string | null {
  const parsedResult = parseMapsUrl(mapsUrl);
  if (Result.isError(parsedResult)) {
    return null;
  }

  const url = parsedResult.value;
  const queryCandidates = [
    url.searchParams.get('q') ?? '',
    url.searchParams.get('query') ?? '',
    url.searchParams.get('place_id') ?? '',
    url.searchParams.get('ftid') ?? '',
  ];

  for (const candidate of queryCandidates) {
    const normalizedCandidate = normalizeDisplayText(candidate);
    if (normalizedCandidate.length === 0) {
      continue;
    }

    const explicitMatch = normalizedCandidate.match(/^place_id:\s*([A-Za-z0-9_-]+)$/i);
    if (explicitMatch?.[1]) {
      return normalizePlaceId(explicitMatch[1]);
    }

    const embeddedMatch = normalizedCandidate.match(/\b(ChI[A-Za-z0-9_-]{10,})\b/);
    if (embeddedMatch?.[1]) {
      return normalizePlaceId(embeddedMatch[1]);
    }
  }

  const decodedPath = decodeSafe(url.pathname);
  const pathMatch = decodedPath.match(/\b(ChI[A-Za-z0-9_-]{10,})\b/);
  return pathMatch?.[1] ? normalizePlaceId(pathMatch[1]) : null;
}

function sanitizeTextQuery(value: string): string {
  const decoded = decodeSafe(value).replace(/\+/g, ' ');
  const normalized = normalizeDisplayText(decoded);
  if (normalized.length === 0) {
    return '';
  }

  const withoutPrefix = normalized.replace(/^place_id:\s*/i, '');
  return normalizeDisplayText(withoutPrefix);
}

function extractTextQueryFromMapsUrl(mapsUrl: string): string {
  const parsedResult = parseMapsUrl(mapsUrl);
  if (Result.isError(parsedResult)) {
    return '';
  }

  const url = parsedResult.value;
  const queryCandidates = [
    url.searchParams.get('q') ?? '',
    url.searchParams.get('query') ?? '',
    url.searchParams.get('destination') ?? '',
  ];

  for (const candidate of queryCandidates) {
    const normalized = sanitizeTextQuery(candidate);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  const decodedPath = decodeSafe(url.pathname).replace(/\+/g, ' ');
  const placePathMatch = decodedPath.match(/\/maps\/place\/([^/]+)/i);
  if (placePathMatch?.[1]) {
    const pathQuery = sanitizeTextQuery(placePathMatch[1]);
    if (pathQuery.length > 0) {
      return pathQuery;
    }
  }

  return '';
}

function parseLocationBias(mapsUrl: string): LocationBias | null {
  const parsedResult = parseMapsUrl(mapsUrl);
  if (Result.isError(parsedResult)) {
    return null;
  }

  const url = parsedResult.value;

  const llValue = normalizeDisplayText(url.searchParams.get('ll') ?? '');
  if (llValue.length > 0) {
    const [latRaw, lngRaw] = llValue.split(',');
    const latitude = Number(latRaw);
    const longitude = Number(lngRaw);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  const path = decodeSafe(url.pathname);
  const atMatch = path.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch?.[1] && atMatch[2]) {
    const latitude = Number(atMatch[1]);
    const longitude = Number(atMatch[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  const fullUrl = decodeSafe(url.toString());
  const dataMatch = fullUrl.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dataMatch?.[1] && dataMatch[2]) {
    const latitude = Number(dataMatch[1]);
    const longitude = Number(dataMatch[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  return null;
}

function extractWeekdayDescriptions(place: PlaceCandidate): string[] {
  const current = place.currentOpeningHours?.weekdayDescriptions?.map(normalizeDisplayText) ?? [];
  const regular = place.regularOpeningHours?.weekdayDescriptions?.map(normalizeDisplayText) ?? [];

  const source = current.length > 0 ? current : regular;
  return source.filter((line) => line.length > 0);
}

function formatWeekdayDescriptions(place: PlaceCandidate): string | null {
  const lines = extractWeekdayDescriptions(place);
  if (lines.length === 0) {
    return null;
  }

  return lines.join('; ');
}

function hasMeaningfulNameMatch(rowName: string, place: PlaceCandidate): boolean {
  const placeName = normalizeComparableText(place.displayName?.text ?? '');
  if (placeName.length === 0) {
    return true;
  }

  const rowTokens = normalizeComparableText(rowName)
    .split(/\s+/)
    .filter((token) => token.length >= 3);

  if (rowTokens.length === 0) {
    return true;
  }

  return rowTokens.some((token) => placeName.includes(token));
}

function decodeMapsPayloadForText(payload: string): string {
  return payload
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\u202f/g, ' ')
    .replace(/\\u00a0/g, ' ')
    .replace(/\\u2013/g, '–')
    .replace(/\\u2014/g, '—')
    .replace(/\\n/g, ' ');
}

function parseHoursFromMapsPayload(payload: string): string | null {
  const normalized = decodeMapsPayloadForText(payload);

  const dayMatches = [...normalized.matchAll(
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b\s*[:-]?\s*([^<;"\n]{2,80})/gi
  )];

  if (dayMatches.length >= 3) {
    const uniqueLines = new Map<string, string>();
    for (const match of dayMatches) {
      const day = normalizeDisplayText(match[1] ?? '');
      const hours = normalizeDisplayText(match[2] ?? '');
      if (day.length === 0 || hours.length === 0) {
        continue;
      }
      uniqueLines.set(day, `${day}: ${hours}`);
    }

    if (uniqueLines.size > 0) {
      return [...uniqueLines.values()].join('; ');
    }
  }

  const quickStatusMatch = normalized.match(
    /\b(Open 24 hours|Open now|Closed now|Opens?\s+[^\n<;")]{1,60}|Closes?\s+[^\n<;")]{1,60})\b/i
  );
  if (quickStatusMatch?.[1]) {
    return normalizeDisplayText(quickStatusMatch[1]);
  }

  const timeRangeMatches = [
    ...normalized.matchAll(
      /\b\d{1,2}(?::\d{2})?\s?(?:AM|PM)\s*[–-]\s*\d{1,2}(?::\d{2})?\s?(?:AM|PM)\b/g
    ),
  ];

  if (timeRangeMatches.length > 0) {
    const uniqueRanges = new Set<string>();
    for (const match of timeRangeMatches) {
      const range = normalizeDisplayText(match[0] ?? '');
      if (range.length > 0) {
        uniqueRanges.add(range);
      }
      if (uniqueRanges.size >= 3) {
        break;
      }
    }

    if (uniqueRanges.size > 0) {
      return [...uniqueRanges].join('; ');
    }
  }

  return null;
}

async function scrapeOpeningHoursFromMapsPage(mapsUrl: string): Promise<Result<string | null, Error>> {
  const responseResult = await Result.tryPromise(() =>
    fetch(mapsUrl, {
      headers: {
        'User-Agent': 'sg-food-guide-stall-sync/1.0',
        'Accept-Language': 'en-SG,en;q=0.9',
      },
      redirect: 'follow',
    })
  );

  if (Result.isError(responseResult)) {
    return Result.err(new Error('Failed to fetch Google Maps page for hours scraping.'));
  }

  if (!responseResult.value.ok) {
    return Result.err(
      new Error(`Google Maps page fetch failed with HTTP ${responseResult.value.status}.`)
    );
  }

  const bodyResult = await Result.tryPromise(() => responseResult.value.text());
  if (Result.isError(bodyResult)) {
    return Result.err(new Error('Failed reading Google Maps page body.'));
  }

  return Result.ok(parseHoursFromMapsPayload(bodyResult.value));
}

async function fetchPlaceDetailsById(apiKey: string, placeId: string): Promise<Result<PlaceCandidate | null, Error>> {
  const normalizedPlaceId = normalizePlaceId(placeId);
  if (normalizedPlaceId.length === 0) {
    return Result.ok(null);
  }

  const endpoint = `${GOOGLE_PLACES_DETAILS_URL}/${encodeURIComponent(normalizedPlaceId)}`;
  const responseResult = await Result.tryPromise(() =>
    fetch(endpoint, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': GOOGLE_PLACES_DETAILS_FIELD_MASK,
        'User-Agent': 'sg-food-guide-stall-sync/1.0',
      },
    })
  );

  if (Result.isError(responseResult)) {
    return Result.err(new Error('Failed to fetch Google Places details.'));
  }

  if (!responseResult.value.ok) {
    if (responseResult.value.status === 404) {
      return Result.ok(null);
    }
    return Result.err(
      new Error(`Google Places details request failed with HTTP ${responseResult.value.status}.`)
    );
  }

  const bodyResult = await Result.tryPromise(() => responseResult.value.json());
  if (Result.isError(bodyResult)) {
    return Result.err(new Error('Failed parsing Google Places details JSON payload.'));
  }

  const parsed = placeCandidateSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return Result.err(new Error('Invalid Google Places details payload.'));
  }

  return Result.ok(parsed.data);
}

async function fetchPlaceFromTextSearch(args: PlacesTextSearchArgs): Promise<Result<PlaceCandidate | null, Error>> {
  const textQuery = extractTextQueryFromMapsUrl(args.mapsUrl) || normalizeDisplayText(args.fallbackTextQuery);
  if (textQuery.length === 0) {
    return Result.ok(null);
  }

  const requestBody: Record<string, unknown> = {
    textQuery,
    maxResultCount: 1,
    languageCode: 'en',
  };

  const regionCode = normalizeDisplayText(args.countryCode).toUpperCase();
  if (regionCode.length > 0) {
    requestBody.regionCode = regionCode;
  }

  const locationBias = parseLocationBias(args.mapsUrl);
  if (locationBias) {
    requestBody.locationBias = {
      circle: {
        center: {
          latitude: locationBias.latitude,
          longitude: locationBias.longitude,
        },
        radius: 500,
      },
    };
  }

  const responseResult = await Result.tryPromise(() =>
    fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'X-Goog-Api-Key': args.apiKey,
        'X-Goog-FieldMask': GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK,
        'User-Agent': 'sg-food-guide-stall-sync/1.0',
      },
      body: JSON.stringify(requestBody),
    })
  );

  if (Result.isError(responseResult)) {
    return Result.err(new Error('Failed to fetch Google Places text search results.'));
  }

  if (!responseResult.value.ok) {
    return Result.err(
      new Error(`Google Places text search request failed with HTTP ${responseResult.value.status}.`)
    );
  }

  const bodyResult = await Result.tryPromise(() => responseResult.value.json());
  if (Result.isError(bodyResult)) {
    return Result.err(new Error('Failed parsing Google Places text search JSON payload.'));
  }

  const parsed = placesTextSearchResponseSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return Result.err(new Error('Invalid Google Places text search payload.'));
  }

  const firstPlace = parsed.data.places?.[0] ?? null;
  return Result.ok(firstPlace);
}

async function lookupOpeningHours(args: PlaceLookupArgs): Promise<Result<string | null, Error>> {
  let apiLookupError: Error | null = null;

  if (args.apiKey.length > 0) {
    const placeId = extractPlaceIdFromMapsUrl(args.mapsUrl);
    if (placeId) {
      const detailsResult = await fetchPlaceDetailsById(args.apiKey, placeId);
      if (Result.isError(detailsResult)) {
        apiLookupError = detailsResult.error;
      } else {
        const detailedPlace = detailsResult.value;
        if (detailedPlace && hasMeaningfulNameMatch(args.rowName, detailedPlace)) {
          const detailedHours = formatWeekdayDescriptions(detailedPlace);
          if (detailedHours) {
            return Result.ok(detailedHours);
          }
        }
      }
    }

    const searchResult = await fetchPlaceFromTextSearch({
      apiKey: args.apiKey,
      mapsUrl: args.mapsUrl,
      fallbackTextQuery: `${args.rowName} ${args.rowAddress}`,
      countryCode: args.countryCode,
    });

    if (Result.isError(searchResult)) {
      apiLookupError = searchResult.error;
    } else {
      const place = searchResult.value;
      if (place && hasMeaningfulNameMatch(args.rowName, place)) {
        const searchHours = formatWeekdayDescriptions(place);
        if (searchHours) {
          return Result.ok(searchHours);
        }
      }
    }
  }

  const scrapeResult = await scrapeOpeningHoursFromMapsPage(args.mapsUrl);
  if (Result.isError(scrapeResult)) {
    if (apiLookupError) {
      return Result.err(
        new Error(`${apiLookupError.message} Fallback scrape failed: ${scrapeResult.error.message}`)
      );
    }

    return Result.err(scrapeResult.error);
  }

  if (scrapeResult.value) {
    return Result.ok(scrapeResult.value);
  }

  if (apiLookupError) {
    return Result.err(apiLookupError);
  }

  return Result.ok(null);
}

export async function enrichOpeningTimesFromGoogleMaps(
  rows: SheetStallRow[],
  env: WorkerEnv
): Promise<Result<OpeningHoursEnrichmentResult, Error>> {
  const apiKey = readApiKey(env);
  const hasPlacesApiKey = apiKey.length > 0;
  const clonedRows = rows.map((row) => ({ ...row }));
  const warnings: string[] = [];

  const candidates = clonedRows.filter((row) => row.openingTimes.trim().length === 0);

  if (candidates.length === 0) {
    return Result.ok({
      rows: clonedRows,
      warnings,
    });
  }

  const lookupGroups = new Map<
    string,
    {
      mapsUrl: string;
      rows: SheetStallRow[];
      name: string;
      address: string;
      countryCode: string;
    }
  >();

  for (const row of candidates) {
    const mapsUrl = row.googleMapsUrl ?? buildDerivedMapsSearchUrl(row.name, row.address);

    const key = `${mapsUrl}|${row.country}`;
    const existing = lookupGroups.get(key);
    if (existing) {
      existing.rows.push(row);
      continue;
    }

    lookupGroups.set(key, {
      mapsUrl,
      rows: [row],
      name: row.name,
      address: row.address,
      countryCode: row.country,
    });
  }

  let enrichedRowsCount = 0;
  let failedLookupCount = 0;
  let sampleError: string | null = null;

  const lookupEntries = [...lookupGroups.values()];
  const lookupResults = await Promise.all(
    lookupEntries.map(async (lookup) => ({
      lookup,
      lookupResult: await lookupOpeningHours({
        apiKey,
        mapsUrl: lookup.mapsUrl,
        rowName: lookup.name,
        rowAddress: lookup.address,
        countryCode: lookup.countryCode,
      }),
    }))
  );

  for (const entry of lookupResults) {
    const { lookup, lookupResult } = entry;

    if (Result.isError(lookupResult)) {
      failedLookupCount += 1;
      if (!sampleError) {
        sampleError = `${lookup.name}: ${lookupResult.error.message}`;
      }
      continue;
    }

    const openingTimes = lookupResult.value;
    if (!openingTimes) {
      continue;
    }

    for (const row of lookup.rows) {
      row.openingTimes = openingTimes;
      enrichedRowsCount += 1;
    }
  }

  if (failedLookupCount > 0) {
    warnings.push(
      `Google Maps hours enrichment failed for ${failedLookupCount} lookup(s).${sampleError ? ` Sample: ${sampleError}` : ''}`
    );
  }

  if (!hasPlacesApiKey) {
    warnings.push(
      'GOOGLE_PLACES_API_KEY is not set; opening-hours enrichment is using best-effort Google Maps page scraping.'
    );
  }

  if (enrichedRowsCount === 0 && failedLookupCount === 0) {
    if (hasPlacesApiKey) {
      warnings.push('Google Maps hours enrichment did not find usable hours for any candidate rows.');
    } else {
      warnings.push(
        'Google Maps hours enrichment did not find usable hours for any candidate rows with scraper fallback. Configure GOOGLE_PLACES_API_KEY for higher reliability.'
      );
    }
  }

  return Result.ok({
    rows: clonedRows,
    warnings,
  });
}
