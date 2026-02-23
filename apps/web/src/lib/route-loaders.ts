import { z } from 'zod';

import type { Stall } from '../data/shared';
import { getAllStalls, getStallBySlug, getStallsByCuisine } from '../server/stalls/read.functions';

const cuisineParamsSchema = z.object({
  cuisine: z.string().min(1),
});

const stallParamsSchema = z.object({
  slug: z.string().min(1),
});

export interface HomeRouteData {
  stalls: Stall[];
  generatedAt: string;
}

export interface CuisineRouteData {
  cuisineId: string;
  cuisineLabel: string;
  cuisineStalls: Stall[];
  generatedAt: string;
}

export interface StallRouteData {
  stall: Stall;
  generatedAt: string;
}

export async function loadHomeRouteData(nowIso = new Date().toISOString()): Promise<HomeRouteData> {
  const loadedStalls = await getAllStalls();
  return { stalls: loadedStalls, generatedAt: nowIso };
}

export async function loadCuisineRouteData(
  params: unknown,
  nowIso = new Date().toISOString()
): Promise<CuisineRouteData | null> {
  const parsed = cuisineParamsSchema.safeParse(params);
  if (!parsed.success) {
    return null;
  }

  const cuisineStalls = await getStallsByCuisine({ data: { cuisine: parsed.data.cuisine } });
  if (cuisineStalls.length === 0) {
    return null;
  }

  const firstStall = cuisineStalls[0];
  if (!firstStall) {
    return null;
  }

  return {
    cuisineId: parsed.data.cuisine,
    cuisineLabel: firstStall.cuisineLabel,
    cuisineStalls,
    generatedAt: nowIso,
  };
}

export async function loadStallRouteData(
  params: unknown,
  nowIso = new Date().toISOString()
): Promise<StallRouteData | null> {
  const parsed = stallParamsSchema.safeParse(params);
  if (!parsed.success) {
    return null;
  }

  const stall = await getStallBySlug({ data: { slug: parsed.data.slug } });
  if (!stall) {
    return null;
  }

  return { stall, generatedAt: nowIso };
}
