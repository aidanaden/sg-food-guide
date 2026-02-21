import { Result } from 'better-result';
import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';

import { getWorkerEnvFromServerContext } from '../cloudflare/runtime';
import {
  applyCanonicalStalls,
  ensureStallTables,
  getActiveStallCount,
  getActiveStallBySlug,
  listActiveStalls,
  listActiveStallsByCuisine,
} from './repository';
import { buildCanonicalStallsFromStaticData } from '../sync/static-seed';

const cuisineSchema = z.object({
  cuisine: z.string().min(1),
});

const slugSchema = z.object({
  slug: z.string().min(1),
});

async function ensureBaselineSeed(db: Parameters<typeof ensureStallTables>[0]): Promise<Result<void, Error>> {
  const activeCountResult = await getActiveStallCount(db);
  if (Result.isError(activeCountResult)) {
    return Result.err(activeCountResult.error);
  }

  if (activeCountResult.value > 0) {
    return Result.ok();
  }

  const nowIso = new Date().toISOString();
  const seedData = buildCanonicalStallsFromStaticData(nowIso);
  if (seedData.length === 0) {
    return Result.ok();
  }

  const applyResult = await applyCanonicalStalls(db, seedData, nowIso);
  if (Result.isError(applyResult)) {
    return Result.err(applyResult.error);
  }

  return Result.ok();
}

export const getAllStalls = createServerFn().handler(async ({ context }: { context: unknown }) => {
  const envResult = getWorkerEnvFromServerContext(context);
  if (Result.isError(envResult)) {
    throw envResult.error;
  }

  const tableResult = await ensureStallTables(envResult.value.STALLS_DB);
  if (Result.isError(tableResult)) {
    throw tableResult.error;
  }

  const seedResult = await ensureBaselineSeed(envResult.value.STALLS_DB);
  if (Result.isError(seedResult)) {
    throw seedResult.error;
  }

  const stallsResult = await listActiveStalls(envResult.value.STALLS_DB);
  if (Result.isError(stallsResult)) {
    throw stallsResult.error;
  }

  return stallsResult.value;
});

export const getStallsByCuisine = createServerFn()
  .inputValidator((input: unknown) => cuisineSchema.parse(input))
  .handler(async ({ context, data }: { context: unknown; data: z.infer<typeof cuisineSchema> }) => {
    const envResult = getWorkerEnvFromServerContext(context);
    if (Result.isError(envResult)) {
      throw envResult.error;
    }

    const tableResult = await ensureStallTables(envResult.value.STALLS_DB);
    if (Result.isError(tableResult)) {
      throw tableResult.error;
    }

    const seedResult = await ensureBaselineSeed(envResult.value.STALLS_DB);
    if (Result.isError(seedResult)) {
      throw seedResult.error;
    }

    const stallsResult = await listActiveStallsByCuisine(envResult.value.STALLS_DB, data.cuisine);
    if (Result.isError(stallsResult)) {
      throw stallsResult.error;
    }

    return stallsResult.value;
  });

export const getStallBySlug = createServerFn()
  .inputValidator((input: unknown) => slugSchema.parse(input))
  .handler(async ({ context, data }: { context: unknown; data: z.infer<typeof slugSchema> }) => {
    const envResult = getWorkerEnvFromServerContext(context);
    if (Result.isError(envResult)) {
      throw envResult.error;
    }

    const tableResult = await ensureStallTables(envResult.value.STALLS_DB);
    if (Result.isError(tableResult)) {
      throw tableResult.error;
    }

    const seedResult = await ensureBaselineSeed(envResult.value.STALLS_DB);
    if (Result.isError(seedResult)) {
      throw seedResult.error;
    }

    const stallResult = await getActiveStallBySlug(envResult.value.STALLS_DB, data.slug);
    if (Result.isError(stallResult)) {
      throw stallResult.error;
    }

    return stallResult.value;
  });
