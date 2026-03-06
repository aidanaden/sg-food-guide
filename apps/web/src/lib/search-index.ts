import Fuse from "fuse.js";

import {
  type Stall,
  getStallArea,
  stalls as allStalls,
} from "#/data/stalls";

/** Search result item types */
export type SearchResultType = "stall" | "cuisine" | "location";

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  slug: string;
}

/** Searchable item for Fuse.js */
interface SearchableItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  slug: string;
  stall?: Stall;
  weight: number;
}

/** All unique areas from data */
const AREAS = [
  "West",
  "North",
  "North-East",
  "East",
  "Central",
  "Singapore",
  "Malaysia",
  "Thailand",
  "Hong Kong",
  "China",
  "Japan",
  "Indonesia",
];

/** Get all unique cuisine labels from stalls */
function getCuisineLabels(): { id: string; label: string }[] {
  const cuisines = new Map<string, string>();
  for (const stall of allStalls) {
    if (!cuisines.has(stall.cuisine)) {
      cuisines.set(stall.cuisine, stall.cuisineLabel);
    }
  }
  return Array.from(cuisines.entries()).map(([id, label]) => ({
    id: `cuisine-${id}`,
    label,
  }));
}

/** Build searchable items from stalls */
function buildStallItems(): SearchableItem[] {
  return allStalls.map((stall) => ({
    id: `stall-${stall.slug}`,
    type: "stall" as SearchResultType,
    title: stall.name,
    subtitle: `${stall.cuisineLabel} • ${getStallArea(stall)}`,
    slug: stall.slug,
    stall,
    weight: 2, // Higher weight for stall names
  }));
}

/** Build searchable items from cuisines */
function buildCuisineItems(): SearchableItem[] {
  return getCuisineLabels().map((c) => ({
    id: c.id,
    type: "cuisine" as SearchResultType,
    title: c.label,
    slug: c.id.replace("cuisine-", ""),
    weight: 1.5, // Medium weight for cuisines
  }));
}

/** Build searchable items from locations/areas */
function buildLocationItems(): SearchableItem[] {
  return AREAS.map((area) => ({
    id: `location-${area.toLowerCase().replace(/\s+/g, "-")}`,
    type: "location" as SearchResultType,
    title: area,
    slug: area.toLowerCase().replace(/\s+/g, "-"),
    weight: 1, // Lower weight for locations
  }));
}

/** Singleton search index */
let searchIndex: Fuse<SearchableItem> | null = null;

/** Initialize the search index */
function getSearchIndex(): Fuse<SearchableItem> {
  if (searchIndex) return searchIndex;

  const items: SearchableItem[] = [
    ...buildStallItems(),
    ...buildCuisineItems(),
    ...buildLocationItems(),
  ];

  searchIndex = new Fuse(items, {
    keys: [
      { name: "title", weight: 2 },
      { name: "subtitle", weight: 1 },
    ],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2,
    shouldSort: true,
    findAllMatches: false,
    ignoreLocation: true,
  });

  return searchIndex;
}

/** Search query options */
export interface SearchOptions {
  /** Maximum results to return (default: 8) */
  limit?: number;
}

/**
 * Perform a search query
 * @param query - The search query string
 * @param options - Search options
 * @returns Array of search result items
 */
export function search(query: string, options: SearchOptions = {}): SearchResultItem[] {
  const { limit = 8 } = options;

  if (!query || query.trim().length < 2) {
    return [];
  }

  const index = getSearchIndex();
  const results = index.search(query.trim(), { limit });

  return results.map((result) => ({
    id: result.item.id,
    type: result.item.type,
    title: result.item.title,
    subtitle: result.item.subtitle,
    slug: result.item.slug,
  }));
}

/**
 * Get navigation path for a search result
 * @param item - Search result item
 * @returns Path string for navigation
 */
export function getSearchResultPath(item: SearchResultItem): string {
  switch (item.type) {
    case "stall":
      return `/community/stalls/${item.slug}`;
    case "cuisine":
      return `/community/stalls?cuisine=${item.slug}`;
    case "location":
      return `/community/stalls?area=${item.slug}`;
    default:
      return "/";
  }
}

/**
 * Get all available areas for search suggestions
 */
export function getAreas(): string[] {
  return [...AREAS];
}

/**
 * Get all available cuisine labels for search suggestions
 */
export function getCuisines(): { id: string; label: string }[] {
  return getCuisineLabels();
}
