import { Result } from "better-result";
import { z } from "zod";

import type { Stall } from "../data/shared";
import { getStallArea } from "../data/stalls";

const favoritesKey = "sg-food-guide:favorites";
const visitedKey = "sg-food-guide:visited";

const slugArraySchema = z.array(z.string().min(1));

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readSet(key: string): Set<string> {
  if (!canUseStorage()) return new Set<string>();

  const rawResult = Result.try(() => window.localStorage.getItem(key));
  if (Result.isError(rawResult) || !rawResult.value) return new Set<string>();

  const parseJsonResult = Result.try(() => JSON.parse(rawResult.value as string));
  if (Result.isError(parseJsonResult)) return new Set<string>();

  const parsed = slugArraySchema.safeParse(parseJsonResult.value);
  if (!parsed.success) return new Set<string>();

  return new Set(parsed.data);
}

function writeSet(key: string, values: Set<string>): void {
  if (!canUseStorage()) return;

  const payload = JSON.stringify([...values]);
  const writeResult = Result.try(() => window.localStorage.setItem(key, payload));
  if (Result.isError(writeResult)) {
    console.error(writeResult.error);
  }
}

export function getFavorites(): Set<string> {
  return readSet(favoritesKey);
}

export function getVisited(): Set<string> {
  return readSet(visitedKey);
}

export function toggleFavorite(slug: string): Set<string> {
  const next = getFavorites();
  if (next.has(slug)) next.delete(slug);
  else next.add(slug);
  writeSet(favoritesKey, next);
  return next;
}

export function toggleVisited(slug: string): Set<string> {
  const next = getVisited();
  if (next.has(slug)) next.delete(slug);
  else next.add(slug);
  writeSet(visitedKey, next);
  return next;
}

export function markVisited(slug: string): Set<string> {
  const next = getVisited();
  next.add(slug);
  writeSet(visitedKey, next);
  return next;
}

/**
 * Get visit statistics for visited stalls
 */
export interface VisitStats {
  totalVisits: number;
  uniqueStalls: number;
  cuisineBreakdown: { cuisine: string; cuisineLabel: string; count: number }[];
  areaBreakdown: { area: string; count: number }[];
}

export function getVisitStats(stalls: Stall[]): VisitStats {
  const visited = getVisited();

  const visitedStalls = stalls.filter((stall) => visited.has(stall.slug));

  const cuisineCount = new Map<string, { label: string; count: number }>();
  const areaCount = new Map<string, number>();

  for (const stall of visitedStalls) {
    // Count by cuisine
    const cuisineData = cuisineCount.get(stall.cuisine) ?? { label: stall.cuisineLabel, count: 0 };
    cuisineData.count += 1;
    cuisineCount.set(stall.cuisine, cuisineData);

    // Count by area
    const area = getStallArea(stall);
    const areaCurrent = areaCount.get(area) ?? 0;
    areaCount.set(area, areaCurrent + 1);
  }

  const cuisineBreakdown = [...cuisineCount.entries()]
    .map(([cuisine, data]) => ({
      cuisine,
      cuisineLabel: data.label,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count);

  const areaBreakdown = [...areaCount.entries()]
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalVisits: visited.size,
    uniqueStalls: visitedStalls.length,
    cuisineBreakdown,
    areaBreakdown,
  };
}

/**
 * Export visit data as JSON string
 */
export function exportVisitData(stalls: Stall[]): string {
  const visited = getVisited();
  const visitedStalls = stalls.filter((stall) => visited.has(stall.slug));

  const exportData = {
    exportedAt: new Date().toISOString(),
    totalVisits: visited.size,
    stalls: visitedStalls.map((stall) => ({
      slug: stall.slug,
      name: stall.name,
      cuisine: stall.cuisineLabel,
      area: getStallArea(stall),
      address: stall.address,
      rating: stall.ratingModerated,
      price: stall.price,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}
