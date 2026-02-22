import { Result } from 'better-result';

import {
  type Country,
  countryLabels,
  type Stall,
  type TimeCategory,
  timeCategoryLabels,
  timeCategoryIcons,
} from '../data/shared';

export type { Country, Stall, TimeCategory };
export { countryLabels, timeCategoryIcons, timeCategoryLabels };

export type RatingLabel = 'Skip' | 'Worth Trying' | 'Must Try' | 'Unrated';

export function getRatingLabel(rating: number | null): RatingLabel {
  if (rating === null) return 'Unrated';
  if (rating >= 3) return 'Must Try';
  if (rating === 2) return 'Worth Trying';
  return 'Skip';
}

export function getRatingVariant(rating: number | null): 'rating-0' | 'rating-1' | 'rating-2' | 'rating-3' {
  if (rating === null) return 'rating-0';
  if (!Number.isFinite(rating)) return 'rating-0';
  const normalized = Math.max(0, Math.min(3, Math.round(rating)));
  return `rating-${normalized}` as 'rating-0' | 'rating-1' | 'rating-2' | 'rating-3';
}

export function getCountries(stallList: Stall[]): Country[] {
  return [...new Set(stallList.map((stall) => stall.country))].sort();
}

export function getGoogleMapsUrl(name: string, address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`;
}

export function getYouTubeSearchUrl(title: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`;
}

const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const SQLITE_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

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
  if (!input) return null;

  if (YOUTUBE_VIDEO_ID_RE.test(input)) return input;

  const urlResult = Result.try(() => new URL(input));
  if (Result.isError(urlResult)) return null;

  const url = urlResult.value;
  const hostname = url.hostname.replace(/^www\./, '');
  let candidate = '';

  if (hostname === 'youtu.be') {
    candidate = url.pathname.split('/').find((segment) => segment.length > 0) || '';
  } else if (isAllowedYouTubeHostname(hostname)) {
    candidate = url.searchParams.get('v') || '';
    if (!candidate) {
      const segments = url.pathname.split('/').filter((segment) => segment.length > 0);
      if (segments[0] === 'embed' || segments[0] === 'shorts' || segments[0] === 'live') {
        candidate = segments[1] || '';
      }
    }
  }

  return candidate && YOUTUBE_VIDEO_ID_RE.test(candidate) ? candidate : null;
}

export function getYouTubeEmbedUrl(videoId: string): string {
  const normalized = normalizeYouTubeVideoId(videoId);
  if (!normalized) return '';
  return `https://www.youtube-nocookie.com/embed/${normalized}`;
}

export function formatStallTimestamp(value: string | null | undefined): string {
  const input = value?.trim();
  if (!input) return 'Unknown';

  const normalized = SQLITE_TIMESTAMP_RE.test(input) ? `${input.replace(' ', 'T')}Z` : input;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  const hour = String(parsed.getUTCHours()).padStart(2, '0');
  const minute = String(parsed.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute} UTC`;
}

export function getStallArea(stall: Stall): string {
  if (stall.country !== 'SG') return countryLabels[stall.country];
  const address = stall.address.toLowerCase();
  if (address.includes('bukit batok') || address.includes('jurong') || address.includes('clementi') || address.includes('west coast')) return 'West';
  if (address.includes('yishun') || address.includes('sembawang') || address.includes('woodlands') || address.includes('marsiling') || address.includes('ang mo kio') || address.includes('upper thomson')) return 'North';
  if (address.includes('serangoon') || address.includes('kovan') || address.includes('chomp chomp') || address.includes('hougang') || address.includes('sengkang') || address.includes('punggol')) return 'North-East';
  if (address.includes('geylang') || address.includes('e coast') || address.includes('east coast') || address.includes('siglap') || address.includes('bedok') || address.includes('changi') || address.includes('loyang') || address.includes('eunos') || address.includes('joo chiat') || address.includes('katong') || address.includes('onan rd') || address.includes('tanjong katong')) return 'East';
  if (address.includes('old airport') || address.includes('ubi rd')) return 'East';
  if (address.includes('toa payoh') || address.includes('bishan')) return 'Toa Payoh / Bishan';
  if (address.includes('seng poh') || address.includes('tiong bahru') || address.includes('bukit merah') || address.includes('kim tian') || address.includes('telok blangah') || address.includes('havelock') || address.includes('zion rd') || address.includes('alexandra')) return 'Tiong Bahru / Bukit Merah';
  if (address.includes('beach rd') || address.includes('golden mile') || address.includes('horne rd') || address.includes('hamilton rd') || address.includes('jalan berseh') || address.includes('crawford') || address.includes('lavender')) return 'Bugis / Beach Road';
  if (address.includes('upper cross') || address.includes('new bridge') || address.includes('smith st') || address.includes('maxwell') || address.includes('amoy') || address.includes('shenton') || address.includes('anson') || address.includes('raffles place') || address.includes('kadayanallur') || address.includes('cross st')) return 'CBD / Chinatown';
  if (address.includes('orchard') || address.includes('killiney') || address.includes('holland') || address.includes('bukit timah') || address.includes('vista exchange') || address.includes('sinaran')) return 'Orchard / Holland';
  if (address.includes('rangoon') || address.includes('foch rd') || address.includes('macpherson') || address.includes('tai thong') || address.includes('veerasamy') || address.includes('ghim moh') || address.includes('shunfu')) return 'Central';
  if (address.includes('airport blvd') || address.includes('jewel')) return 'Changi Airport';
  return 'Other';
}

export function getAreas(stallList: Stall[]): string[] {
  return [...new Set(stallList.map(getStallArea))].sort();
}

export function getCuisines(stallList: Stall[]): Array<{ id: string; label: string; count: number }> {
  const map = new Map<string, { label: string; count: number }>();
  for (const stall of stallList) {
    const existing = map.get(stall.cuisine);
    if (existing) {
      existing.count += 1;
      continue;
    }

    map.set(stall.cuisine, {
      label: stall.cuisineLabel,
      count: 1,
    });
  }

  return [...map.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => b.count - a.count);
}

export function getAllTimeCategories(stallList: Stall[]): TimeCategory[] {
  const categories = new Set<TimeCategory>();
  for (const stall of stallList) {
    for (const category of stall.timeCategories) {
      categories.add(category);
    }
  }

  return [...categories];
}
