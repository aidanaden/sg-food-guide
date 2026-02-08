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
  ratingOriginal: number | null;
  ratingModerated: number | null;
  hits: string[];
  misses: string[];
  youtubeTitle: string;
  googleMapsName: string;
  awards: string[];
  lat: number;
  lng: number;
}

export type TimeCategory = 'early-morning' | 'lunch' | 'dinner' | 'late-night' | 'all-day';

export const timeCategoryLabels: Record<TimeCategory, string> = {
  'early-morning': 'Early Morning',
  'lunch': 'Lunch',
  'dinner': 'Dinner',
  'late-night': 'Late Night',
  'all-day': 'All Day',
};

export const timeCategoryIcons: Record<TimeCategory, string> = {
  'early-morning': 'i-ph-sun-horizon',
  'lunch': 'i-ph-sun',
  'dinner': 'i-ph-moon-stars',
  'late-night': 'i-ph-moon',
  'all-day': 'i-ph-clock',
};

export type RatingLabel = 'Skip' | 'Worth Trying' | 'Must Try' | 'Unrated';

export function getRatingLabel(rating: number | null): RatingLabel {
  if (rating === null) return 'Unrated';
  if (rating >= 3) return 'Must Try';
  if (rating === 2) return 'Worth Trying';
  return 'Skip';
}

export function getRatingVariant(rating: number | null): 'rating-0' | 'rating-1' | 'rating-2' | 'rating-3' {
  if (rating === null) return 'rating-0';
  return `rating-${Math.min(rating, 3)}` as 'rating-1' | 'rating-2' | 'rating-3';
}

export function getCountries(stallList: Stall[] = stalls): Country[] {
  return [...new Set(stallList.map((s) => s.country))].sort();
}

