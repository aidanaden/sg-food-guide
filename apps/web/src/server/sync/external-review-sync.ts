import { Result } from "better-result";

import type { WorkerEnv, WorkerExecutionContextLike } from "../cloudflare/runtime";
import type { CanonicalExternalReview } from "../external-reviews/contracts";
import {
  ensureExternalReviewTables,
  ensureStallTables,
  getExternalReviewStatsByStallSlug,
  getStallIdBySlug,
  insertExternalReviewSyncRun,
  listExternalReviewsByStallSlug,
  upsertExternalPlaceMapping,
  upsertExternalReview,
  upsertExternalReviewSource,
  upsertExternalReviewStats,
  type ExternalReviewSyncRunRecord,
} from "../stalls/repository";
import { makeStableHash } from "./normalize";

// ─── Types ────────────────────────────────────────────────────────

export type ExternalReviewSyncMode = "dry-run" | "apply";
export type ExternalReviewSyncStatus = "success" | "failed" | "guarded";

export interface ExternalReviewSyncSummary {
  runId: string;
  sourceId: string;
  triggerSource: string;
  mode: ExternalReviewSyncMode;
  status: ExternalReviewSyncStatus;
  startedAt: string;
  finishedAt: string;
  sourceStats: {
    sourceName: string;
    sourceType: string;
  };
  changeStats: {
    placesMapped: number;
    reviewsFetched: number;
    reviewsImported: number;
    statsUpdated: number;
  };
  warnings: string[];
  error: string | null;
}

export interface RunExternalReviewSyncArgs {
  env: WorkerEnv;
  sourceId: string;
  triggerSource: string;
  executionCtx?: WorkerExecutionContextLike | null;
  modeOverride?: ExternalReviewSyncMode;
}

// ─── Placeholder Fetcher Interface ────────────────────────────────

export interface ExternalReviewFetcher {
  sourceId: string;
  sourceType: string;
  sourceName: string;
  baseUrl: string;

  /**
   * Fetch reviews for a given external place ID.
   * Returns array of raw review data from the external source.
   */
  fetchReviewsForPlace(placeId: string): Promise<Result<ExternalReviewFetcherReview[], Error>>;

  /**
   * Search for a place by name/address query.
   * Returns matching places with their external IDs.
   */
  searchPlaces(query: string): Promise<Result<ExternalReviewFetcherPlace[], Error>>;
}

export interface ExternalReviewFetcherReview {
  externalReviewId: string;
  authorName: string;
  authorUrl: string;
  rating: number;
  commentText: string;
  reviewUrl: string;
  reviewDate: string | null;
  likeCount: number;
}

export interface ExternalReviewFetcherPlace {
  externalPlaceId: string;
  externalPlaceName: string;
  externalPlaceUrl: string;
}

// ─── Google Maps Fetcher (Placeholder) ────────────────────────────

export class GoogleMapsReviewFetcher implements ExternalReviewFetcher {
  sourceId: string;
  sourceType: string;
  sourceName: string;
  baseUrl: string;

  constructor() {
    this.sourceId = "google-maps-default";
    this.sourceType = "google_maps";
    this.sourceName = "Google Maps";
    this.baseUrl = "https://www.google.com/maps";
  }

  async fetchReviewsForPlace(
    _placeId: string,
  ): Promise<Result<ExternalReviewFetcherReview[], Error>> {
    // TODO: Implement actual Google Maps Places API scraping/fetching
    // This requires:
    // - Google Places API key or scraping solution
    // - Place details endpoint for reviews
    // - Rate limiting and caching
    
    return Result.ok([]);
  }

  async searchPlaces(_query: string): Promise<Result<ExternalReviewFetcherPlace[], Error>> {
    // TODO: Implement actual Google Maps Places search
    // This requires:
    // - Google Places API text search
    // - Place ID resolution
    
    return Result.ok([]);
  }
}

// ─── Sync Orchestration ──────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function resolveSyncMode(args: RunExternalReviewSyncArgs): ExternalReviewSyncMode {
  if (args.modeOverride) {
    return args.modeOverride;
  }
  return args.env.EXTERNAL_REVIEW_SYNC_MODE === "apply" ? "apply" : "dry-run";
}

