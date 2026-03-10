import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import * as z from "zod";

import { getWorkerEnvFromServerContext } from "../cloudflare/runtime";
import { buildCanonicalStallsFromStaticData } from "../sync/static-seed";
import {
  applyCanonicalStalls,
  ensureStallTables,
  getActiveStallCount,
  getActiveStallBySlug,
  getStallIdBySlug,
  listActiveStalls,
  listActiveStallsByCuisine,
} from "./repository";
import { ensureReviewTables, listApprovedReviewsByStallId } from "./repository";
import {
  ensureExternalReviewTables,
  getExternalReviewStatsByStallSlug,
  listExternalReviewsByStallSlug,
} from "./repository";

const cuisineSchema = z.object({
  cuisine: z.string().min(1),
});

const slugSchema = z.object({
  slug: z.string().min(1),
});

async function ensureBaselineSeed(
  db: Parameters<typeof ensureStallTables>[0],
): Promise<Result<void, Error>> {
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

export const getReviewsByStallSlug = createServerFn()
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

    const reviewTableResult = await ensureReviewTables(envResult.value.STALLS_DB);
    if (Result.isError(reviewTableResult)) {
      throw reviewTableResult.error;
    }

    const stallIdResult = await getStallIdBySlug(envResult.value.STALLS_DB, data.slug);
    if (Result.isError(stallIdResult)) {
      throw stallIdResult.error;
    }

    const stallId = stallIdResult.value;
    if (!stallId) {
      return [];
    }

    const reviewsResult = await listApprovedReviewsByStallId(envResult.value.STALLS_DB, stallId);
    if (Result.isError(reviewsResult)) {
      throw reviewsResult.error;
    }

    return reviewsResult.value;
  });

export const getExternalReviewsByStallSlug = createServerFn()
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

    const externalReviewTableResult = await ensureExternalReviewTables(envResult.value.STALLS_DB);
    if (Result.isError(externalReviewTableResult)) {
      throw externalReviewTableResult.error;
    }

    const reviewsResult = await listExternalReviewsByStallSlug(
      envResult.value.STALLS_DB,
      data.slug,
    );
    if (Result.isError(reviewsResult)) {
      throw reviewsResult.error;
    }

    return reviewsResult.value;
  });

export const getExternalReviewStatsByStall = createServerFn()
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

    const externalReviewTableResult = await ensureExternalReviewTables(envResult.value.STALLS_DB);
    if (Result.isError(externalReviewTableResult)) {
      throw externalReviewTableResult.error;
    }

    const statsResult = await getExternalReviewStatsByStallSlug(
      envResult.value.STALLS_DB,
      data.slug,
    );
    if (Result.isError(statsResult)) {
      throw statsResult.error;
    }

    return statsResult.value;
  });