export function getGoogleMapsUrl(name: string, address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`;
}

export function getYouTubeSearchUrl(title: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`;
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
    openHour = parseInt(openMatch[1]);
    if (openMatch[3] === 'pm' && openHour !== 12) openHour += 12;
    if (openMatch[3] === 'am' && openHour === 12) openHour = 0;
  }

  // Parse closing hour - find last time mentioned
  const allTimes = [...t.matchAll(/(\d{1,2})(?:\.(\d{2}))?\s*(am|pm|mn)/g)];
  let closeHour = 0;
  if (allTimes.length >= 2) {
    const last = allTimes[allTimes.length - 1];
    closeHour = parseInt(last[1]);
    if (last[3] === 'pm' && closeHour !== 12) closeHour += 12;
    if (last[3] === 'am' && closeHour === 12) closeHour = 0;
    if (last[3] === 'mn' || t.includes('12mn') || t.includes('midnight')) closeHour = 24;
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

/** Area extraction from address */
export function getStallArea(stall: Stall): string {
  if (stall.country !== 'SG') return countryLabels[stall.country];
  const a = stall.address.toLowerCase();
  // West
  if (a.includes('bukit batok') || a.includes('jurong') || a.includes('clementi') || a.includes('west coast')) return 'West';
  // North
  if (a.includes('yishun') || a.includes('sembawang') || a.includes('woodlands') || a.includes('marsiling') || a.includes('ang mo kio') || a.includes('upper thomson')) return 'North';
  // North-East
  if (a.includes('serangoon') || a.includes('kovan') || a.includes('chomp chomp') || a.includes('hougang') || a.includes('sengkang') || a.includes('punggol')) return 'North-East';
  // East
  if (a.includes('geylang') || a.includes('e coast') || a.includes('east coast') || a.includes('siglap') || a.includes('bedok') || a.includes('changi') || a.includes('loyang') || a.includes('eunos') || a.includes('joo chiat') || a.includes('katong') || a.includes('onan rd') || a.includes('tanjong katong')) return 'East';
  if (a.includes('old airport')) return 'East';
  if (a.includes('ubi rd')) return 'East';
  // Central - Toa Payoh / Bishan
  if (a.includes('toa payoh') || a.includes('bishan')) return 'Toa Payoh / Bishan';
  // Central - Tiong Bahru / Bukit Merah
  if (a.includes('seng poh') || a.includes('tiong bahru') || a.includes('bukit merah') || a.includes('kim tian') || a.includes('telok blangah') || a.includes('havelock') || a.includes('zion rd') || a.includes('alexandra')) return 'Tiong Bahru / Bukit Merah';
  // Central - Beach Road / Bugis / Golden Mile
  if (a.includes('beach rd') || a.includes('golden mile') || a.includes('horne rd') || a.includes('hamilton rd') || a.includes('jalan berseh') || a.includes('crawford') || a.includes('lavender')) return 'Bugis / Beach Road';
  // Central - CBD / Chinatown
  if (a.includes('upper cross') || a.includes('new bridge') || a.includes('smith st') || a.includes('maxwell') || a.includes('amoy') || a.includes('shenton') || a.includes('anson') || a.includes('raffles place') || a.includes('kadayanallur') || a.includes('cross st')) return 'CBD / Chinatown';
  // Central - Orchard / Newton
  if (a.includes('orchard') || a.includes('killiney') || a.includes('holland') || a.includes('bukit timah') || a.includes('vista exchange') || a.includes('sinaran')) return 'Orchard / Holland';
  // Central - others
  if (a.includes('rangoon') || a.includes('foch rd') || a.includes('macpherson') || a.includes('tai thong') || a.includes('veerasamy')) return 'Central';
  if (a.includes('ghim moh') || a.includes('shunfu')) return 'Central';
  if (a.includes('airport blvd') || a.includes('jewel')) return 'Changi Airport';
  return 'Other';
}

export function getAreas(stallList: Stall[] = stalls): string[] {
  return [...new Set(stallList.map(getStallArea))].sort();
}

export function getCuisines(): { id: string; label: string; count: number }[] {
  const map = new Map<string, { label: string; count: number }>();
  for (const s of stalls) {
    const existing = map.get(s.cuisine);
    if (existing) {
      existing.count++;
    } else {
      map.set(s.cuisine, { label: s.cuisineLabel, count: 1 });
    }
  }
  return [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.count - a.count);
}

export function getStallsByCuisine(cuisine: string): Stall[] {
  return stalls.filter((s) => s.cuisine === cuisine);
}

export function getAllTimeCategories(): TimeCategory[] {
  const all = new Set<TimeCategory>();
  for (const s of stalls) s.timeCategories.forEach((c) => all.add(c));
  return [...all];
}

// ─── Imports from per-cuisine data files ─────────────────────
import { prawnMeeStalls } from './cuisines/prawn-mee';
import { bakChorMeeStalls } from './cuisines/bak-chor-mee';
import { bakKutTehStalls } from './cuisines/bak-kut-teh';
import { wantonMeeStalls } from './cuisines/wanton-mee';
import { malaStalls } from './cuisines/mala';
import { laksaStalls } from './cuisines/laksa';
import { nasiLemakStalls } from './cuisines/nasi-lemak';
import { ramenStalls } from './cuisines/ramen';
import { charKwayTeowStalls } from './cuisines/char-kway-teow';

// ─── Hokkien Mee (inline, original data) ─────────────────────

const hokkienMeeStalls: Stall[] = [
  {
    slug: slugify('Geylang Lor 29 Hokkien Mee'),
    cuisine: 'hokkien-mee', cuisineLabel: 'Hokkien Mee',
    country: 'SG',
    episodeNumber: 1,
    name: 'Geylang Lor 29 Hokkien Mee',
    address: '936 E Coast Rd, Singapore 459129',
    openingTimes: '11.30am–7.30pm, closed on Mondays',
    timeCategories: parseTimeCategories('11.30am–7.30pm'),
    dishName: 'Fried Hokkien Mee',
    price: 10, ratingOriginal: 2, ratingModerated: 2,
    hits: ['Amazing, well-balanced flavor'],
    misses: ['Small portions', 'Lack of wok hei'],
    youtubeTitle: 'Geylang Lorong 29 Fried Hokkien Mee Review | The Best Hokkien Mee in Singapore Ep 1',
    googleMapsName: 'Siglap 936 Food House',
    awards: [],
    lat: 1.3124, lng: 103.9240,
  },
  {
    slug: slugify('The Neighbourwok'),
    cuisine: 'hokkien-mee', cuisineLabel: 'Hokkien Mee',
    country: 'SG',
    episodeNumber: 2,
    name: 'The Neighbourwok',
    address: '177 Bukit Batok West Ave. 8, Get Together Coffeeshop, Singapore 650177',
    openingTimes: '11am–2.30pm, 4–8.30pm, closed on Mondays',
    timeCategories: parseTimeCategories('11am–2.30pm, 4–8.30pm'),
    dishName: 'Fried Hokkien Prawn Mee',
    price: 6, ratingOriginal: 1, ratingModerated: 1,
    hits: ['Nice flavor', 'Great value', 'Spot on chilli'],
    misses: ['Needs more seafood flavor', 'Excess starch', 'Very likely that I got an off-plate'],
    youtubeTitle: 'The Neighbourwok Review | The Best Hokkien Mee in Singapore Ep 2',
    googleMapsName: 'THE NEIGHBOURWOK',
    awards: [],
    lat: 1.3463, lng: 103.7419,
  },
  {
    slug: slugify('Yong Heng Fried Squid Prawn Mee'),
    cuisine: 'hokkien-mee', cuisineLabel: 'Hokkien Mee',
    country: 'SG',
    episodeNumber: 3,
    name: 'Yong Heng Fried Squid Prawn Mee',
    address: '155 Bukit Batok Street 11, Singapore 650155',
    openingTimes: '10.30am–9.30pm',
    timeCategories: parseTimeCategories('10.30am–9.30pm'),
    dishName: 'Fried Squid Prawn Mee',
    price: 4.5, ratingOriginal: 3, ratingModerated: 2,
    hits: ['Strong prawn flavor', 'Free flow lard', 'Fragrant chilli'],
    misses: ['Too cheap XD', 'Too tasty (MSG)'],
    youtubeTitle: 'Yong Heng X 777 Fried Hokkien Prawn Mee Review | The Best Hokkien Mee in Singapore Ep 3',
    googleMapsName: 'Yong Heng Fried Squid Prawn Mee',
    awards: [],
    lat: 1.3480, lng: 103.7436,
  },
  {
    slug: slugify('777 Fried Hokkien Prawn Mee'),
    cuisine: 'hokkien-mee', cuisineLabel: 'Hokkien Mee',
    country: 'SG',
    episodeNumber: 3,
    name: '777 Fried Hokkien Prawn Mee',
    address: '155 Bukit Batok Street 11, Singapore 650155',
    openingTimes: '9am–9.30pm, closed on Wednesdays',
    timeCategories: parseTimeCategories('9am–9.30pm'),
    dishName: 'Fried Hokkien Prawn Mee',
    price: 4.5, ratingOriginal: 1, ratingModerated: 1,
    hits: ['Nice eggy flavor'],
    misses: ['Chilli tastes very raw, cleans out other flavors', 'Strong alkaline taste of noodles'],
    youtubeTitle: '',
    googleMapsName: '777 Fried Hokkien Prawn Mee',
    awards: [],
    lat: 1.3480, lng: 103.7436,
  },
  {
    slug: slugify('Xiao Di Fried Prawn Noodle'),
    cuisine: 'hokkien-mee', cuisineLabel: 'Hokkien Mee',
    country: 'SG',
    episodeNumber: 4,
    name: 'Xiao Di Fried Prawn Noodle',
    address: '153 Serangoon North Ave 1, #01-512, Singapore 550153',
    openingTimes: '10.30am–3pm, closed on Mondays',
    timeCategories: parseTimeCategories('10.30am–3pm'),
    dishName: 'Fried Hokkien Mee',
    price: 4.5, ratingOriginal: 3, ratingModerated: 3,
    hits: ['Incredible stock', 'Flavor-overful', 'Great texture on noodles and gravy'],
    misses: ['Small portion', 'Too tasty'],
    youtubeTitle: 'Xiao Di Fried Prawn Mee Review | The Best Hokkien Mee in Singapore Ep 4',
    googleMapsName: 'Xiao Di Fried Prawn Noodle (小弟炒虾面)',
    awards: ['TOP 3'],
    lat: 1.3700, lng: 103.8724,
  },
  {
    slug: slugify('Ah Hock Fried Hokkien Noodles'),
    cuisine: 'hokkien-mee', cuisineLabel: 'Hokkien Mee',
    country: 'SG',
    episodeNumber: 5,
    name: 'Ah Hock Fried Hokkien Noodles 亚福',
    address: '57 Garden Way, Chomp Chomp Food Centre, Serangoon Gardens',
    openingTimes: '5.30pm–12mn, closed on Mondays',
    timeCategories: parseTimeCategories('5.30pm–12mn'),
    dishName: 'Fried Hokkien Mee',
    price: 4, ratingOriginal: 1, ratingModerated: 1,
    hits: ['Great eggy flavor', 'Good texture with beehoon and chopped prawns', 'Fragrant, high quality chilli'],
    misses: ['Not my hokkien mee'],
    youtubeTitle: 'Ah Hock Fried Hokkien Mee Review | The Best Hokkien Mee in Singapore Ep 5',
    googleMapsName: 'Ah Hock Fried Hokkien Noodles 亚福',
    awards: [],
    lat: 1.3642, lng: 103.8665,
  },
  {
    slug: slugify('Nam Sing Hokkien Fried Mee'),
    cuisine: 'hokkien-mee', cuisineLabel: 'Hokkien Mee',
    country: 'SG',
    episodeNumber: 6,
    name: 'Nam Sing Hokkien Fried Mee',
    address: '51 Old Airport Rd, #01-32, Singapore 390051',
    openingTimes: '10am–6pm, closed on Mondays',
    timeCategories: parseTimeCategories('10am–6pm'),
    dishName: 'Hokkien Fried Mee',
    price: 5, ratingOriginal: 2, ratingModerated: 2,
    hits: ['Ample seafood flavor', 'Some creamy, fatty flavor', 'Good amount of ingredients', 'Good texture'],
    misses: ['Cut chilli', 'No lard'],
    youtubeTitle: 'Nam Sing Hokkien Fried Mee Review | The Best Hokkien Mee in Singapore Ep 6',
    googleMapsName: 'Nam Sing Hokkien Fried Mee',
    awards: [],
    lat: 1.3081, lng: 103.8858,
  },
  {
    slug: slugify('Yi Ji Fried Hokkien Prawn Mee'),
    cuisine: 'hokkien-mee', cuisineLabel: 'Hokkien Mee',
    country: 'SG',
    episodeNumber: 6,
    name: 'Yi Ji Fried Hokkien Prawn Mee',
    address: '51 Old Airport Rd, #01-102, Singapore 390051',
    openingTimes: '2–10pm, closed on Mondays',
    timeCategories: parseTimeCategories('2–10pm'),
    dishName: 'Fried Hokkien Mee',
    price: 5, ratingOriginal: 1, ratingModerated: 1,
    hits: ['Very tasty'],
    misses: ['Mock abalone gives an off stock flavor', 'Insanely spicy chilli with little to no taste'],
    youtubeTitle: '',
    googleMapsName: 'Yi Ji Fried Hokkien Prawn Mee',
    awards: [],
    lat: 1.3081, lng: 103.8858,
  },
  {
    slug: slugify('Simon Road Hokkien Mee'),
    cuisine: 'hokkien-mee', cuisineLabel: 'Hokkien Mee',
    country: 'SG',
    episodeNumber: 7,
    name: 'Simon Road Hokkien Mee',
    address: 'Kovan 209 Market and Food Centre #01-66',
    openingTimes: '11am–8.30pm, closed on Mondays',
    timeCategories: parseTimeCategories('11am–8.30pm'),
    dishName: 'Fried Hokkien Prawn Mee',
    price: 5, ratingOriginal: 3, ratingModerated: 3,
    hits: ['Proper dry version', 'Perfect oiliness', 'Wok hei', '2 chillies', 'Both versions very flavorful'],
    misses: ['Say no to bribery', 'Could be a bit wetter'],
    youtubeTitle: 'Simon Road Hokkien Mee Review | The Best Hokkien Mee in Singapore Ep 7',
    googleMapsName: 'Kovan 209 Market and Food Centre',
    awards: ['SPECIAL MENTION FOR SIGNATURE DRY VERSION'],
    lat: 1.3590, lng: 103.8861,
  },
  {
    slug: slugify('You Fu Fried Hokkien Prawn Noodle'),
    cuisine: 'hokkien-mee', cuisineLabel: 'Hokkien Mee',
    country: 'SG',
    episodeNumber: 8,
    name: 'You Fu Fried Hokkien Prawn Noodle',
    address: '505 Beach Rd, #01-57, Singapore 199583',
    openingTimes: '11.30am–8pm daily',
    timeCategories: parseTimeCategories('11.30am–8pm'),
    dishName: 'Fried Hokkien Prawn Mee',
    price: 5, ratingOriginal: 3, ratingModerated: 2,
    hits: ['Very nice seafood flavor', 'Well crafted chilli that complements well'],
    misses: ['Tastes more like a seafood beehoon dish'],
    youtubeTitle: 'Golden Mile Hainan x YouFu Hokkien Mee Review | The Best Hokkien Mee in Singapore Ep 8',
    googleMapsName: 'You Fu (Golden Mile Outlet)',
    awards: [],
    lat: 1.3032, lng: 103.8638,
  },
  {
    slug: slugify('Hainan Fried Hokkien Prawn Mee'),
    cuisine: 'hokkien-mee', cuisineLabel: 'Hokkien Mee',
    country: 'SG',
    episodeNumber: 8,
    name: 'Hainan Fried Hokkien Prawn Mee',
    address: '505 Beach Rd, #B1-34 Golden Mile Food Center, Singapore 199583',
    openingTimes: '10am–5pm, closed on Wednesdays',
    timeCategories: parseTimeCategories('10am–5pm'),
    dishName: 'Fried Hokkien Prawn Mee',
    price: 5, ratingOriginal: 3, ratingModerated: 3,
    hits: ['Spot on flavor', 'Good texture', 'Homemade chilli'],
    misses: ['Very little noodles', 'Cute prawns'],
    youtubeTitle: '',
    googleMapsName: '海南福建炒虾麵 Hainan Fried Hokkien Prawn Mee',
    awards: ['BEST DRY VERSION'],
    lat: 1.3032, lng: 103.8638,
  },
  {
    slug: slugify('Hokkien Man Hokkien Mee'),
    cuisine: 'hokkien-mee', cuisineLabel: 'Hokkien Mee',
    country: 'SG',
    episodeNumber: 9,
    name: 'Hokkien Man Hokkien Mee',
    address: '19 Lor 7 Toa Payoh, Block 19, Singapore 310019',
    openingTimes: '10am–2.30pm, closed on Wednesdays',
    timeCategories: parseTimeCategories('10am–2.30pm'),
    dishName: 'Fried Hokkien Prawn Mee',
    price: 6, ratingOriginal: 2, ratingModerated: 2,
    hits: ['Great use of lard', 'Good taste and texture', 'Expert handling throughout', 'Good value'],
    misses: ['Too sweet for me'],
    youtubeTitle: 'Hokkien Man Hokkien Mee Review | The Best Hokkien Mee in Singapore Ep 9',
    googleMapsName: 'Hokkien Man Hokkien Mee',
    awards: [],
    lat: 1.3352, lng: 103.8565,
  },
  {
    slug: slugify('Eng Ho Fried Hokkien Mee'),
    cuisine: 'hokkien-mee', cuisineLabel: 'Hokkien Mee',
    country: 'SG',
    episodeNumber: 10,
    name: '榮和 Eng Ho Fried Hokkien Mee',
    address: '409 Ang Mo Kio Ave 10, #01-34, Singapore 560409',
    openingTimes: '4pm–10.30pm, closed on Mondays and Tuesdays',
    timeCategories: parseTimeCategories('4pm–10.30pm'),
    dishName: 'Fried Hokkien Prawn Mee',
    price: 5, ratingOriginal: 3, ratingModerated: 3,
    hits: ['Great flavor with strong prawn accent', 'Nicely melded hokkien mee taste'],
    misses: [],
    youtubeTitle: '榮和 Eng Ho Fried Hokkien Mee Review | The Best Hokkien Mee in Singapore Ep 10',
    googleMapsName: '榮和 Eng Ho Fried Hokkien Mee',
    awards: [],
    lat: 1.3627, lng: 103.8553,
  },
  {
    slug: slugify('Hong Heng Fried Sotong Prawn Mee'),
    cuisine: 'hokkien-mee', cuisineLabel: 'Hokkien Mee',
    country: 'SG',
    episodeNumber: 11,
    name: 'Hong Heng Fried Sotong Prawn Mee 鸿興炒蘇東蝦麵',
    address: '30 Seng Poh Rd, #02-01, Singapore 168898',
    openingTimes: '10.30am–2.30pm, 4.30–6.30pm, closed on Mondays and Sundays',
    timeCategories: parseTimeCategories('10.30am–2.30pm, 4.30–6.30pm'),
    dishName: 'Fried Sotong Prawn Mee',
    price: 5, ratingOriginal: 3, ratingModerated: 2,
    hits: ['Quintessential example of hokkien mee', 'Properly melded flavor profile'],
    misses: ['Pretty strong alkaline taste of noodles', 'No surprises'],
    youtubeTitle: 'Hong Heng Fried Sotong Prawn Mee 鸿興炒蘇東蝦麵 Review | The Best Hokkien Mee in Singapore Ep 11',
    googleMapsName: 'Hong Heng Fried Sotong Prawn Mee 鸿興炒蘇東蝦麵',
    awards: [],
    lat: 1.2847, lng: 103.8324,
  },
  {
    slug: slugify('Come Daily Fried Hokkien Prawn Mee'),
    cuisine: 'hokkien-mee', cuisineLabel: 'Hokkien Mee',
    country: 'SG',
    episodeNumber: 12,
    name: 'Come Daily Fried Hokkien Prawn Mee',
    address: '127 Lor 1 Toa Payoh, #02-27, Singapore 310127',
    openingTimes: '8am–2.30pm, closed on Mondays and Tuesdays',
    timeCategories: parseTimeCategories('8am–2.30pm'),
    dishName: 'Fried Hokkien Prawn Mee',
    price: 5, ratingOriginal: 3, ratingModerated: 3,
    hits: ['Well-represented 3 pillars of hokkien mee', 'Great texture of noodles', 'Perfect broth consistency', 'Well-balanced, rich but not cloy'],
    misses: ['Probably have to come daily'],
    youtubeTitle: 'Come Daily Fried Hokkien Prawn Mee Review | The Best Hokkien Mee in Singapore Ep 12',
    googleMapsName: 'Come Daily Fried Hokkien Prawn Mee 天天来炒福建虾面',
    awards: ['TOP 3'],
    lat: 1.3381, lng: 103.8447,
  },
  {
    slug: slugify('Swee Guan Hokkien Mee'),
    cuisine: 'hokkien-mee', cuisineLabel: 'Hokkien Mee',
    country: 'SG',
    episodeNumber: 13,
    name: 'Swee Guan Hokkien Mee',
    address: '5 Lor 29 Geylang, Singapore 388060',
    openingTimes: '5pm–10pm, closed on Wednesdays',
    timeCategories: parseTimeCategories('5pm–10pm'),
    dishName: 'Fried Hokkien Prawn Mee',
    price: 10, ratingOriginal: 3, ratingModerated: 3,
    hits: ['Creamy intense flavor', 'A lot of ingredients', 'Nice smokiness', 'Has all the authentic frills'],
    misses: ['Would have liked more noodles'],
    youtubeTitle: 'Swee Guan Hokkien Mee Review | The Best Hokkien Mee in Singapore Ep 13',
    googleMapsName: 'Swee Guan Hokkien Mee',
    awards: ['TOP 3', 'MOST AUTHENTIC TASTING', 'BEST HOKKIEN MEE IN SINGAPORE'],
    lat: 1.3151, lng: 103.8859,
  },
];

// ─── Combined Stall Data ─────────────────────────────────────
export const stalls: Stall[] = [
  ...hokkienMeeStalls,
  ...prawnMeeStalls,
  ...bakChorMeeStalls,
  ...bakKutTehStalls,
  ...wantonMeeStalls,
  ...malaStalls,
  ...laksaStalls,
  ...nasiLemakStalls,
  ...ramenStalls,
  ...charKwayTeowStalls,
];
