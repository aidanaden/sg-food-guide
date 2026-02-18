/**
 * Track the SG Food Guide Google Sheet as a source snapshot for food places.
 *
 * Usage:
 *   bun run track:sheet
 *
 * Optional env overrides:
 *   FOOD_GUIDE_SHEET_ID
 *   FOOD_GUIDE_SHEET_GID
 */

import { Result } from 'better-result';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as z from 'zod/mini';

interface FoodPlace {
  sourceRow: number;
  episodeNumber: string | null;
  place: string | null;
  name: string;
  address: string;
  dishName: string | null;
  price: string | null;
  ratingOriginal: number | null;
  ratingModerated: number | null;
  youtubeVideoLink: string | null;
  awards: string[];
}

interface SheetMeta {
  sheetId: string;
  gid: string;
  sourceUrl: string;
  fetchedAt: string;
  contentSha256: string;
  totalRows: number;
  trackedPlaces: number;
}

const DEFAULT_SHEET_ID = '1UMOZE2SM3_y5oUHafwJFEB9RrPDMqBbWjWnMGkO4gGg';
const DEFAULT_SHEET_GID = '1935025317';

const ROOT = process.cwd();
const OUTPUT_DIR = join(ROOT, 'data', 'source');
const CSV_OUTPUT_FILE = join(OUTPUT_DIR, 'food-guide-sheet.csv');
const META_OUTPUT_FILE = join(OUTPUT_DIR, 'food-guide-sheet.meta.json');
const PLACES_OUTPUT_FILE = join(OUTPUT_DIR, 'food-places.json');
const sheetMetaSchema = z.object({
  contentSha256: z.optional(z.string()),
});

function readEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

function readOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function normalizeCsv(input: string): string {
  const normalized = input
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n+$/, '\n');

  return normalized;
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

  return rows.filter((currentRow) => currentRow.some((value) => value.trim() !== ''));
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function readCell(row: string[], index: number): string {
  if (index < 0) return '';
  return (row[index] ?? '').trim();
}

function findRequiredColumn(
  headers: string[],
  matches: Array<(header: string) => boolean>,
  label: string
): number {
  const index = headers.findIndex((header) => matches.some((match) => match(header)));
  if (index === -1) {
    throw new Error(`Missing required "${label}" column in sheet export.`);
  }
  return index;
}

function findOptionalColumn(headers: string[], match: (header: string) => boolean): number {
  return headers.findIndex(match);
}

function parseRating(value: string): number | null {
  if (!value) return null;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitAwards(value: string): string[] {
  if (!value) return [];
  return value
    .split(/\n|;/g)
    .map((award) => award.trim())
    .filter(Boolean);
}

function parseFoodPlaces(rows: string[][]): FoodPlace[] {
  if (rows.length === 0) return [];

  const headers = rows[0].map(normalizeHeader);

  const episodeNumberCol = findRequiredColumn(headers, [(h) => h.includes('episode number')], 'episode number');
  const placeCol = findRequiredColumn(headers, [(h) => h === 'place'], 'place');
  const nameCol = findRequiredColumn(headers, [(h) => h === 'name'], 'name');
  const addressCol = findRequiredColumn(headers, [(h) => h === 'address'], 'address');
  const dishNameCol = findRequiredColumn(headers, [(h) => h.includes('dish name')], 'dish name');
  const priceCol = findRequiredColumn(headers, [(h) => h === 'price'], 'price');
  const ratingOriginalCol = findRequiredColumn(headers, [(h) => h.includes('at time of shoot')], 'rating original');
  const ratingModeratedCol = findRequiredColumn(headers, [(h) => h.includes('rating (moderated)')], 'rating moderated');
  const youtubeVideoLinkCol = findOptionalColumn(headers, (h) => h.includes('youtube video link'));
  const awardsCol = findOptionalColumn(headers, (h) => h === 'awards');

  const places: FoodPlace[] = [];
  // Carry these values forward across rows globally (including episode boundaries),
  // because the source sheet often leaves repeated metadata blank.
  let lastEpisodeNumber: string | null = null;
  let lastPlace: string | null = null;
  let lastYoutubeVideoLink: string | null = null;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const rawEpisodeNumber = readCell(row, episodeNumberCol);
    const rawPlace = readCell(row, placeCol);
    const rawYoutubeVideoLink = readCell(row, youtubeVideoLinkCol);

    if (rawEpisodeNumber) lastEpisodeNumber = rawEpisodeNumber;
    if (rawPlace) lastPlace = rawPlace;
    if (rawYoutubeVideoLink) lastYoutubeVideoLink = rawYoutubeVideoLink;

    const name = readCell(row, nameCol);
    const address = readCell(row, addressCol);
    if (!name || !address) continue;

    places.push({
      sourceRow: i + 1,
      episodeNumber: lastEpisodeNumber,
      place: lastPlace,
      name,
      address,
      dishName: readCell(row, dishNameCol) || null,
      price: readCell(row, priceCol) || null,
      ratingOriginal: parseRating(readCell(row, ratingOriginalCol)),
      ratingModerated: parseRating(readCell(row, ratingModeratedCol)),
      youtubeVideoLink: lastYoutubeVideoLink,
      awards: splitAwards(readCell(row, awardsCol)),
    });
  }

  return places;
}

