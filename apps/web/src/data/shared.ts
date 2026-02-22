export type Country = 'SG' | 'MY' | 'TH' | 'HK' | 'CN' | 'JP' | 'ID';

export const countryLabels: Record<Country, string> = {
  SG: 'Singapore',
  MY: 'Malaysia',
  TH: 'Thailand',
  HK: 'Hong Kong',
  CN: 'China',
  JP: 'Japan',
  ID: 'Indonesia',
};

export type TimeCategory = 'early-morning' | 'lunch' | 'dinner' | 'late-night' | 'all-day';

export const timeCategoryLabels: Record<TimeCategory, string> = {
  'early-morning': 'Early Morning',
  'lunch': 'Lunch',
  'dinner': 'Dinner',
  'late-night': 'Late Night',
  'all-day': 'All Day',
};

export const timeCategoryIcons: Record<TimeCategory, string> = {
  'early-morning': 'iconify ph--sun-horizon',
  'lunch': 'iconify ph--sun',
  'dinner': 'iconify ph--moon-stars',
  'late-night': 'iconify ph--moon',
  'all-day': 'iconify ph--clock',
};

export interface Stall {
  slug: string;
  cuisine: string;
  cuisineLabel: string;
  country: Country;
  episodeNumber: number | null;
  name: string;
  address: string;
  openingTimes: string;
  timeCategories: TimeCategory[];
  dishName: string;
  price: number;
  // Canonical rating contract: integer 0..3 or null.
  // 0/1 = Skip, 2 = Worth Trying, 3 = Must Try, null = Unrated.
  ratingOriginal: number | null;
  ratingModerated: number | null;
  hits: string[];
  misses: string[];
  youtubeTitle: string;
  youtubeVideoId?: string;
  googleMapsName: string;
  awards: string[];
  lat: number;
  lng: number;
  addedAt?: string;
  lastScrapedAt?: string;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** Parse opening times into time categories */
export function parseTimeCategories(times: string): TimeCategory[] {
  const cats: Set<TimeCategory> = new Set();
  const t = times.toLowerCase();

  // Parse opening hour
  const openMatch = t.match(/(\d{1,2})(?:\.(\d{2}))?\s*(am|pm)/);
  let openHour = 0;
  if (openMatch) {
    openHour = parseInt(openMatch[1] ?? '0', 10);
    const openPeriod = openMatch[3] ?? '';
    if (openPeriod === 'pm' && openHour !== 12) openHour += 12;
    if (openPeriod === 'am' && openHour === 12) openHour = 0;
  }

  // Parse closing hour - find last time mentioned
  const allTimes = [...t.matchAll(/(\d{1,2})(?:\.(\d{2}))?\s*(am|pm|mn)/g)];
  let closeHour = openHour;
  if (allTimes.length > 0) {
    const last = allTimes[allTimes.length - 1];
    if (last) {
      closeHour = parseInt(last[1] ?? '0', 10);
    }
    const closePeriod = last?.[3] ?? '';
    if (closePeriod === 'pm' && closeHour !== 12) closeHour += 12;
    if (closePeriod === 'am' && closeHour === 12) closeHour = 0;
    if (closePeriod === 'mn' || t.includes('12mn') || t.includes('midnight')) closeHour = 24;
    // Handles spans that cross midnight (e.g. 6pm-2am) so late-night/all-day rules still work.
    if (allTimes.length >= 2 && closeHour < openHour) closeHour += 24;
  }

  // Categorize
  if (openHour < 9) cats.add('early-morning');
  if ((openHour <= 11 && closeHour >= 14) || (openHour <= 12 && closeHour >= 13)) cats.add('lunch');
  if ((openHour <= 17 && closeHour >= 20) || (openHour >= 16 && closeHour >= 20)) cats.add('dinner');
  if (closeHour >= 22 || t.includes('12mn') || t.includes('midnight')) cats.add('late-night');
  if (closeHour - openHour >= 8) cats.add('all-day');

  // Fallback: if no categories detected, check for "daily"
  if (cats.size === 0 && t.includes('daily')) cats.add('all-day');
  if (cats.size === 0) cats.add('lunch'); // safe fallback

  return [...cats];
}
