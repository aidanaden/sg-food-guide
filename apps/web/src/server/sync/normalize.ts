import { Result } from 'better-result';
import { createHash } from 'node:crypto';

import { slugify } from '../../data/shared';

const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeComparableText(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

export function normalizeDisplayText(value: string): string {
  return normalizeWhitespace(value);
}

export function normalizeIdentityText(value: string): string {
  return normalizeComparableText(value)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

export function makeStableHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function makeStallSourceKey(name: string, country: string, cuisine: string): string {
  const namePart = normalizeIdentityText(name);
  const cuisinePart = normalizeIdentityText(cuisine);
  const countryPart = normalizeDisplayText(country).toUpperCase();

  return `${namePart}|${countryPart}|${cuisinePart}`;
}

export function makeStallIdFromSourceKey(sourceKey: string): string {
  return `stall_${makeStableHash(sourceKey).slice(0, 24)}`;
}

export function makeLocationId(stallId: string, address: string): string {
  return `loc_${makeStableHash(`${stallId}|${normalizeComparableText(address)}`).slice(0, 24)}`;
}

function isAllowedYouTubeHostname(hostname: string): boolean {
  return (
    hostname === 'youtube.com' ||
    hostname.endsWith('.youtube.com') ||
    hostname === 'youtube-nocookie.com' ||
    hostname.endsWith('.youtube-nocookie.com')
  );
}

export function normalizeYouTubeVideoId(value: string | null | undefined): string | null {
  const input = value?.trim();
  if (!input) {
    return null;
  }

  if (YOUTUBE_VIDEO_ID_RE.test(input)) {
    return input;
  }

  const urlResult = Result.try(() => new URL(input));
  if (Result.isError(urlResult)) {
    return null;
  }

  const hostname = urlResult.value.hostname.replace(/^www\./, '');
  let candidate = '';

  if (hostname === 'youtu.be') {
    candidate =
      urlResult.value.pathname.split('/').find((segment) => segment.length > 0) || '';
  } else if (isAllowedYouTubeHostname(hostname)) {
    candidate = urlResult.value.searchParams.get('v') || '';
    if (!candidate) {
      const segments = urlResult.value.pathname
        .split('/')
        .filter((segment) => segment.length > 0);
      if (segments[0] === 'embed' || segments[0] === 'shorts' || segments[0] === 'live') {
        candidate = segments[1] || '';
      }
    }
  }

  return candidate && YOUTUBE_VIDEO_ID_RE.test(candidate) ? candidate : null;
}

export function buildYouTubeVideoUrl(videoIdOrUrl: string | null | undefined): string | null {
  const id = normalizeYouTubeVideoId(videoIdOrUrl);
  if (!id) {
    return null;
  }

  return `https://www.youtube.com/watch?v=${id}`;
}

export function deriveSlug(name: string, sourceKey: string): string {
  const base = slugify(name);
  if (base.length > 0) {
    return base;
  }

  return `stall-${makeStableHash(sourceKey).slice(0, 12)}`;
}

export function safeJsonStringify(value: unknown): string {
  return JSON.stringify(value);
}

export function infoScore(input: {
  openingTimes: string;
  dishName: string;
  youtubeVideoUrl: string | null;
  hits: string[];
  misses: string[];
  awards: string[];
  ratingModerated: number | null;
  ratingOriginal: number | null;
}): number {
  let score = 0;
  if (input.openingTimes.trim().length > 0) score += 1;
  if (input.dishName.trim().length > 0) score += 1;
  if (input.youtubeVideoUrl) score += 2;
  if (input.hits.length > 0) score += 1;
  if (input.misses.length > 0) score += 1;
  if (input.awards.length > 0) score += 1;
  if (input.ratingModerated !== null) score += 1;
  if (input.ratingOriginal !== null) score += 1;

  return score;
}
