import { Result } from 'better-result';
import { slugify } from '../../data/shared';
import type { D1Database } from '../cloudflare/runtime';
import { deriveSlug, makeStableHash, normalizeComparableText, normalizeIdentityText } from '../sync/normalize';
import {
  type ApprovedCommentSourceStall,
  type CommentSuggestionDraft,
  type DraftStatus,
  type DraftSuggestionAggregate,
  mapDbApprovedStallRow,
  mapDbDraftRow,
  type YouTubeCommentSourceRecord,
} from './contracts';
import * as z from 'zod';

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS youtube_comment_sources (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    video_url TEXT NOT NULL,
    video_title TEXT NOT NULL,
    comment_id TEXT NOT NULL UNIQUE,
    parent_comment_id TEXT,
    is_top_level INTEGER NOT NULL DEFAULT 0 CHECK (is_top_level IN (0, 1)),
    is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
    like_count INTEGER NOT NULL DEFAULT 0,
    author_display_name TEXT NOT NULL DEFAULT '',
    comment_text TEXT NOT NULL DEFAULT '',
    published_at TEXT,
    source_updated_at TEXT,
    fetched_at TEXT NOT NULL,
    raw_text_expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_record_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stall_comment_drafts (
    id TEXT PRIMARY KEY,
    normalized_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'SG',
    confidence_score REAL NOT NULL DEFAULT 0,
    support_count INTEGER NOT NULL DEFAULT 0,
    top_like_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'approved', 'rejected')),
    moderation_flags_json TEXT NOT NULL DEFAULT '[]',
    maps_urls_json TEXT NOT NULL DEFAULT '[]',
    evidence_comment_ids_json TEXT NOT NULL DEFAULT '[]',
    evidence_video_ids_json TEXT NOT NULL DEFAULT '[]',
    extraction_method TEXT NOT NULL DEFAULT 'rules' CHECK (extraction_method IN ('rules', 'llm', 'mixed')),
    extraction_notes TEXT NOT NULL DEFAULT '',
    review_note TEXT NOT NULL DEFAULT '',
    reviewed_by TEXT,
    reviewed_at TEXT,
    rejected_reason TEXT,
    approved_stall_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    last_synced_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS comment_source_stalls (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    normalized_name TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'SG',
    source_draft_id TEXT NOT NULL UNIQUE,
    confidence_score REAL NOT NULL DEFAULT 0,
    support_count INTEGER NOT NULL DEFAULT 0,
    top_like_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    approved_by TEXT NOT NULL,
    approved_at TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_draft_id) REFERENCES stall_comment_drafts(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS comment_sync_runs (
    id TEXT PRIMARY KEY,
    trigger_source TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('dry-run', 'apply')),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'guarded')),
    started_at TEXT NOT NULL,
    finished_at TEXT,
    summary_json TEXT NOT NULL DEFAULT '{}',
    error_text TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS comment_sync_state (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stall_comment_evidence (
    id TEXT PRIMARY KEY,
    normalized_name TEXT NOT NULL,
    comment_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    like_count INTEGER NOT NULL DEFAULT 0,
    confidence_score REAL NOT NULL DEFAULT 0,
    source_url TEXT NOT NULL DEFAULT '',
    author_display_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT NOT NULL,
    UNIQUE(normalized_name, comment_id)
  )`,
  'CREATE INDEX IF NOT EXISTS idx_youtube_comment_sources_video_id ON youtube_comment_sources(video_id)',
  'CREATE INDEX IF NOT EXISTS idx_youtube_comment_sources_fetched_at ON youtube_comment_sources(fetched_at)',
  'CREATE INDEX IF NOT EXISTS idx_youtube_comment_sources_raw_expiry ON youtube_comment_sources(raw_text_expires_at)',
  'CREATE INDEX IF NOT EXISTS idx_stall_comment_drafts_status ON stall_comment_drafts(status)',
  'CREATE INDEX IF NOT EXISTS idx_stall_comment_drafts_confidence ON stall_comment_drafts(confidence_score)',
  'CREATE INDEX IF NOT EXISTS idx_comment_source_stalls_status ON comment_source_stalls(status)',
  'CREATE INDEX IF NOT EXISTS idx_stall_comment_evidence_name ON stall_comment_evidence(normalized_name)',
] as const;

const stateRowSchema = z.object({
  value_json: z.string(),
});

const statusCountRowSchema = z.object({
  status: z.string(),
  count: z.union([z.string(), z.number()]),
});

function normalizeDraftName(value: string): string {
  return normalizeIdentityText(value)
    .replace(/-/g, ' ')
    .trim();
}

function canonicalNormalizedName(value: string): string {
  return normalizeComparableText(normalizeDraftName(value));
}

function normalizeCountry(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return 'SG';
  }
  return normalized;
}

function ensureDraftId(normalizedName: string): string {
  return `draft_${makeStableHash(normalizedName).slice(0, 24)}`;
}

function ensureCommentSourceId(commentId: string): string {
  return `yc_${makeStableHash(commentId).slice(0, 24)}`;
}

function ensureApprovedStallId(normalizedName: string): string {
  return `comment_stall_${makeStableHash(normalizedName).slice(0, 24)}`;
}

function parseJsonArray(input: string): string[] {
  const parsedResult = Result.try(() => JSON.parse(input));
  if (Result.isError(parsedResult) || !Array.isArray(parsedResult.value)) {
    return [];
  }

  return parsedResult.value.filter((item): item is string => typeof item === 'string');
}

function mergeUniqueStrings(...lists: string[][]): string[] {
  const set = new Set<string>();
  for (const list of lists) {
    for (const value of list) {
      const normalized = value.trim();
      if (!normalized) {
        continue;
      }
      set.add(normalized);
    }
  }
  return [...set];
}

export interface CommentSyncRunRecord {
  id: string;
  triggerSource: string;
  mode: 'dry-run' | 'apply';
  status: 'success' | 'failed' | 'guarded';
  startedAt: string;
  finishedAt: string;
  summaryJson: string;
  errorText: string | null;
}

export interface DraftStatusCounts {
  new: number;
  reviewed: number;
  approved: number;
  rejected: number;
}

export interface UpsertDraftSuggestionsSummary {
  inserted: number;
  updated: number;
  skippedRejected: number;
}

export interface ReviewDraftInput {
  draftId: string;
  action: 'review' | 'approve' | 'reject';
  reviewerEmail: string;
  reviewNote?: string;
  rejectedReason?: string;
  editedName?: string;
  editedCountry?: string;
}

export interface ReviewDraftSummary {
  draft: CommentSuggestionDraft;
  approvedStall: ApprovedCommentSourceStall | null;
}

export interface CanonicalStallCommentEvidenceRecord {
  normalizedName: string;
  commentId: string;
  videoId: string;
  likeCount: number;
  confidenceScore: number;
  sourceUrl: string;
  authorDisplayName: string;
}

export async function ensureCommentSuggestionTables(db: D1Database): Promise<Result<void, Error>> {
  for (const statement of schemaStatements) {
    const executionResult = await Result.tryPromise(() => db.prepare(statement).run());
    if (Result.isError(executionResult)) {
      const reason =
        executionResult.error instanceof Error ? executionResult.error.message : String(executionResult.error);
      return Result.err(
        new Error(`Failed to execute comment suggestion schema statement: ${statement}\nReason: ${reason}`)
      );
    }

    if (!executionResult.value.success) {
      return Result.err(new Error(`Comment suggestion schema statement failed: ${statement}`));
    }
  }

  return Result.ok();
}

export async function listCommentSuggestionDrafts(
  db: D1Database,
  options?: {
    status?: DraftStatus | 'all';
    limit?: number;
    offset?: number;
    query?: string;
  }
): Promise<Result<CommentSuggestionDraft[], Error>> {
  const limit = Math.max(1, Math.min(500, Math.trunc(options?.limit ?? 100)));
  const offset = Math.max(0, Math.trunc(options?.offset ?? 0));
  const status = options?.status ?? 'all';
  const query = options?.query?.trim() ?? '';

  const conditions: string[] = [];
  const binds: unknown[] = [];

  if (status !== 'all') {
    conditions.push('status = ?');
    binds.push(status);
  }

  if (query) {
    conditions.push('(display_name LIKE ? OR normalized_name LIKE ?)');
    binds.push(`%${query}%`, `%${normalizeComparableText(query)}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rowsResult = await Result.tryPromise(() =>
    db
      .prepare(
        `SELECT *
         FROM stall_comment_drafts
         ${whereClause}
         ORDER BY confidence_score DESC, support_count DESC, updated_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...binds, limit, offset)
      .all<Record<string, unknown>>()
  );

  if (Result.isError(rowsResult)) {
    return Result.err(new Error('Failed to list comment suggestion drafts.'));
  }

  const drafts: CommentSuggestionDraft[] = [];
  for (const row of rowsResult.value.results) {
    const mappedRow = mapDbDraftRow(row);
    if (Result.isError(mappedRow)) {
      return Result.err(mappedRow.error);
    }

    drafts.push(mappedRow.value);
  }

  return Result.ok(drafts);
}

export async function getCommentSuggestionDraftById(
  db: D1Database,
  draftId: string
): Promise<Result<CommentSuggestionDraft | null, Error>> {
  const rowResult = await Result.tryPromise(() =>
    db.prepare('SELECT * FROM stall_comment_drafts WHERE id = ? LIMIT 1').bind(draftId).first<Record<string, unknown>>()
  );

  if (Result.isError(rowResult)) {
    return Result.err(new Error('Failed to read comment suggestion draft by id.'));
  }

  if (!rowResult.value) {
    return Result.ok(null);
  }

  const mapped = mapDbDraftRow(rowResult.value);
  if (Result.isError(mapped)) {
    return Result.err(mapped.error);
  }

  return Result.ok(mapped.value);
}

export async function listApprovedCommentSourceStalls(
  db: D1Database,
  options?: { includeArchived?: boolean; limit?: number }
): Promise<Result<ApprovedCommentSourceStall[], Error>> {
  const includeArchived = options?.includeArchived ?? false;
  const limit = Math.max(1, Math.min(500, Math.trunc(options?.limit ?? 200)));
  const whereClause = includeArchived ? '' : "WHERE status = 'active'";

  const rowsResult = await Result.tryPromise(() =>
    db
      .prepare(
        `SELECT *
         FROM comment_source_stalls
         ${whereClause}
         ORDER BY support_count DESC, confidence_score DESC, updated_at DESC
         LIMIT ?`
      )
      .bind(limit)
      .all<Record<string, unknown>>()
  );

  if (Result.isError(rowsResult)) {
    return Result.err(new Error('Failed to list approved comment-source stalls.'));
  }

  const stalls: ApprovedCommentSourceStall[] = [];
  for (const row of rowsResult.value.results) {
    const mapped = mapDbApprovedStallRow(row);
    if (Result.isError(mapped)) {
      return Result.err(mapped.error);
    }
    stalls.push(mapped.value);
  }

  return Result.ok(stalls);
}

export async function getDraftStatusCounts(db: D1Database): Promise<Result<DraftStatusCounts, Error>> {
  const rowsResult = await Result.tryPromise(() =>
    db
      .prepare(
        `SELECT status, COUNT(*) AS count
         FROM stall_comment_drafts
         GROUP BY status`
      )
      .all<Record<string, unknown>>()
  );

  if (Result.isError(rowsResult)) {
    return Result.err(new Error('Failed to aggregate draft status counts.'));
  }

  const counts: DraftStatusCounts = {
    new: 0,
    reviewed: 0,
    approved: 0,
    rejected: 0,
  };

  for (const row of rowsResult.value.results) {
    const parsedRow = statusCountRowSchema.safeParse(row);
    if (!parsedRow.success) {
      continue;
    }

    const value = Number(parsedRow.data.count);
    if (!Number.isFinite(value)) {
      continue;
    }

    if (parsedRow.data.status === 'new') counts.new = value;
    if (parsedRow.data.status === 'reviewed') counts.reviewed = value;
    if (parsedRow.data.status === 'approved') counts.approved = value;
    if (parsedRow.data.status === 'rejected') counts.rejected = value;
  }

  return Result.ok(counts);
}

export async function insertCommentSyncRun(
  db: D1Database,
  run: CommentSyncRunRecord
): Promise<Result<void, Error>> {
  const insertResult = await Result.tryPromise(() =>
    db
      .prepare(
        `INSERT INTO comment_sync_runs (
           id,
           trigger_source,
           mode,
           status,
           started_at,
           finished_at,
           summary_json,
           error_text
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        run.id,
        run.triggerSource,
        run.mode,
        run.status,
        run.startedAt,
        run.finishedAt,
        run.summaryJson,
        run.errorText
      )
      .run()
  );

  if (Result.isError(insertResult)) {
    return Result.err(new Error('Failed to insert comment sync run record.'));
  }

  return Result.ok();
}

export async function getCommentSyncState<TSchema extends z.ZodTypeAny>(
  db: D1Database,
  key: string,
  schema: TSchema
): Promise<Result<z.infer<TSchema> | null, Error>> {
  const rowResult = await Result.tryPromise(() =>
    db.prepare('SELECT value_json FROM comment_sync_state WHERE key = ? LIMIT 1').bind(key).first<Record<string, unknown>>()
  );

  if (Result.isError(rowResult)) {
    return Result.err(new Error('Failed to read comment sync state.'));
  }

  if (!rowResult.value) {
    return Result.ok(null);
  }

  const parsedStateRow = stateRowSchema.safeParse(rowResult.value);
  if (!parsedStateRow.success) {
    return Result.err(new Error('Invalid comment sync state payload.'));
  }

  const valueResult = Result.try(() => JSON.parse(parsedStateRow.data.value_json));
  if (Result.isError(valueResult)) {
    return Result.err(new Error('Failed to parse comment sync state JSON payload.'));
  }

  const parsedValue = schema.safeParse(valueResult.value);
  if (!parsedValue.success) {
    return Result.err(new Error('Comment sync state payload does not satisfy schema.'));
  }

  return Result.ok(parsedValue.data);
}

export async function setCommentSyncState(
  db: D1Database,
  key: string,
  value: unknown,
  updatedAtIso: string
): Promise<Result<void, Error>> {
  const encodedValueResult = Result.try(() => JSON.stringify(value));
  if (Result.isError(encodedValueResult)) {
    return Result.err(new Error('Failed to serialize comment sync state payload.'));
  }

  const writeResult = await Result.tryPromise(() =>
    db
      .prepare(
        `INSERT INTO comment_sync_state (key, value_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value_json = excluded.value_json,
           updated_at = excluded.updated_at`
      )
      .bind(key, encodedValueResult.value, updatedAtIso)
      .run()
  );

  if (Result.isError(writeResult)) {
    return Result.err(new Error('Failed to write comment sync state payload.'));
  }

  return Result.ok();
}

export async function upsertYouTubeCommentSourceRecords(
  db: D1Database,
  records: YouTubeCommentSourceRecord[]
): Promise<Result<number, Error>> {
  let upsertedCount = 0;

  for (const record of records) {
    const upsertResult = await Result.tryPromise(() =>
      db
        .prepare(
          `INSERT INTO youtube_comment_sources (
             id,
             video_id,
             video_url,
             video_title,
             comment_id,
             parent_comment_id,
             is_top_level,
             is_pinned,
             like_count,
             author_display_name,
             comment_text,
             published_at,
             source_updated_at,
             fetched_at,
             raw_text_expires_at,
             updated_record_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(comment_id) DO UPDATE SET
             video_id = excluded.video_id,
             video_url = excluded.video_url,
             video_title = excluded.video_title,
             parent_comment_id = excluded.parent_comment_id,
             is_top_level = excluded.is_top_level,
             is_pinned = excluded.is_pinned,
             like_count = excluded.like_count,
             author_display_name = excluded.author_display_name,
             comment_text = excluded.comment_text,
             published_at = excluded.published_at,
             source_updated_at = excluded.source_updated_at,
             fetched_at = excluded.fetched_at,
             raw_text_expires_at = excluded.raw_text_expires_at,
             updated_record_at = excluded.updated_record_at`
        )
        .bind(
          record.id || ensureCommentSourceId(record.commentId),
          record.videoId,
          record.videoUrl,
          record.videoTitle,
          record.commentId,
          record.parentCommentId,
          record.isTopLevel ? 1 : 0,
          record.isPinned ? 1 : 0,
          record.likeCount,
          record.authorDisplayName,
          record.commentText,
          record.publishedAt,
          record.sourceUpdatedAt,
          record.fetchedAt,
          record.rawTextExpiresAt,
          record.fetchedAt
        )
        .run()
    );

    if (Result.isError(upsertResult)) {
      return Result.err(new Error('Failed to upsert YouTube comment source records.'));
    }

    upsertedCount += 1;
  }

  return Result.ok(upsertedCount);
}

export async function upsertCanonicalStallCommentEvidence(
  db: D1Database,
  records: CanonicalStallCommentEvidenceRecord[],
  seenAtIso: string
): Promise<Result<number, Error>> {
  let upsertedCount = 0;

  for (const record of records) {
    const normalizedName = canonicalNormalizedName(record.normalizedName);
    if (!normalizedName) {
      continue;
    }

    const upsertResult = await Result.tryPromise(() =>
      db
        .prepare(
          `INSERT INTO stall_comment_evidence (
             id,
             normalized_name,
             comment_id,
             video_id,
             like_count,
             confidence_score,
             source_url,
             author_display_name,
             last_seen_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(normalized_name, comment_id) DO UPDATE SET
             video_id = excluded.video_id,
             like_count = MAX(stall_comment_evidence.like_count, excluded.like_count),
             confidence_score = MAX(stall_comment_evidence.confidence_score, excluded.confidence_score),
             source_url = excluded.source_url,
             author_display_name = excluded.author_display_name,
             last_seen_at = excluded.last_seen_at`
        )
        .bind(
          `evi_${makeStableHash(`${normalizedName}|${record.commentId}`).slice(0, 24)}`,
          normalizedName,
          record.commentId,
          record.videoId,
          record.likeCount,
          record.confidenceScore,
          record.sourceUrl,
          record.authorDisplayName,
          seenAtIso
        )
        .run()
    );

    if (Result.isError(upsertResult)) {
      return Result.err(new Error('Failed to upsert canonical stall comment evidence.'));
    }

    upsertedCount += 1;
  }

  return Result.ok(upsertedCount);
}

export async function upsertDraftSuggestions(
  db: D1Database,
  drafts: DraftSuggestionAggregate[],
  syncedAtIso: string
): Promise<Result<UpsertDraftSuggestionsSummary, Error>> {
  const existingRowsResult = await Result.tryPromise(() =>
    db.prepare('SELECT * FROM stall_comment_drafts').all<Record<string, unknown>>()
  );

  if (Result.isError(existingRowsResult)) {
    return Result.err(new Error('Failed to read existing draft suggestions.'));
  }

  const existingByNormalizedName = new Map<string, CommentSuggestionDraft>();
  for (const row of existingRowsResult.value.results) {
    const mapped = mapDbDraftRow(row);
    if (Result.isError(mapped)) {
      return Result.err(mapped.error);
    }

    existingByNormalizedName.set(mapped.value.normalizedName, mapped.value);
  }

  let inserted = 0;
  let updated = 0;
  let skippedRejected = 0;

  for (const draft of drafts) {
    const normalizedName = canonicalNormalizedName(draft.normalizedName || draft.displayName);
    if (!normalizedName) {
      continue;
    }

    const existing = existingByNormalizedName.get(normalizedName);
    if (!existing) {
      const insertResult = await Result.tryPromise(() =>
        db
          .prepare(
            `INSERT INTO stall_comment_drafts (
               id,
               normalized_name,
               display_name,
               country,
               confidence_score,
               support_count,
               top_like_count,
               status,
               moderation_flags_json,
               maps_urls_json,
               evidence_comment_ids_json,
               evidence_video_ids_json,
               extraction_method,
               extraction_notes,
               review_note,
               first_seen_at,
               last_seen_at,
               last_synced_at,
               updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?)`
          )
          .bind(
            ensureDraftId(normalizedName),
            normalizedName,
            draft.displayName.trim() || draft.normalizedName,
            normalizeCountry(draft.country),
            draft.confidenceScore,
            draft.supportCount,
            draft.topLikeCount,
            JSON.stringify(draft.moderationFlags),
            JSON.stringify(draft.mapsUrls),
            JSON.stringify(draft.evidenceCommentIds),
            JSON.stringify(draft.evidenceVideoIds),
            draft.extractionMethod,
            draft.extractionNotes,
            syncedAtIso,
            syncedAtIso,
            syncedAtIso,
            syncedAtIso
          )
          .run()
      );

      if (Result.isError(insertResult)) {
        return Result.err(new Error('Failed to insert draft suggestion.'));
      }

      inserted += 1;
      continue;
    }

    const mergedMaps = mergeUniqueStrings(existing.mapsUrls, draft.mapsUrls);
    const mergedCommentIds = mergeUniqueStrings(existing.evidenceCommentIds, draft.evidenceCommentIds);
    const mergedVideoIds = mergeUniqueStrings(existing.evidenceVideoIds, draft.evidenceVideoIds);
    const mergedModerationFlags = mergeUniqueStrings(
      existing.moderationFlags,
      draft.moderationFlags
    );

    if (existing.status === 'rejected') {
      const keepRejectedResult = await Result.tryPromise(() =>
        db
          .prepare(
            `UPDATE stall_comment_drafts
             SET
               support_count = MAX(support_count, ?),
               top_like_count = MAX(top_like_count, ?),
               maps_urls_json = ?,
               evidence_comment_ids_json = ?,
               evidence_video_ids_json = ?,
               moderation_flags_json = ?,
               last_seen_at = ?,
               last_synced_at = ?,
               updated_at = ?
             WHERE id = ?`
          )
          .bind(
            draft.supportCount,
            draft.topLikeCount,
            JSON.stringify(mergedMaps),
            JSON.stringify(mergedCommentIds),
            JSON.stringify(mergedVideoIds),
            JSON.stringify(mergedModerationFlags),
            syncedAtIso,
            syncedAtIso,
            syncedAtIso,
            existing.id
          )
          .run()
      );

      if (Result.isError(keepRejectedResult)) {
        return Result.err(new Error('Failed to update rejected draft suggestion metadata.'));
      }

      skippedRejected += 1;
      continue;
    }

    const nextConfidenceScore = Math.max(existing.confidenceScore, draft.confidenceScore);
    const nextSupportCount = Math.max(existing.supportCount, draft.supportCount);
    const nextTopLikeCount = Math.max(existing.topLikeCount, draft.topLikeCount);
    const preserveCuratedFields = existing.status === 'approved' || existing.status === 'reviewed';
    const displayNameToPersist = preserveCuratedFields
      ? existing.displayName
      : draft.displayName.trim() || existing.displayName;
    const countryToPersist = preserveCuratedFields
      ? existing.country
      : normalizeCountry(draft.country || existing.country);

    const updateResult = await Result.tryPromise(() =>
      db
        .prepare(
          `UPDATE stall_comment_drafts
           SET
             display_name = ?,
             country = ?,
             confidence_score = ?,
             support_count = ?,
             top_like_count = ?,
             moderation_flags_json = ?,
             maps_urls_json = ?,
             evidence_comment_ids_json = ?,
             evidence_video_ids_json = ?,
             extraction_method = ?,
             extraction_notes = ?,
             last_seen_at = ?,
             last_synced_at = ?,
             updated_at = ?
           WHERE id = ?`
        )
        .bind(
          displayNameToPersist,
          countryToPersist,
          nextConfidenceScore,
          nextSupportCount,
          nextTopLikeCount,
          JSON.stringify(mergedModerationFlags),
          JSON.stringify(mergedMaps),
          JSON.stringify(mergedCommentIds),
          JSON.stringify(mergedVideoIds),
          draft.extractionMethod === existing.extractionMethod ? existing.extractionMethod : 'mixed',
          [existing.extractionNotes, draft.extractionNotes].filter(Boolean).join(' | ').slice(0, 600),
          syncedAtIso,
          syncedAtIso,
          syncedAtIso,
          existing.id
        )
        .run()
    );

    if (Result.isError(updateResult)) {
      return Result.err(new Error('Failed to update draft suggestion.'));
    }

    updated += 1;
  }

  return Result.ok({
    inserted,
    updated,
    skippedRejected,
  });
}

export async function pruneExpiredCommentSourceRawText(
  db: D1Database,
  cutoffIso: string
): Promise<Result<void, Error>> {
  const pruneResult = await Result.tryPromise(() =>
    db
      .prepare(
        `UPDATE youtube_comment_sources
         SET comment_text = ''
         WHERE raw_text_expires_at <= ? AND comment_text <> ''`
      )
      .bind(cutoffIso)
      .run()
  );

  if (Result.isError(pruneResult)) {
    return Result.err(new Error('Failed to prune expired raw comment text.'));
  }

  return Result.ok();
}

async function resolveUniqueSlug(
  db: D1Database,
  requestedName: string,
  normalizedName: string
): Promise<Result<string, Error>> {
  const baseSlugCandidate = slugify(requestedName) || deriveSlug(requestedName, normalizedName);
  const baseSlug = baseSlugCandidate || `community-${makeStableHash(normalizedName).slice(0, 8)}`;

  const existingRowResult = await Result.tryPromise(() =>
    db
      .prepare('SELECT slug, normalized_name FROM comment_source_stalls WHERE slug = ? LIMIT 1')
      .bind(baseSlug)
      .first<Record<string, unknown>>()
  );

  if (Result.isError(existingRowResult)) {
    return Result.err(new Error('Failed to resolve unique comment-source slug.'));
  }

  const existingSlug = existingRowResult.value?.slug;
  const existingNormalizedName =
    typeof existingRowResult.value?.normalized_name === 'string'
      ? normalizeComparableText(existingRowResult.value.normalized_name)
      : null;

  if (!existingSlug || existingNormalizedName === normalizedName) {
    return Result.ok(baseSlug);
  }

  return Result.ok(`${baseSlug}-${makeStableHash(normalizedName).slice(0, 6)}`);
}

export async function reviewDraftSuggestion(
  db: D1Database,
  input: ReviewDraftInput,
  reviewedAtIso: string
): Promise<Result<ReviewDraftSummary, Error>> {
  const draftResult = await getCommentSuggestionDraftById(db, input.draftId);
  if (Result.isError(draftResult)) {
    return Result.err(draftResult.error);
  }

  const draft = draftResult.value;
  if (!draft) {
    return Result.err(new Error('Draft suggestion not found.'));
  }

  const nextReviewNote = input.reviewNote?.trim() ?? draft.reviewNote;
  if (input.action === 'review') {
    const updateResult = await Result.tryPromise(() =>
      db
        .prepare(
          `UPDATE stall_comment_drafts
           SET status = 'reviewed',
               review_note = ?,
               reviewed_by = ?,
               reviewed_at = ?,
               updated_at = ?
           WHERE id = ?`
        )
        .bind(nextReviewNote, input.reviewerEmail, reviewedAtIso, reviewedAtIso, draft.id)
        .run()
    );

    if (Result.isError(updateResult)) {
      return Result.err(new Error('Failed to mark draft suggestion as reviewed.'));
    }

    const refreshedResult = await getCommentSuggestionDraftById(db, draft.id);
    if (Result.isError(refreshedResult)) {
      return Result.err(refreshedResult.error);
    }

    if (!refreshedResult.value) {
      return Result.err(new Error('Draft suggestion disappeared after review update.'));
    }

    return Result.ok({
      draft: refreshedResult.value,
      approvedStall: null,
    });
  }

  if (input.action === 'reject') {
    const rejectedReason = input.rejectedReason?.trim() || 'Rejected by admin review.';
    const rejectResult = await Result.tryPromise(() =>
      db
        .prepare(
          `UPDATE stall_comment_drafts
           SET status = 'rejected',
               rejected_reason = ?,
               review_note = ?,
               reviewed_by = ?,
               reviewed_at = ?,
               updated_at = ?
           WHERE id = ?`
        )
        .bind(rejectedReason, nextReviewNote, input.reviewerEmail, reviewedAtIso, reviewedAtIso, draft.id)
        .run()
    );

    if (Result.isError(rejectResult)) {
      return Result.err(new Error('Failed to reject draft suggestion.'));
    }

    const refreshedResult = await getCommentSuggestionDraftById(db, draft.id);
    if (Result.isError(refreshedResult)) {
      return Result.err(refreshedResult.error);
    }

    if (!refreshedResult.value) {
      return Result.err(new Error('Draft suggestion disappeared after rejection update.'));
    }

    return Result.ok({
      draft: refreshedResult.value,
      approvedStall: null,
    });
  }

  const approvedName = input.editedName?.trim() || draft.displayName;
  const approvedCountry = normalizeCountry(input.editedCountry || draft.country);
  const normalizedName = canonicalNormalizedName(approvedName);

  if (!normalizedName) {
    return Result.err(new Error('Approved stall name cannot be empty.'));
  }

  const slugResult = await resolveUniqueSlug(db, approvedName, normalizedName);
  if (Result.isError(slugResult)) {
    return Result.err(slugResult.error);
  }

  const approvedStallId = ensureApprovedStallId(normalizedName);
  const stallUpsertResult = await Result.tryPromise(() =>
    db
      .prepare(
        `INSERT INTO comment_source_stalls (
           id,
           slug,
           normalized_name,
           name,
           country,
           source_draft_id,
           confidence_score,
           support_count,
           top_like_count,
           status,
           approved_by,
           approved_at,
           notes,
           updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
         ON CONFLICT(normalized_name) DO UPDATE SET
           slug = excluded.slug,
           name = excluded.name,
           country = excluded.country,
           source_draft_id = excluded.source_draft_id,
           confidence_score = excluded.confidence_score,
           support_count = excluded.support_count,
           top_like_count = excluded.top_like_count,
           status = excluded.status,
           approved_by = excluded.approved_by,
           approved_at = excluded.approved_at,
           notes = excluded.notes,
           updated_at = excluded.updated_at`
      )
      .bind(
        approvedStallId,
        slugResult.value,
        normalizedName,
        approvedName,
        approvedCountry,
        draft.id,
        draft.confidenceScore,
        draft.supportCount,
        draft.topLikeCount,
        input.reviewerEmail,
        reviewedAtIso,
        nextReviewNote,
        reviewedAtIso
      )
      .run()
  );

  if (Result.isError(stallUpsertResult)) {
    return Result.err(new Error('Failed to upsert approved comment-source stall.'));
  }

  const draftApproveResult = await Result.tryPromise(() =>
    db
      .prepare(
        `UPDATE stall_comment_drafts
         SET
           normalized_name = ?,
           display_name = ?,
           country = ?,
           status = 'approved',
           review_note = ?,
           reviewed_by = ?,
           reviewed_at = ?,
           approved_stall_id = ?,
           rejected_reason = NULL,
           updated_at = ?
         WHERE id = ?`
      )
      .bind(
        normalizedName,
        approvedName,
        approvedCountry,
        nextReviewNote,
        input.reviewerEmail,
        reviewedAtIso,
        approvedStallId,
        reviewedAtIso,
        draft.id
      )
      .run()
  );

  if (Result.isError(draftApproveResult)) {
    return Result.err(new Error('Failed to update draft status after approval.'));
  }

  const refreshedDraftResult = await getCommentSuggestionDraftById(db, draft.id);
  if (Result.isError(refreshedDraftResult)) {
    return Result.err(refreshedDraftResult.error);
  }

  if (!refreshedDraftResult.value) {
    return Result.err(new Error('Draft suggestion disappeared after approval update.'));
  }

  const approvedStallsResult = await listApprovedCommentSourceStalls(db, {
    includeArchived: true,
    limit: 500,
  });

  if (Result.isError(approvedStallsResult)) {
    return Result.err(approvedStallsResult.error);
  }

  const approvedStall =
    approvedStallsResult.value.find((stall) => stall.id === approvedStallId || stall.normalizedName === normalizedName) ??
    null;

  return Result.ok({
    draft: refreshedDraftResult.value,
    approvedStall,
  });
}

export async function loadRejectedDraftNameSet(db: D1Database): Promise<Result<Set<string>, Error>> {
  const rowsResult = await Result.tryPromise(() =>
    db
      .prepare("SELECT normalized_name FROM stall_comment_drafts WHERE status = 'rejected'")
      .all<Record<string, unknown>>()
  );

  if (Result.isError(rowsResult)) {
    return Result.err(new Error('Failed to read rejected draft names.'));
  }

  const set = new Set<string>();
  for (const row of rowsResult.value.results) {
    if (typeof row.normalized_name !== 'string') {
      continue;
    }
    set.add(normalizeComparableText(row.normalized_name));
  }

  return Result.ok(set);
}

export async function loadCanonicalStallNameSet(db: D1Database): Promise<Result<Set<string>, Error>> {
  const rowsResult = await Result.tryPromise(() =>
    db
      .prepare("SELECT name FROM stalls WHERE status = 'active'")
      .all<Record<string, unknown>>()
  );

  if (Result.isError(rowsResult)) {
    return Result.err(new Error('Failed to read canonical stall names.'));
  }

  const names = new Set<string>();
  for (const row of rowsResult.value.results) {
    if (typeof row.name !== 'string') {
      continue;
    }

    const normalized = canonicalNormalizedName(row.name);
    if (!normalized) {
      continue;
    }

    names.add(normalized);
  }

  return Result.ok(names);
}

export function parseStoredStateArray(value: string): string[] {
  return parseJsonArray(value);
}
