import { Result } from 'better-result';
import * as z from 'zod/mini';

export const draftStatusSchema = z.union([
  z.literal('new'),
  z.literal('reviewed'),
  z.literal('approved'),
  z.literal('rejected'),
]);

export type DraftStatus = z.infer<typeof draftStatusSchema>;

export const moderationFlagSchema = z.union([
  z.literal('spam'),
  z.literal('profanity'),
  z.literal('self-promo'),
  z.literal('insufficient-signal'),
]);

export type ModerationFlag = z.infer<typeof moderationFlagSchema>;

export const extractionMethodSchema = z.union([z.literal('rules'), z.literal('llm'), z.literal('mixed')]);

export type ExtractionMethod = z.infer<typeof extractionMethodSchema>;

const dbDraftRowSchema = z.object({
  id: z.string(),
  normalized_name: z.string(),
  display_name: z.string(),
  country: z.string(),
  confidence_score: z.union([z.number(), z.string()]),
  support_count: z.union([z.number(), z.string()]),
  top_like_count: z.union([z.number(), z.string()]),
  status: draftStatusSchema,
  moderation_flags_json: z.string(),
  maps_urls_json: z.string(),
  evidence_comment_ids_json: z.string(),
  evidence_video_ids_json: z.string(),
  extraction_method: extractionMethodSchema,
  extraction_notes: z.string(),
  review_note: z.string(),
  reviewed_by: z.optional(z.union([z.string(), z.null()])),
  reviewed_at: z.optional(z.union([z.string(), z.null()])),
  rejected_reason: z.optional(z.union([z.string(), z.null()])),
  approved_stall_id: z.optional(z.union([z.string(), z.null()])),
  created_at: z.string(),
  updated_at: z.string(),
  first_seen_at: z.string(),
  last_seen_at: z.string(),
  last_synced_at: z.string(),
});

const dbApprovedStallRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  normalized_name: z.string(),
  name: z.string(),
  country: z.string(),
  source_draft_id: z.string(),
  confidence_score: z.union([z.number(), z.string()]),
  support_count: z.union([z.number(), z.string()]),
  top_like_count: z.union([z.number(), z.string()]),
  status: z.union([z.literal('active'), z.literal('archived')]),
  approved_by: z.string(),
  approved_at: z.string(),
  notes: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const dbCommentSourceRowSchema = z.object({
  id: z.string(),
  video_id: z.string(),
  video_url: z.string(),
  video_title: z.string(),
  comment_id: z.string(),
  parent_comment_id: z.optional(z.union([z.string(), z.null()])),
  is_top_level: z.union([z.number(), z.string()]),
  is_pinned: z.union([z.number(), z.string()]),
  like_count: z.union([z.number(), z.string()]),
  author_display_name: z.string(),
  comment_text: z.string(),
  published_at: z.optional(z.union([z.string(), z.null()])),
  source_updated_at: z.optional(z.union([z.string(), z.null()])),
  fetched_at: z.string(),
  raw_text_expires_at: z.string(),
});

const stringArraySchema = z.array(z.string());

function parseStringArray(value: string): Result<string[], Error> {
  const parsedResult = Result.try(() => JSON.parse(value));
  if (Result.isError(parsedResult)) {
    return Result.err(new Error('Invalid JSON array payload.'));
  }

  const parsedArray = stringArraySchema.safeParse(parsedResult.value);
  if (!parsedArray.success) {
    return Result.err(new Error('Invalid string array payload.'));
  }

  return Result.ok(parsedArray.data);
}

function parseModerationFlags(value: string): Result<ModerationFlag[], Error> {
  const parsed = parseStringArray(value);
  if (Result.isError(parsed)) {
    return Result.err(parsed.error);
  }

  const result: ModerationFlag[] = [];
  for (const item of parsed.value) {
    const maybeFlag = moderationFlagSchema.safeParse(item);
    if (!maybeFlag.success) {
      continue;
    }
    result.push(maybeFlag.data);
  }

  return Result.ok(result);
}

function parseNumber(input: string | number): number {
  const value = Number(input);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value;
}

export interface CommentSuggestionDraft {
  id: string;
  normalizedName: string;
  displayName: string;
  country: string;
  confidenceScore: number;
  supportCount: number;
  topLikeCount: number;
  status: DraftStatus;
  moderationFlags: ModerationFlag[];
  mapsUrls: string[];
  evidenceCommentIds: string[];
  evidenceVideoIds: string[];
  extractionMethod: ExtractionMethod;
  extractionNotes: string;
  reviewNote: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectedReason: string | null;
  approvedStallId: string | null;
  createdAt: string;
  updatedAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastSyncedAt: string;
}

