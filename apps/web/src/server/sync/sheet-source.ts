import { Result } from 'better-result';
import * as z from 'zod/mini';

import type { WorkerEnv } from '../cloudflare/runtime';
import { countryCodeSchema } from '../stalls/contracts';
import { makeStableHash, normalizeDisplayText } from './normalize';

export interface SheetStallRow {
  sourceRow: number;
  sourceRowKey: string;
  name: string;
  address: string;
  cuisine: string;
  cuisineLabel: string;
  country: z.infer<typeof countryCodeSchema>;
  episodeNumber: number | null;
  dishName: string;
  price: number;
  ratingOriginal: number | null;
  ratingModerated: number | null;
  openingTimes: string;
  googleMapsUrl: string | null;
  youtubeVideoUrl: string | null;
  youtubeTitle: string;
  awards: string[];
}

export interface SheetCsvSource {
  sourceUrl: string;
  gid: string;
  csv: string;
}

export interface SheetCsvPayload {
  sourceUrl: string;
  csv: string;
  sources: SheetCsvSource[];
}

interface ParseSheetRowsOptions {
  defaultCuisine?: { cuisine: string; cuisineLabel: string } | null;
  sourceIdentityPrefix?: string;
}

const DEFAULT_SHEET_ID = '1UMOZE2SM3_y5oUHafwJFEB9RrPDMqBbWjWnMGkO4gGg';
const DEFAULT_SHEET_GID = '1935025317';
const SHEET_GID_CUISINE_LABELS: Record<string, string> = {
  '1935025317': 'Prawn Mee',
  '1044192284': 'Bak Chor Mee',
  '0': 'Bak Kut Teh',
  '913918732': 'Wanton Mee',
  '1491689747': 'Mala',
  '1468657282': 'Laksa',
  '1136105343': 'Nasi Lemak',
  '1150004859': 'Ramen',
  '1906548174': 'Char Kway Teow',
  '1147413423': 'Hokkien Mee',
};

const sheetSourceSchema = z.object({
  sourceUrl: z.string(),
  gid: z.string(),
  csv: z.string(),
});
const fetchPayloadSchema = z.object({
  sourceUrl: z.string(),
  csv: z.string(),
  sources: z.array(sheetSourceSchema),
});