function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function readPreviousHash(): string | null {
  if (!existsSync(META_OUTPUT_FILE)) return null;

  const fileResult = Result.try(() => readFileSync(META_OUTPUT_FILE, 'utf-8'));
  if (Result.isError(fileResult)) return null;

  const parsedResult = Result.try(() => JSON.parse(fileResult.value));
  if (Result.isError(parsedResult)) return null;

  const parsedMeta = sheetMetaSchema.safeParse(parsedResult.value);
  return parsedMeta.success ? parsedMeta.data.contentSha256 ?? null : null;
}

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function fetchSheetCsv(sourceUrl: string): Promise<string> {
  const response = await fetch(sourceUrl, {
    headers: {
      'User-Agent': 'sg-food-guide-sheet-tracker/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Sheet fetch failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function main() {
  const sheetId = readEnv('FOOD_GUIDE_SHEET_ID', DEFAULT_SHEET_ID);
  const gid = readEnv('FOOD_GUIDE_SHEET_GID', DEFAULT_SHEET_GID);
  const sourceUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const csvPathOverride = readOptionalEnv('FOOD_GUIDE_SHEET_CSV_PATH');

  console.log(`Tracking Google Sheet source: ${sourceUrl}${csvPathOverride ? ` (from ${csvPathOverride})` : ''}`);

  const csvRaw = csvPathOverride ? readFileSync(csvPathOverride, 'utf-8') : await fetchSheetCsv(sourceUrl);
  const csv = normalizeCsv(csvRaw);
  const nextHash = hashText(csv);
  const previousHash = readPreviousHash();
  const rows = parseCsv(csv);
  const foodPlaces = parseFoodPlaces(rows);

  const shouldWrite =
    previousHash !== nextHash ||
    !existsSync(CSV_OUTPUT_FILE) ||
    !existsSync(META_OUTPUT_FILE) ||
    !existsSync(PLACES_OUTPUT_FILE);

  if (!shouldWrite) {
    console.log('No source changes detected.');
    return;
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(CSV_OUTPUT_FILE, csv);
  writeJson(PLACES_OUTPUT_FILE, foodPlaces);

  const meta: SheetMeta = {
    sheetId,
    gid,
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    contentSha256: nextHash,
    totalRows: Math.max(rows.length - 1, 0),
    trackedPlaces: foodPlaces.length,
  };

  writeJson(META_OUTPUT_FILE, meta);

  if (previousHash && previousHash !== nextHash) {
    console.log(`Source changed: ${previousHash.slice(0, 12)} -> ${nextHash.slice(0, 12)}`);
  } else if (!previousHash) {
    console.log('Created initial source snapshot.');
  }

  console.log(`Tracked ${foodPlaces.length} food places.`);
}

const mainResult = await Result.tryPromise(() => main());
if (Result.isError(mainResult)) {
  const message = mainResult.error instanceof Error ? mainResult.error.message : String(mainResult.error);
  console.error(`track:sheet failed - ${message}`);
  process.exitCode = 1;
}