function buildRunId(startedAtIso: string, sourceId: string): string {
  return `ext-review-sync-${sourceId}-${makeStableHash(startedAtIso).slice(0, 12)}`;
}

export async function runExternalReviewSync(
  args: RunExternalReviewSyncArgs,
): Promise<ExternalReviewSyncSummary> {
  const startedAt = nowIso();
  const runId = buildRunId(startedAt, args.sourceId);
  const mode = resolveSyncMode(args);

  const baseSummary: ExternalReviewSyncSummary = {
    runId,
    sourceId: args.sourceId,
    triggerSource: args.triggerSource,
    mode,
    status: "failed",
    startedAt,
    finishedAt: startedAt,
    sourceStats: {
      sourceName: "",
      sourceType: "",
    },
    changeStats: {
      placesMapped: 0,
      reviewsFetched: 0,
      reviewsImported: 0,
      statsUpdated: 0,
    },
    warnings: [],
    error: null,
  };

  // Create fetcher based on source type
  const fetcher = new GoogleMapsReviewFetcher();

  const syncResult = await Result.tryPromise(async () => {
    // Ensure tables exist
    const stallTablesResult = await ensureStallTables(args.env.STALLS_DB);
    if (Result.isError(stallTablesResult)) {
      throw new Error("Failed to ensure stall tables");
    }

    const extTablesResult = await ensureExternalReviewTables(args.env.STALLS_DB);
    if (Result.isError(extTablesResult)) {
      throw new Error("Failed to ensure external review tables");
    }

    // Upsert the source record
    const sourceUpsertResult = await upsertExternalReviewSource(args.env.STALLS_DB, {
      id: fetcher.sourceId,
      sourceType: fetcher.sourceType,
      sourceName: fetcher.sourceName,
      baseUrl: fetcher.baseUrl,
      isActive: true,
      lastFetchedAt: startedAt,
      fetchConfigJson: JSON.stringify({}),
    });
    if (Result.isError(sourceUpsertResult)) {
      throw sourceUpsertResult.error;
    }

    // TODO: Get list of stalls to sync (for now, we could iterate all or a subset)
    // For now, this is a placeholder that doesn't actually sync any reviews
    // Real implementation would:
    // 1. Get active stalls from DB
    // 2. For each stall, search for matching place via fetcher
    // 3. Upsert place mapping
    // 4. Fetch reviews for found places
    // 5. Upsert reviews
    // 6. Compute and upsert stats

    return {
      placesMapped: 0,
      reviewsFetched: 0,
      reviewsImported: 0,
      statsUpdated: 0,
    };
  });

  const finalSummary: ExternalReviewSyncSummary = Result.isError(syncResult)
    ? {
        ...baseSummary,
        status: "failed",
        finishedAt: nowIso(),
        error:
          syncResult.error instanceof Error
            ? syncResult.error.message
            : "Unknown external review sync failure.",
      }
    : {
        ...baseSummary,
        status: "success",
        finishedAt: nowIso(),
        sourceStats: {
          sourceName: fetcher.sourceName,
          sourceType: fetcher.sourceType,
        },
        changeStats: syncResult.value,
      };

  // Record the sync run
  const runRecord: ExternalReviewSyncRunRecord = {
    id: finalSummary.runId,
    sourceId: finalSummary.sourceId,
    triggerSource: finalSummary.triggerSource,
    mode: finalSummary.mode,
    status: finalSummary.status,
    reviewsFetched: finalSummary.changeStats.reviewsFetched,
    reviewsImported: finalSummary.changeStats.reviewsImported,
    startedAt: finalSummary.startedAt,
    finishedAt: finalSummary.finishedAt,
    summaryJson: JSON.stringify(finalSummary),
    errorText: finalSummary.error,
  };

  const insertResult = await insertExternalReviewSyncRun(args.env.STALLS_DB, runRecord);
  if (Result.isError(insertResult)) {
    finalSummary.warnings.push("Failed to persist external review sync run record.");
  }

  return finalSummary;
}
