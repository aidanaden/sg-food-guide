/**
 * Geocode stalls with lat: 0, lng: 0 using Nominatim (OpenStreetMap).
 * Run: bun scripts/geocode.ts
 *
 * Nominatim rate limit: 1 request per second.
 * Results are written back to the source .ts files in-place.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(import.meta.dir, '..', 'src', 'data');
const CACHE_FILE = join(import.meta.dir, '.geocode-cache.json');

// Load cache
let cache: Record<string, { lat: number; lng: number }> = {};
try {
  cache = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
} catch {
  cache = {};
}

function saveCache() {
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function geocode(name: string, address: string, country: string): Promise<{ lat: number; lng: number } | null> {
  const cacheKey = `${name}|${address}`;
  if (cache[cacheKey]) return cache[cacheKey];

  // Build query — use address first, fall back to name + country
  const countryCode = country.toLowerCase();
  const queries = [
    `${name} ${address}`,
    address,
    `${name}, ${countryCode === 'sg' ? 'Singapore' : countryCode === 'my' ? 'Malaysia' : countryCode === 'jp' ? 'Japan' : countryCode === 'th' ? 'Thailand' : countryCode === 'hk' ? 'Hong Kong' : countryCode === 'cn' ? 'China' : countryCode === 'id' ? 'Indonesia' : ''}`,
  ];

  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=${countryCode === 'hk' ? 'cn' : countryCode}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'sg-food-guide-geocoder/1.0' },
      });
      const data = await res.json();

      if (data.length > 0) {
        const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        cache[cacheKey] = result;
        saveCache();
        return result;
      }
    } catch (err) {
      console.error(`  Error geocoding "${q}":`, err);
    }

    // Rate limit
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
  const cuisineFiles = readdirSync(cuisineDir).filter(f => f.endsWith('.ts')).map(f => join(cuisineDir, f));
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