function buildSheetCsvExportUrl(sheetId: string, gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function parseSheetGidList(rawGids: string): string[] {
  const parsed = rawGids
    .split(',')
    .map((gid) => normalizeDisplayText(gid))
    .filter((gid) => gid.length > 0);

  if (parsed.length === 0) {
    return [];
  }

  return [...new Set(parsed)];
}

function extractSheetIdFromGoogleSheetsUrl(source: string): string | null {
  const parsedUrl = Result.try(() => new URL(source));
  if (Result.isError(parsedUrl)) {
    return null;
  }

  const host = parsedUrl.value.hostname.replace(/^www\./, '').toLowerCase();
  if (host !== 'docs.google.com') {
    return null;
  }

  const sheetIdMatch = parsedUrl.value.pathname.match(/^\/spreadsheets\/d\/([^/]+)/);
  const sheetId = normalizeDisplayText(sheetIdMatch?.[1] ?? '');
  return sheetId.length > 0 ? sheetId : null;
}

function extractGidFromHash(hash: string): string | null {
  const normalizedHash = hash.replace(/^#/, '');
  if (!normalizedHash) {
    return null;
  }

  const hashParams = new URLSearchParams(normalizedHash);
  const hashGid = normalizeDisplayText(hashParams.get('gid') ?? '');
  if (hashGid.length > 0) {
    return hashGid;
  }

  const match = normalizedHash.match(/(?:^|&)gid=([^&]+)/);
  return normalizeDisplayText(match?.[1] ?? '') || null;
}

function resolveExplicitSheetSourceToCsvUrl(explicitSource: string, fallbackGid: string): string {
  if (explicitSource.length === 0) {
    return explicitSource;
  }

  // Treat a bare spreadsheet id as shorthand.
  if (!explicitSource.includes('/')) {
    return buildSheetCsvExportUrl(explicitSource, fallbackGid);
  }

  const parsedUrl = Result.try(() => new URL(explicitSource));
  if (Result.isError(parsedUrl)) {
    return explicitSource;
  }

  const host = parsedUrl.value.hostname.replace(/^www\./, '').toLowerCase();
  if (host !== 'docs.google.com') {
    return explicitSource;
  }

  const sheetIdMatch = parsedUrl.value.pathname.match(/^\/spreadsheets\/d\/([^/]+)/);
  const sheetId = normalizeDisplayText(sheetIdMatch?.[1] ?? '');
  if (sheetId.length === 0) {
    return explicitSource;
  }

  const gidFromQuery = normalizeDisplayText(parsedUrl.value.searchParams.get('gid') ?? '');
  const gidFromHash = extractGidFromHash(parsedUrl.value.hash);
  const gid = gidFromQuery || gidFromHash || fallbackGid;

  return buildSheetCsvExportUrl(sheetId, gid);
}

function extractGidFromSourceUrl(sourceUrl: string, fallbackGid: string): string {
  const parsedUrlResult = Result.try(() => new URL(sourceUrl));
  if (Result.isError(parsedUrlResult)) {
    return fallbackGid;
  }

  const gid = normalizeDisplayText(parsedUrlResult.value.searchParams.get('gid') ?? '');
  return gid || fallbackGid;
}

function normalizeCsv(input: string): string {
  return input
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n+$/, '\n');
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];

    if (inQuotes) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((currentRow) => currentRow.some((value) => value.trim().length > 0));
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function readCell(row: string[], index: number): string {
  if (index < 0) {
    return '';
  }

  return normalizeDisplayText(row[index] ?? '');
}

function findRequiredColumn(
  headers: string[],
  matches: Array<(header: string) => boolean>,
  label: string
): Result<number, Error> {
  const index = headers.findIndex((header) => matches.some((match) => match(header)));
  if (index === -1) {
    return Result.err(new Error(`Missing required column "${label}" in Google Sheet export.`));
  }

  return Result.ok(index);
}

function findOptionalColumn(headers: string[], match: (header: string) => boolean): number {
  return headers.findIndex(match);
}

function parseNumber(value: string): number | null {
  if (value.length === 0) {
    return null;
  }

  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAwards(value: string): string[] {
  if (value.length === 0) {
    return [];
  }

  return value
    .split(/\n|;/g)
    .map((award) => normalizeDisplayText(award))
    .filter((award) => award.length > 0);
}

function normalizeGoogleMapsUrl(value: string): string | null {
  const normalized = normalizeDisplayText(value);
  if (normalized.length === 0) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
  const parsedUrlResult = Result.try(() => new URL(withProtocol));
  if (Result.isError(parsedUrlResult)) {
    return null;
  }

  const url = parsedUrlResult.value;
  const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
  const isGoogleMapsHost =
    hostname === 'google.com' ||
    hostname.endsWith('.google.com') ||
    hostname === 'maps.app.goo.gl' ||
    hostname.endsWith('.maps.app.goo.gl') ||
    hostname === 'goo.gl';

  if (!isGoogleMapsHost) {
    return null;
  }

  if (hostname.endsWith('google.com')) {
    const pathname = url.pathname.toLowerCase();
    if (!(pathname.startsWith('/maps') || pathname.startsWith('/search'))) {
      return null;
    }
  }

  return url.toString();
}

function normalizeCuisine(rawCuisine: string, fallbackDishName: string): { cuisine: string; cuisineLabel: string } {
  const label = normalizeDisplayText(rawCuisine || fallbackDishName || 'Unknown');
  const cuisine = label
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    cuisine: cuisine || 'unknown',
    cuisineLabel: label || 'Unknown',
  };
}

export function resolveSheetCuisineOverride(gid: string): { cuisine: string; cuisineLabel: string } | null {
  const normalizedGid = normalizeDisplayText(gid);
  const cuisineLabel = SHEET_GID_CUISINE_LABELS[normalizedGid];
  if (!cuisineLabel) {
    return null;
  }

  return normalizeCuisine(cuisineLabel, cuisineLabel);
}

function normalizeCountry(rawCountry: string): z.infer<typeof countryCodeSchema> {
  const countryCode = normalizeDisplayText(rawCountry).toUpperCase();
  const parsed = countryCodeSchema.safeParse(countryCode);
  if (parsed.success) {
    return parsed.data;
  }

  return 'SG';
}

export async function fetchSheetCsv(env: WorkerEnv): Promise<Result<SheetCsvPayload, Error>> {
  const explicitUrl = normalizeDisplayText(env.FOOD_GUIDE_SHEET_CSV_URL ?? '');
  const sheetId = normalizeDisplayText(env.FOOD_GUIDE_SHEET_ID ?? DEFAULT_SHEET_ID) || DEFAULT_SHEET_ID;
  const configuredGids = normalizeDisplayText(env.FOOD_GUIDE_SHEET_GID ?? DEFAULT_SHEET_GID) || DEFAULT_SHEET_GID;
  const gidList = parseSheetGidList(configuredGids);
  const fallbackGid = gidList[0] ?? DEFAULT_SHEET_GID;
  const effectiveSheetId = extractSheetIdFromGoogleSheetsUrl(explicitUrl) ?? sheetId;

  const sourceUrls =
    gidList.length > 1
      ? gidList.map((gid) => buildSheetCsvExportUrl(effectiveSheetId, gid))
      : [
          explicitUrl.length > 0
            ? resolveExplicitSheetSourceToCsvUrl(explicitUrl, fallbackGid)
            : buildSheetCsvExportUrl(sheetId, fallbackGid),
        ];

  const csvParts: string[] = [];
  const fetchedSources: SheetCsvSource[] = [];
  for (const sourceUrl of sourceUrls) {
    const responseResult = await Result.tryPromise(() =>
      fetch(sourceUrl, {
        headers: {
          'User-Agent': 'sg-food-guide-stall-sync/1.0',
        },
      })
    );

    if (Result.isError(responseResult)) {
      return Result.err(new Error(`Failed to fetch Google Sheet CSV source: ${sourceUrl}`));
    }

    if (!responseResult.value.ok) {
      return Result.err(
        new Error(`Google Sheet CSV fetch failed with HTTP ${responseResult.value.status}: ${sourceUrl}`)
      );
    }

    const textResult = await Result.tryPromise(() => responseResult.value.text());
    if (Result.isError(textResult)) {
      return Result.err(new Error(`Failed reading CSV response body from Google Sheet source: ${sourceUrl}`));
    }

    const normalizedCsv = normalizeCsv(textResult.value);
    csvParts.push(normalizedCsv);
    fetchedSources.push({
      sourceUrl,
      gid: extractGidFromSourceUrl(sourceUrl, fallbackGid),
      csv: normalizedCsv,
    });
  }

  const payload = fetchPayloadSchema.safeParse({
    sourceUrl: sourceUrls.join(','),
    csv: normalizeCsv(csvParts.join('\n')),
    sources: fetchedSources,
  });

  if (!payload.success) {
    return Result.err(new Error('Invalid Google Sheet CSV fetch payload.'));
  }

  return Result.ok(payload.data);
}

export function parseSheetRows(csv: string, options?: ParseSheetRowsOptions): Result<SheetStallRow[], Error> {
  const rows = parseCsv(csv);
  if (rows.length === 0) {
    return Result.ok([]);
  }

  const headerRow = rows[0];
  if (!headerRow) {
    return Result.ok([]);
  }

  const headers = headerRow.map(normalizeHeader);

  const nameColResult = findRequiredColumn(headers, [(header) => header === 'name'], 'name');
  if (Result.isError(nameColResult)) {
    return Result.err(nameColResult.error);
  }

  const addressColResult = findRequiredColumn(headers, [(header) => header === 'address'], 'address');
  if (Result.isError(addressColResult)) {
    return Result.err(addressColResult.error);
  }

  const cuisineCol = findOptionalColumn(headers, (header) => header === 'cuisine' || header === 'food type');
  const countryCol = findOptionalColumn(headers, (header) => header === 'country' || header === 'country code');
  const openingTimesCol = findOptionalColumn(headers, (header) => header.includes('opening times') || header.includes('hours'));
  const episodeCol = findOptionalColumn(headers, (header) => header.includes('episode number'));
  const dishNameCol = findOptionalColumn(headers, (header) => header.includes('dish name'));
  const priceCol = findOptionalColumn(headers, (header) => header === 'price');
  const ratingOriginalCol = findOptionalColumn(headers, (header) => header.includes('at time of shoot'));
  const ratingModeratedCol = findOptionalColumn(headers, (header) => header.includes('rating (moderated)'));
  const googleMapsUrlCol = findOptionalColumn(
    headers,
    (header) =>
      header === 'google maps' ||
      header === 'google maps url' ||
      header === 'google map url' ||
      header === 'maps url' ||
      header === 'map url' ||
      header === 'maps link' ||
      header === 'google maps link' ||
      header === 'google map link' ||
      (header.includes('google maps') && (header.includes('url') || header.includes('link')))
  );
  const youtubeVideoLinkCol = findOptionalColumn(headers, (header) => header.includes('youtube video link'));
  const youtubeTitleCol = findOptionalColumn(headers, (header) => header === 'youtube title' || header === 'video title');
  const awardsCol = findOptionalColumn(headers, (header) => header === 'awards');

  const parsedRows: SheetStallRow[] = [];
  let lastYoutubeUrl: string | null = null;

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row) {
      continue;
    }

    const nameCell = normalizeHeader(readCell(row, nameColResult.value));
    const addressCell = normalizeHeader(readCell(row, addressColResult.value));
    if (nameCell === headers[nameColResult.value] && addressCell === headers[addressColResult.value]) {
      continue;
    }

    const name = readCell(row, nameColResult.value);
    const address = readCell(row, addressColResult.value);

    if (!name || !address) {
      continue;
    }

    const rawYoutube = readCell(row, youtubeVideoLinkCol);
    if (rawYoutube.length > 0) {
      lastYoutubeUrl = rawYoutube;
    }

    const dishName = readCell(row, dishNameCol);
    const cuisineSource = readCell(row, cuisineCol);
    const cuisineFallback = options?.defaultCuisine ?? null;
    const cuisine =
      cuisineSource.length > 0 || !cuisineFallback
        ? normalizeCuisine(cuisineSource, dishName)
        : cuisineFallback;
    const country = normalizeCountry(readCell(row, countryCol));
    const episodeNumber = parseNumber(readCell(row, episodeCol));
    const price = parseNumber(readCell(row, priceCol)) ?? 0;
    const ratingOriginal = parseNumber(readCell(row, ratingOriginalCol));
    const ratingModerated = parseNumber(readCell(row, ratingModeratedCol));
    const openingTimes = readCell(row, openingTimesCol);
    const googleMapsUrl = normalizeGoogleMapsUrl(readCell(row, googleMapsUrlCol));
    const youtubeVideoUrl = rawYoutube || lastYoutubeUrl;
    const youtubeTitle = readCell(row, youtubeTitleCol);
    const awards = parseAwards(readCell(row, awardsCol));
    const sourceIdentityPrefix = normalizeDisplayText(options?.sourceIdentityPrefix ?? '');
    const sourceIdentityPrefixText = sourceIdentityPrefix.length > 0 ? `${sourceIdentityPrefix}|` : '';
    const sourceRowIdentity =
      googleMapsUrl && googleMapsUrl.length > 0
        ? `${sourceIdentityPrefixText}${name}|${address}|${country}|${cuisine.cuisine}|${dishName}|${episodeNumber ?? ''}|${googleMapsUrl}|${youtubeVideoUrl ?? ''}`
        : `${sourceIdentityPrefixText}${name}|${address}|${country}|${cuisine.cuisine}|${dishName}|${episodeNumber ?? ''}|${youtubeVideoUrl ?? ''}`;
    const sourceRowKey = `sheet-row-${makeStableHash(sourceRowIdentity).slice(0, 24)}`;

    parsedRows.push({
      sourceRow: rowIndex + 1,
      sourceRowKey,
      name,
      address,
      cuisine: cuisine.cuisine,
      cuisineLabel: cuisine.cuisineLabel,
      country,
      episodeNumber,
      dishName,
      price,
      ratingOriginal,
      ratingModerated,
      openingTimes,
      googleMapsUrl,
      youtubeVideoUrl,
      youtubeTitle,
      awards,
    });
  }

  return Result.ok(parsedRows);
}
