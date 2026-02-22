import { Result } from 'better-result';
import * as z from 'zod/mini';

import {
  type Stall,
  type TimeCategory,
  parseTimeCategories,
} from '../../data/shared';

export const countryCodeSchema = z.union([
  z.literal('SG'),
  z.literal('MY'),
  z.literal('TH'),
  z.literal('HK'),
  z.literal('CN'),
  z.literal('JP'),
  z.literal('ID'),
]);

export type CountryCode = z.infer<typeof countryCodeSchema>;

export const timeCategorySchema = z.union([
  z.literal('early-morning'),
  z.literal('lunch'),
  z.literal('dinner'),
  z.literal('late-night'),
  z.literal('all-day'),
]);

export type CanonicalTimeCategory = z.infer<typeof timeCategorySchema>;

export interface CanonicalLocation {
  id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  youtubeVideoUrl: string | null;
  mapsQuery: string;
  isPrimary: boolean;
  isActive: boolean;
}

export interface CanonicalStall {
  id: string;
  sourceStallKey: string;
  slug: string;
  name: string;
  cuisine: string;
  cuisineLabel: string;
  country: CountryCode;
  primaryAddress: string;
  primaryLat: number | null;
  primaryLng: number | null;
  episodeNumber: number | null;
  dishName: string;
  price: number;
  ratingOriginal: number | null;
  ratingModerated: number | null;
  openingTimes: string;
  timeCategories: TimeCategory[];
  hits: string[];
  misses: string[];
  youtubeTitle: string;
  youtubeVideoUrl: string | null;
  youtubeVideoId: string | null;
  googleMapsName: string;
  awards: string[];
  status: 'active' | 'closed';
  sourceRank: number;
  sourceSheetHash: string | null;
  sourceYoutubeHash: string | null;
  locations: CanonicalLocation[];
  lastSyncedAt: string;
}

const dbStallRowSchema = z.object({
  id: z.string(),
  source_stall_key: z.string(),
  slug: z.string(),
  name: z.string(),
  cuisine: z.string(),
  cuisine_label: z.string(),
  country: countryCodeSchema,
  primary_address: z.string(),
  primary_lat: z.optional(z.union([z.number(), z.string(), z.null()])),
  primary_lng: z.optional(z.union([z.number(), z.string(), z.null()])),
  episode_number: z.optional(z.union([z.number(), z.string(), z.null()])),
  dish_name: z.string(),
  price: z.union([z.number(), z.string()]),
  rating_original: z.optional(z.union([z.number(), z.string(), z.null()])),
  rating_moderated: z.optional(z.union([z.number(), z.string(), z.null()])),
  opening_times: z.string(),
  time_categories_json: z.string(),
  hits_json: z.string(),
  misses_json: z.string(),
  youtube_title: z.string(),
  youtube_video_url: z.optional(z.union([z.string(), z.null()])),
  youtube_video_id: z.optional(z.union([z.string(), z.null()])),
  google_maps_name: z.string(),
  awards_json: z.string(),
  status: z.union([z.literal('active'), z.literal('closed')]),
  source_rank: z.union([z.number(), z.string()]),
  source_sheet_hash: z.optional(z.union([z.string(), z.null()])),
  source_youtube_hash: z.optional(z.union([z.string(), z.null()])),
  created_at: z.string(),
  last_synced_at: z.string(),
});

function parseNumeric(input: unknown): number | null {
  if (input === null || input === undefined || input === '') {
    return null;
  }

  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

function parseNumericOrFallback(input: unknown, fallback: number): number {
  const parsed = parseNumeric(input);
  return parsed === null ? fallback : parsed;
}

function parseStringArray(value: string): Result<string[], Error> {
  const parsedResult = Result.try(() => JSON.parse(value));
  if (Result.isError(parsedResult)) {
    return Result.err(new Error('Invalid JSON array payload.'));
  }

  const arraySchema = z.array(z.string());
  const parsedArray = arraySchema.safeParse(parsedResult.value);
  if (!parsedArray.success) {
    return Result.err(new Error('Invalid string array payload.'));
  }

  return Result.ok(parsedArray.data);
}

function parseTimeCategoryArray(value: string, openingTimes: string): TimeCategory[] {
  const parsed = parseStringArray(value);
  if (Result.isError(parsed)) {
    return parseTimeCategories(openingTimes);
  }

  const list = parsed.value;
  const allowedSet = new Set<TimeCategory>([
    'early-morning',
    'lunch',
    'dinner',
    'late-night',
    'all-day',
  ]);

  const filtered = list.filter((item): item is TimeCategory => allowedSet.has(item as TimeCategory));
  return filtered.length > 0 ? filtered : parseTimeCategories(openingTimes);
}

export function mapDbRowToStall(row: unknown): Result<Stall, Error> {
  const parsed = dbStallRowSchema.safeParse(row);
  if (!parsed.success) {
    return Result.err(new Error('Invalid stall row returned from database.'));
  }

  const rowValue = parsed.data;
  const hitsResult = parseStringArray(rowValue.hits_json);
  if (Result.isError(hitsResult)) {
    return Result.err(hitsResult.error);
  }

  const missesResult = parseStringArray(rowValue.misses_json);
  if (Result.isError(missesResult)) {
    return Result.err(missesResult.error);
  }

  const awardsResult = parseStringArray(rowValue.awards_json);
  if (Result.isError(awardsResult)) {
    return Result.err(awardsResult.error);
  }

  const timeCategories = parseTimeCategoryArray(rowValue.time_categories_json, rowValue.opening_times);
  const price = parseNumericOrFallback(rowValue.price, 0);
  const ratingOriginal = parseNumeric(rowValue.rating_original);
  const ratingModerated = parseNumeric(rowValue.rating_moderated);
  const episodeNumber = parseNumeric(rowValue.episode_number);
  const lat = parseNumeric(rowValue.primary_lat) ?? 0;
  const lng = parseNumeric(rowValue.primary_lng) ?? 0;

  return Result.ok({
    slug: rowValue.slug,
    cuisine: rowValue.cuisine,
    cuisineLabel: rowValue.cuisine_label,
    country: rowValue.country,
    episodeNumber,
    name: rowValue.name,
    address: rowValue.primary_address,
    openingTimes: rowValue.opening_times,
    timeCategories,
    dishName: rowValue.dish_name,
    price,
    ratingOriginal,
    ratingModerated,
    hits: hitsResult.value,
    misses: missesResult.value,
    youtubeTitle: rowValue.youtube_title,
    youtubeVideoUrl: rowValue.youtube_video_url || undefined,
    youtubeVideoId: rowValue.youtube_video_id || undefined,
    googleMapsName: rowValue.google_maps_name,
    awards: awardsResult.value,
    lat,
    lng,
    addedAt: rowValue.created_at,
    lastScrapedAt: rowValue.last_synced_at,
  });
}