export interface ApprovedCommentSourceStall {
  id: string;
  slug: string;
  normalizedName: string;
  name: string;
  country: string;
  sourceDraftId: string;
  confidenceScore: number;
  supportCount: number;
  topLikeCount: number;
  status: 'active' | 'archived';
  approvedBy: string;
  approvedAt: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface YouTubeCommentSourceRecord {
  id: string;
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  commentId: string;
  parentCommentId: string | null;
  isTopLevel: boolean;
  isPinned: boolean;
  likeCount: number;
  authorDisplayName: string;
  commentText: string;
  publishedAt: string | null;
  sourceUpdatedAt: string | null;
  fetchedAt: string;
  rawTextExpiresAt: string;
}

export interface DraftSuggestionAggregate {
  normalizedName: string;
  displayName: string;
  country: string;
  confidenceScore: number;
  supportCount: number;
  topLikeCount: number;
  moderationFlags: ModerationFlag[];
  mapsUrls: string[];
  evidenceCommentIds: string[];
  evidenceVideoIds: string[];
  extractionMethod: ExtractionMethod;
  extractionNotes: string;
}

export function mapDbDraftRow(row: unknown): Result<CommentSuggestionDraft, Error> {
  const parsedRow = dbDraftRowSchema.safeParse(row);
  if (!parsedRow.success) {
    return Result.err(new Error('Invalid draft row payload from database.'));
  }

  const moderationFlagsResult = parseModerationFlags(parsedRow.data.moderation_flags_json);
  if (Result.isError(moderationFlagsResult)) {
    return Result.err(moderationFlagsResult.error);
  }

  const mapsUrlsResult = parseStringArray(parsedRow.data.maps_urls_json);
  if (Result.isError(mapsUrlsResult)) {
    return Result.err(mapsUrlsResult.error);
  }

  const evidenceCommentIdsResult = parseStringArray(parsedRow.data.evidence_comment_ids_json);
  if (Result.isError(evidenceCommentIdsResult)) {
    return Result.err(evidenceCommentIdsResult.error);
  }

  const evidenceVideoIdsResult = parseStringArray(parsedRow.data.evidence_video_ids_json);
  if (Result.isError(evidenceVideoIdsResult)) {
    return Result.err(evidenceVideoIdsResult.error);
  }

  return Result.ok({
    id: parsedRow.data.id,
    normalizedName: parsedRow.data.normalized_name,
    displayName: parsedRow.data.display_name,
    country: parsedRow.data.country,
    confidenceScore: parseNumber(parsedRow.data.confidence_score),
    supportCount: parseNumber(parsedRow.data.support_count),
    topLikeCount: parseNumber(parsedRow.data.top_like_count),
    status: parsedRow.data.status,
    moderationFlags: moderationFlagsResult.value,
    mapsUrls: mapsUrlsResult.value,
    evidenceCommentIds: evidenceCommentIdsResult.value,
    evidenceVideoIds: evidenceVideoIdsResult.value,
    extractionMethod: parsedRow.data.extraction_method,
    extractionNotes: parsedRow.data.extraction_notes,
    reviewNote: parsedRow.data.review_note,
    reviewedBy: parsedRow.data.reviewed_by ?? null,
    reviewedAt: parsedRow.data.reviewed_at ?? null,
    rejectedReason: parsedRow.data.rejected_reason ?? null,
    approvedStallId: parsedRow.data.approved_stall_id ?? null,
    createdAt: parsedRow.data.created_at,
    updatedAt: parsedRow.data.updated_at,
    firstSeenAt: parsedRow.data.first_seen_at,
    lastSeenAt: parsedRow.data.last_seen_at,
    lastSyncedAt: parsedRow.data.last_synced_at,
  });
}

export function mapDbApprovedStallRow(row: unknown): Result<ApprovedCommentSourceStall, Error> {
  const parsed = dbApprovedStallRowSchema.safeParse(row);
  if (!parsed.success) {
    return Result.err(new Error('Invalid approved comment-source stall row payload from database.'));
  }

  return Result.ok({
    id: parsed.data.id,
    slug: parsed.data.slug,
    normalizedName: parsed.data.normalized_name,
    name: parsed.data.name,
    country: parsed.data.country,
    sourceDraftId: parsed.data.source_draft_id,
    confidenceScore: parseNumber(parsed.data.confidence_score),
    supportCount: parseNumber(parsed.data.support_count),
    topLikeCount: parseNumber(parsed.data.top_like_count),
    status: parsed.data.status,
    approvedBy: parsed.data.approved_by,
    approvedAt: parsed.data.approved_at,
    notes: parsed.data.notes,
    createdAt: parsed.data.created_at,
    updatedAt: parsed.data.updated_at,
  });
}

export function mapDbCommentSourceRow(row: unknown): Result<YouTubeCommentSourceRecord, Error> {
  const parsed = dbCommentSourceRowSchema.safeParse(row);
  if (!parsed.success) {
    return Result.err(new Error('Invalid YouTube comment-source row payload from database.'));
  }

  return Result.ok({
    id: parsed.data.id,
    videoId: parsed.data.video_id,
    videoUrl: parsed.data.video_url,
    videoTitle: parsed.data.video_title,
    commentId: parsed.data.comment_id,
    parentCommentId: parsed.data.parent_comment_id ?? null,
    isTopLevel: Number(parsed.data.is_top_level) === 1,
    isPinned: Number(parsed.data.is_pinned) === 1,
    likeCount: parseNumber(parsed.data.like_count),
    authorDisplayName: parsed.data.author_display_name,
    commentText: parsed.data.comment_text,
    publishedAt: parsed.data.published_at ?? null,
    sourceUpdatedAt: parsed.data.source_updated_at ?? null,
    fetchedAt: parsed.data.fetched_at,
    rawTextExpiresAt: parsed.data.raw_text_expires_at,
  });
}
