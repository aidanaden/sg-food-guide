import { stalls as staticStalls } from '../../data/stalls';
import type { Stall } from '../../data/shared';
import type { CanonicalStall, CountryCode } from '../stalls/contracts';
import {
  buildYouTubeVideoUrl,
  deriveSlug,
  infoScore,
  makeLocationId,
  makeStallIdFromSourceKey,
  makeStallSourceKey,
  normalizeDisplayText,
  normalizeYouTubeVideoId,
} from './normalize';

interface GroupAccumulator {
  sourceKey: string;
  best: Stall;
  bestScore: number;
  locations: Map<string, { address: string; lat: number | null; lng: number | null; youtubeVideoUrl: string | null }>;
  hits: Set<string>;
  misses: Set<string>;
  awards: Set<string>;
}

function toCountryCode(value: Stall['country']): CountryCode {
  return value as CountryCode;
}

function toNullableFinite(value: number): number | null {
  return Number.isFinite(value) && value !== 0 ? value : null;
}

function stallScore(stall: Stall): number {
  return infoScore({
    openingTimes: stall.openingTimes,
    dishName: stall.dishName,
    youtubeVideoUrl: buildYouTubeVideoUrl(stall.youtubeVideoId ?? null),
    hits: stall.hits,
    misses: stall.misses,
    awards: stall.awards,
    ratingModerated: stall.ratingModerated,
    ratingOriginal: stall.ratingOriginal,
  });
}

export function buildCanonicalStallsFromStaticData(syncedAtIso: string): CanonicalStall[] {
  const groups = new Map<string, GroupAccumulator>();

  for (const stall of staticStalls) {
    const sourceKey = makeStallSourceKey(stall.name, stall.country, stall.cuisine);
    const existing = groups.get(sourceKey);
    const score = stallScore(stall);

    const address = normalizeDisplayText(stall.address);
    const youtubeVideoUrl = buildYouTubeVideoUrl(stall.youtubeVideoId ?? null);
    const location = {
      address,
      lat: toNullableFinite(stall.lat),
      lng: toNullableFinite(stall.lng),
      youtubeVideoUrl,
    };

    if (!existing) {
      const locationMap = new Map<string, typeof location>();
      locationMap.set(address.toLowerCase(), location);
      groups.set(sourceKey, {
        sourceKey,
        best: stall,
        bestScore: score,
        locations: locationMap,
        hits: new Set(stall.hits),
        misses: new Set(stall.misses),
        awards: new Set(stall.awards),
      });
      continue;
    }

    if (!existing.locations.has(address.toLowerCase())) {
      existing.locations.set(address.toLowerCase(), location);
    }

    for (const item of stall.hits) existing.hits.add(item);
    for (const item of stall.misses) existing.misses.add(item);
    for (const item of stall.awards) existing.awards.add(item);

    if (score > existing.bestScore) {
      existing.best = stall;
      existing.bestScore = score;
    }
  }

  const canonicalStalls: CanonicalStall[] = [];

  for (const group of groups.values()) {
    const best = group.best;
    const sourceStallKey = group.sourceKey;
    const stallId = makeStallIdFromSourceKey(sourceStallKey);
    const slug = deriveSlug(best.name, sourceStallKey);

    const locations = [...group.locations.values()].map((location) => ({
      id: makeLocationId(stallId, location.address),
      address: location.address,
      lat: location.lat,
      lng: location.lng,
      youtubeVideoUrl: location.youtubeVideoUrl,
      mapsQuery: `${best.googleMapsName || best.name} ${location.address}`,
      isPrimary: false,
      isActive: true,
    }));

    const preferredPrimaryAddress = normalizeDisplayText(best.address);
    const primaryLocation =
      locations.find((location) => location.address.toLowerCase() === preferredPrimaryAddress.toLowerCase()) ??
      locations[0];

    if (!primaryLocation) {
      continue;
    }

    for (const location of locations) {
      location.isPrimary = location.address.toLowerCase() === primaryLocation.address.toLowerCase();
    }

    const youtubeVideoId = normalizeYouTubeVideoId(best.youtubeVideoId ?? null);
    const youtubeVideoUrl = buildYouTubeVideoUrl(youtubeVideoId);

    canonicalStalls.push({
      id: stallId,
      sourceStallKey,
      slug,
      name: normalizeDisplayText(best.name),
      cuisine: best.cuisine,
      cuisineLabel: normalizeDisplayText(best.cuisineLabel),
      country: toCountryCode(best.country),
      primaryAddress: primaryLocation.address,
      primaryLat: primaryLocation.lat,
      primaryLng: primaryLocation.lng,
      episodeNumber: best.episodeNumber,
      dishName: normalizeDisplayText(best.dishName),
      price: Number.isFinite(best.price) ? best.price : 0,
      ratingOriginal: best.ratingOriginal,
      ratingModerated: best.ratingModerated,
      openingTimes: normalizeDisplayText(best.openingTimes),
      timeCategories: best.timeCategories,
      hits: [...group.hits].sort((a, b) => a.localeCompare(b)),
      misses: [...group.misses].sort((a, b) => a.localeCompare(b)),
      youtubeTitle: normalizeDisplayText(best.youtubeTitle),
      youtubeVideoUrl,
      youtubeVideoId,
      googleMapsName: normalizeDisplayText(best.googleMapsName || best.name),
      awards: [...group.awards].sort((a, b) => a.localeCompare(b)),
      status: 'active',
      sourceRank: 10,
      sourceSheetHash: 'static-seed',
      sourceYoutubeHash: 'static-seed',
      locations,
      lastSyncedAt: syncedAtIso,
    });
  }

  return canonicalStalls;
}
