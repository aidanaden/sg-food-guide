import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Stall } from '../data/shared';

vi.mock('../server/stalls/read.functions', () => ({
  getAllStalls: vi.fn(),
  getStallsByCuisine: vi.fn(),
  getStallBySlug: vi.fn(),
}));

import {
  loadCuisineRouteData,
  loadHomeRouteData,
  loadStallRouteData,
} from './route-loaders';
import {
  getAllStalls,
  getStallBySlug,
  getStallsByCuisine,
} from '../server/stalls/read.functions';

function makeStall(overrides: Partial<Stall> = {}): Stall {
  return {
    slug: 'bari-uma',
    cuisine: 'japanese',
    cuisineLabel: 'Japanese',
    country: 'SG',
    episodeNumber: 12,
    name: 'Bari Uma',
    address: '123 Orchard Road',
    openingTimes: '11am - 9pm',
    timeCategories: ['lunch', 'dinner'],
    dishName: 'Tonkotsu Ramen',
    price: 12,
    ratingOriginal: 3,
    ratingModerated: 3,
    hits: ['Broth depth'],
    misses: [],
    youtubeTitle: 'Best ramen in SG',
    youtubeVideoUrl: 'https://www.youtube.com/watch?v=abc123abc12',
    youtubeVideoId: 'abc123abc12',
    googleMapsName: 'Bari Uma',
    awards: [],
    lat: 1.3,
    lng: 103.8,
    addedAt: '2026-02-01T00:00:00.000Z',
    lastScrapedAt: '2026-02-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('loader-data', () => {
  const getAllStallsMock = vi.mocked(getAllStalls);
  const getStallsByCuisineMock = vi.mocked(getStallsByCuisine);
  const getStallBySlugMock = vi.mocked(getStallBySlug);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads home route data for /', async () => {
    const nowIso = '2026-02-23T00:00:00.000Z';
    const stalls = [makeStall(), makeStall({ slug: 'second-stall', name: 'Second Stall' })];
    getAllStallsMock.mockResolvedValue(stalls);

    const result = await loadHomeRouteData(nowIso);

    expect(result).toEqual({
      stalls,
      generatedAt: nowIso,
    });
  });

  it('returns null for invalid /cuisine/:cuisine params', async () => {
    const result = await loadCuisineRouteData({ cuisine: '' }, '2026-02-23T00:00:00.000Z');
    expect(result).toBeNull();
  });

  it('returns cuisine route data for /cuisine/:cuisine', async () => {
    const nowIso = '2026-02-23T00:00:00.000Z';
    const cuisineStalls = [
      makeStall({ cuisine: 'japanese', cuisineLabel: 'Japanese', slug: 'jpn-1' }),
      makeStall({ cuisine: 'japanese', cuisineLabel: 'Japanese', slug: 'jpn-2', name: 'JPN 2' }),
    ];
    getStallsByCuisineMock.mockResolvedValue(cuisineStalls);

    const result = await loadCuisineRouteData({ cuisine: 'japanese' }, nowIso);

    expect(result).toEqual({
      cuisineId: 'japanese',
      cuisineLabel: 'Japanese',
      cuisineStalls,
      generatedAt: nowIso,
    });
  });

  it('returns null when /cuisine/:cuisine has no stalls', async () => {
    getStallsByCuisineMock.mockResolvedValue([]);

    const result = await loadCuisineRouteData({ cuisine: 'unknown' }, '2026-02-23T00:00:00.000Z');

    expect(result).toBeNull();
  });

  it('returns null for invalid /stall/:slug params', async () => {
    const result = await loadStallRouteData({ slug: '' }, '2026-02-23T00:00:00.000Z');
    expect(result).toBeNull();
  });

  it('returns stall route data for /stall/:slug', async () => {
    const nowIso = '2026-02-23T00:00:00.000Z';
    const stall = makeStall({ slug: 'bari-uma' });
    getStallBySlugMock.mockResolvedValue(stall);

    const result = await loadStallRouteData({ slug: 'bari-uma' }, nowIso);

    expect(result).toEqual({
      stall,
      generatedAt: nowIso,
    });
  });

  it('returns null when /stall/:slug does not exist', async () => {
    getStallBySlugMock.mockResolvedValue(null);

    const result = await loadStallRouteData({ slug: 'missing' }, '2026-02-23T00:00:00.000Z');

    expect(result).toBeNull();
  });
});
