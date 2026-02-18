/**
 * Geocode stalls with lat: 0, lng: 0 using Nominatim (OpenStreetMap).
 * Run: bun scripts/geocode.ts
 *
 * Nominatim rate limit: 1 request per second.
 * Results are written back to the source .ts files in-place.
 */

import { Result } from 'better-result';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as z from 'zod/mini';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(SCRIPT_DIR, '..', 'src', 'data');
const CACHE_FILE = join(SCRIPT_DIR, '.geocode-cache.json');
const cacheSchema = z.record(z.string(), z.object({
  lat: z.number(),
  lng: z.number(),
}));
const nominatimResponseSchema = z.array(z.object({
  lat: z.union([z.string(), z.number()]),
  lon: z.union([z.string(), z.number()]),
}));

function loadCache(): Record<string, { lat: number; lng: number }> {
  const fileResult = Result.try(() => readFileSync(CACHE_FILE, 'utf-8'));
  if (Result.isError(fileResult)) return {};

  const parsedResult = Result.try(() => JSON.parse(fileResult.value));
  if (Result.isError(parsedResult)) return {};

  const parsedCache = cacheSchema.safeParse(parsedResult.value);
  return parsedCache.success ? parsedCache.data : {};
}
let cache: Record<string, { lat: number; lng: number }> = loadCache();

function saveCache() {
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

const COUNTRY_NAMES: Record<string, string> = {
  sg: 'Singapore',
  my: 'Malaysia',
  jp: 'Japan',
  th: 'Thailand',
  hk: 'Hong Kong',
  cn: 'China',
  id: 'Indonesia',
};

/**
 * Clean Singapore-style addresses for better Nominatim matches:
 * - Strip unit numbers like #01-28, #02-48/49
 * - Strip "Blk" prefix
 * - Extract postal code for standalone search
 */
function cleanAddress(address: string): string {
  return address
    .replace(/#\d{1,2}-\d{1,4}(?:\/\d+)?\s*,?\s*/g, '') // Remove unit numbers
    .replace(/\bBlk\s*/gi, '')                             // Remove "Blk"
    .replace(/\s{2,}/g, ' ')                               // Collapse whitespace
    .trim()
    .replace(/^,\s*/, '')                                   // Leading comma
    .replace(/,\s*,/g, ',');                                // Double commas
}

/** Extract Singapore postal code (6 digits) */
function extractPostalCode(address: string, country: string): string | null {
  if (country.toLowerCase() !== 'sg') return null;
  const match = address.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

/** Extract the main street/road name from an address */
function extractStreetName(address: string): string | null {
  // Match common SG road patterns: "123 Jurong East St 24" -> "Jurong East St 24"
  const match = address.match(/\d+\s+(.+?)(?:,|\s+#|\s+Singapore|\s+SG\s)/i);
  return match ? match[1].trim() : null;
}

async function nominatimSearch(query: string, countryCode: string): Promise<{ lat: number; lng: number } | null> {
  const cc = countryCode === 'hk' ? 'cn' : countryCode;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=${cc}`;
  const responseResult = await Result.tryPromise(() => fetch(url, {
    headers: { 'User-Agent': 'sg-food-guide-geocoder/1.0' },
  }));
  if (Result.isError(responseResult)) {
    console.error(`  Error querying Nominatim:`, responseResult.error);
    return null;
  }

  const payloadResult = await Result.tryPromise(() => responseResult.value.json());
  if (Result.isError(payloadResult)) {
    console.error(`  Error parsing Nominatim response:`, payloadResult.error);
    return null;
  }

  const payload = nominatimResponseSchema.safeParse(payloadResult.value);
  if (!payload.success || payload.data.length === 0) return null;

  const first = payload.data[0];
  const lat = parseFloat(String(first.lat));
  const lng = parseFloat(String(first.lon));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function geocode(name: string, address: string, country: string): Promise<{ lat: number; lng: number } | null> {
  const cacheKey = `${name}|${address}`;
  if (cache[cacheKey]) return cache[cacheKey];

  const countryCode = country.toLowerCase();
  const countryName = COUNTRY_NAMES[countryCode] || '';
  const cleaned = cleanAddress(address);
  const postalCode = extractPostalCode(address, country);
  const streetName = extractStreetName(address);

  // Build a prioritized list of search queries
  const queries: string[] = [];

  // 1. Cleaned address (no unit numbers)
  queries.push(cleaned);

  // 2. Name + cleaned address
  queries.push(`${name}, ${cleaned}`);

  // 3. Singapore postal code search (most reliable for SG)
  if (postalCode) {
    queries.push(`Singapore ${postalCode}`);
  }

  // 4. Street name + country
  if (streetName) {
    queries.push(`${streetName}, ${countryName}`);
  }

  // 5. Just name + country (last resort)
  queries.push(`${name}, ${countryName}`);

  for (const q of queries) {
    const result = await nominatimSearch(q, countryCode);
    if (result) {
      cache[cacheKey] = result;
      saveCache();
      return result;
    }
    // Rate limit: 1 req/sec
    await new Promise((r) => setTimeout(r, 1100));
  }

  return null;
}

async function processFile(filePath: string) {
  let content = readFileSync(filePath, 'utf-8');
  const fileName = filePath.split('/').pop();

  // Each stall is on a single line. Match lines with lat: 0, lng: 0
  const lines = content.split('\n');
  let geocodedCount = 0;
  let totalZero = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('lat: 0, lng: 0')) continue;
    totalZero++;

    // Extract fields from the line
    const nameMatch = line.match(/name:\s*'([^']+)'/);
    const addressMatch = line.match(/address:\s*'([^']+)'/);
    const countryMatch = line.match(/country:\s*'([^']+)'/);

    if (!nameMatch || !addressMatch || !countryMatch) continue;

    const name = nameMatch[1];
    const address = addressMatch[1];
    const country = countryMatch[1];

    console.log(`  Geocoding: ${name} — ${address} (${country})`);
    const coords = await geocode(name, address, country);

    if (coords) {
      lines[i] = line.replace('lat: 0, lng: 0', `lat: ${coords.lat.toFixed(6)}, lng: ${coords.lng.toFixed(6)}`);
      geocodedCount++;
      console.log(`    -> ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
    } else {
      console.log(`    -> NOT FOUND`);
    }
  }

  writeFileSync(filePath, lines.join('\n'));
  console.log(`  -> ${geocodedCount}/${totalZero} geocoded in ${fileName}`);
}

async function main() {
  console.log('Geocoding stalls with lat: 0, lng: 0...\n');

  // Process cuisine files
  const cuisineDir = join(DATA_DIR, 'cuisines');
  const cuisineFiles = readdirSync(cuisineDir)
    .filter((f: string) => f.endsWith('.ts'))
    .map((f: string) => join(cuisineDir, f));
  for (const file of cuisineFiles) {
    console.log(`\nProcessing ${file.split('/').pop()}...`);
    await processFile(file);
  }

  // Process stalls.ts (has inline hokkien mee data)
  const stallsFile = join(DATA_DIR, 'stalls.ts');
  console.log(`\nProcessing stalls.ts...`);
  await processFile(stallsFile);

  console.log('\nDone! Run `bun run build` to verify.');
}

main();
