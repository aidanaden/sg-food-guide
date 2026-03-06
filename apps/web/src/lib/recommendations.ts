import type { Stall } from "../data/shared";
import { getStallArea } from "../data/stalls";

export interface RecommendationReason {
  type: "cuisine" | "area" | "highly-rated" | "similar";
  label: string;
}

/**
 * Get user's preferred cuisines based on their favorites
 */
export function getPreferredCuisines(
  stalls: Stall[],
  favoriteSlugs: Set<string>,
): { cuisine: string; count: number }[] {
  const cuisineCount = new Map<string, number>();

  for (const stall of stalls) {
    if (favoriteSlugs.has(stall.slug)) {
      const current = cuisineCount.get(stall.cuisine) ?? 0;
      cuisineCount.set(stall.cuisine, current + 1);
    }
  }

  return [...cuisineCount.entries()]
    .map(([cuisine, count]) => ({ cuisine, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get user's preferred areas based on their favorites
 */
export function getPreferredAreas(
  stalls: Stall[],
  favoriteSlugs: Set<string>,
): { area: string; count: number }[] {
  const areaCount = new Map<string, number>();

  for (const stall of stalls) {
    if (favoriteSlugs.has(stall.slug)) {
      const area = getStallArea(stall);
      const current = areaCount.get(area) ?? 0;
      areaCount.set(area, current + 1);
    }
  }

  return [...areaCount.entries()]
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get personalized recommendations for a user based on their favorites
 * and visited history.
 *
 * Recommendations are prioritized by:
 * 1. Same cuisine as user's favorites (that they haven't visited)
 * 2. Same area as user's favorites (that they haven't visited)
 * 3. Highly-rated stalls they haven't visited
 */
export function getRecommendations(
  stalls: Stall[],
  favoriteSlugs: Set<string>,
  visitedSlugs: Set<string>,
  limit: number = 6,
): { stall: Stall; reason: RecommendationReason }[] {
  // If user has no favorites, return top-rated unvisited stalls
  if (favoriteSlugs.size === 0) {
    return stalls
      .filter((stall) => !visitedSlugs.has(stall.slug))
      .sort((a, b) => {
        const aRating = a.ratingModerated ?? -1;
        const bRating = b.ratingModerated ?? -1;
        return bRating - aRating;
      })
      .slice(0, limit)
      .map((stall) => ({
        stall,
        reason: { type: "highly-rated", label: "Highly Rated" } as RecommendationReason,
      }));
  }

  const preferredCuisines = getPreferredCuisines(stalls, favoriteSlugs);
  const preferredAreas = getPreferredAreas(stalls, favoriteSlugs);

  // Score and rank stalls
  const scoredStalls = stalls
    .filter((stall) => !visitedSlugs.has(stall.slug) && !favoriteSlugs.has(stall.slug))
    .map((stall) => {
      let score = 0;
      let reason: RecommendationReason = { type: "highly-rated", label: "Highly Rated" };

      // Check if stall's cuisine matches preferred cuisines
      const cuisineMatch = preferredCuisines.find((c) => c.cuisine === stall.cuisine);
      if (cuisineMatch) {
        score += 10 + cuisineMatch.count * 2;
        reason = { type: "cuisine", label: stall.cuisineLabel };
      }

      // Check if stall's area matches preferred areas
      const stallArea = getStallArea(stall);
      const areaMatch = preferredAreas.find((a) => a.area === stallArea);
      if (areaMatch) {
        score += 5 + areaMatch.count;
        if (reason.type === "highly-rated") {
          reason = { type: "area", label: stallArea };
        } else {
          reason = { type: "similar", label: `${stallArea} • ${stall.cuisineLabel}` };
        }
      }

      // Boost score for higher-rated stalls
      const rating = stall.ratingModerated ?? 0;
      score += rating * 3;

      return { stall, score, reason };
    });

  // Sort by score descending
  scoredStalls.sort((a, b) => b.score - a.score);

  return scoredStalls.slice(0, limit).map(({ stall, reason }) => ({ stall, reason }));
}

/**
 * Check if recommendations should be shown
 * (i.e., user has some favorites or there are unvisited stalls)
 */
export function shouldShowRecommendations(
  stalls: Stall[],
  favoriteSlugs: Set<string>,
  visitedSlugs: Set<string>,
): boolean {
  // Show if there are unvisited stalls
  const unvisitedCount = stalls.filter((s) => !visitedSlugs.has(s.slug)).length;
  return unvisitedCount > 0;
}
