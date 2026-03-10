import { Result } from "better-result";
import * as z from "zod/mini";

export type ExternalSourceType =
  | "google_maps"
  | "yelp"
  | "tripadvisor"
  | "facebook"
  | "burpple"
  | "other";

export interface CanonicalExternalSource {
  id: string;
  sourceType: ExternalSourceType;
  sourceName: string;
  baseUrl: string;
  isActive: boolean;
  lastFetchedAt: string | null;
  fetchConfigJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalExternalPlaceMapping {
  id: string;
  stallId: string;
  sourceId: string;
  externalPlaceId: string;
  externalPlaceName: string;
  externalPlaceUrl: string;
  isVerified: boolean;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalExternalReview {
  id: string;
  sourceId: string;
  stallId: string;
  externalReviewId: string;
  authorName: string;
  authorUrl: string;
  rating: number;
  commentText: string;
  reviewUrl: string;
  reviewDate: string | null;
  likeCount: number;
  isHighlighted: boolean;
  fetchedAt: string;
  rawDataJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalExternalReviewStats {
  id: string;
  stallId: string;
  sourceId: string;
  reviewCount: number;
  averageRating: number | null;
  lastReviewDate: string | null;
  computedAt: string;
}

// Combined view for display
export interface ExternalReviewWithSource extends CanonicalExternalReview {
  sourceName: string;
  sourceType: ExternalSourceType;
}

// DB Row Schemas
const dbExternalSourceRowSchema = z.object({
  id: z.string(),
  source_type: z.string(),
  source_name: z.string(),
  base_url: z.string(),
  is_active: z.union([z.number(), z.string()]),
  last_fetched_at: z.optional(z.union([z.string(), z.null()])),
  fetch_config_json: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const dbExternalReviewRowSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  stall_id: z.string(),
  external_review_id: z.string(),
  author_name: z.string(),
  author_url: z.string(),
  rating: z.union([z.number(), z.string()]),
  comment_text: z.string(),
  review_url: z.string(),
  review_date: z.optional(z.union([z.string(), z.null()])),
  like_count: z.union([z.number(), z.string()]),
  is_highlighted: z.union([z.number(), z.string()]),
  fetched_at: z.string(),
  raw_data_json: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const dbExternalReviewWithSourceRowSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  stall_id: z.string(),
  external_review_id: z.string(),
  author_name: z.string(),
  author_url: z.string(),
  rating: z.union([z.number(), z.string()]),
  comment_text: z.string(),
  review_url: z.string(),
  review_date: z.optional(z.union([z.string(), z.null()])),
  like_count: z.union([z.number(), z.string()]),
  is_highlighted: z.union([z.number(), z.string()]),
  fetched_at: z.string(),
  raw_data_json: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  source_name: z.string(),
  source_type: z.string(),
});

const dbExternalReviewStatsRowSchema = z.object({
  id: z.string(),
  stall_id: z.string(),
  source_id: z.string(),
  review_count: z.union([z.number(), z.string()]),
  average_rating: z.optional(z.union([z.number(), z.string(), z.null()])),
  last_review_date: z.optional(z.union([z.string(), z.null()])),
  computed_at: z.string(),
});

export function mapDbRowToExternalSource(row: unknown): Result<CanonicalExternalSource, Error> {
  const parsed = dbExternalSourceRowSchema.safeParse(row);
  if (!parsed.success) {
    return Result.err(new Error("Invalid external source row returned from database."));
  }

  const v = parsed.data;
  return Result.ok({
    id: v.id,
    sourceType: v.source_type as ExternalSourceType,
    sourceName: v.source_name,
    baseUrl: v.base_url,
    isActive: v.is_active === 1 || v.is_active === "1",
    lastFetchedAt: v.last_fetched_at ?? null,
    fetchConfigJson: v.fetch_config_json,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
  });
}

export function mapDbRowToExternalReview(row: unknown): Result<CanonicalExternalReview, Error> {
  const parsed = dbExternalReviewRowSchema.safeParse(row);
  if (!parsed.success) {
    return Result.err(new Error("Invalid external review row returned from database."));
  }

  const v = parsed.data;
  return Result.ok({
    id: v.id,
    sourceId: v.source_id,
    stallId: v.stall_id,
    externalReviewId: v.external_review_id,
    authorName: v.author_name,
    authorUrl: v.author_url,
    rating: Number(v.rating) || 0,
    commentText: v.comment_text,
    reviewUrl: v.review_url,
    reviewDate: v.review_date ?? null,
    likeCount: Number(v.like_count) || 0,
    isHighlighted: v.is_highlighted === 1 || v.is_highlighted === "1",
    fetchedAt: v.fetched_at,
    rawDataJson: v.raw_data_json,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
  });
}

export function mapDbRowToExternalReviewWithSource(
  row: unknown,
): Result<ExternalReviewWithSource, Error> {
  const parsed = dbExternalReviewWithSourceRowSchema.safeParse(row);
  if (!parsed.success) {
    return Result.err(new Error("Invalid external review with source row returned from database."));
  }

  const v = parsed.data;
  return Result.ok({
    id: v.id,
    sourceId: v.source_id,
    stallId: v.stall_id,
    externalReviewId: v.external_review_id,
    authorName: v.author_name,
    authorUrl: v.author_url,
    rating: Number(v.rating) || 0,
    commentText: v.comment_text,
    reviewUrl: v.review_url,
    reviewDate: v.review_date ?? null,
    likeCount: Number(v.like_count) || 0,
    isHighlighted: v.is_highlighted === 1 || v.is_highlighted === "1",
    fetchedAt: v.fetched_at,
    rawDataJson: v.raw_data_json,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
    sourceName: v.source_name,
    sourceType: v.source_type as ExternalSourceType,
  });
}

export function mapDbRowToExternalReviewStats(
  row: unknown,
): Result<CanonicalExternalReviewStats, Error> {
  const parsed = dbExternalReviewStatsRowSchema.safeParse(row);
  if (!parsed.success) {
    return Result.err(new Error("Invalid external review stats row returned from database."));
  }

  const v = parsed.data;
  return Result.ok({
    id: v.id,
    stallId: v.stall_id,
    sourceId: v.source_id,
    reviewCount: Number(v.review_count) || 0,
    averageRating:
      v.average_rating !== null && v.average_rating !== undefined
        ? Number(v.average_rating)
        : null,
    lastReviewDate: v.last_review_date ?? null,
    computedAt: v.computed_at,
  });
}
