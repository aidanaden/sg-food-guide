import { Result } from 'better-result';
import * as z from 'zod';

import type { WorkerEnv, WorkerExecutionContextLike } from '../cloudflare/runtime';
import {
  type CanonicalStallCommentEvidenceRecord,
  ensureCommentSuggestionTables,
  getCommentSyncState,
  insertCommentSyncRun,
  loadCanonicalStallNameSet,
  pruneExpiredCommentSourceRawText,
  setCommentSyncState,
  upsertCanonicalStallCommentEvidence,
  upsertDraftSuggestions,
  upsertYouTubeCommentSourceRecords,
} from '../comment-suggestions/repository';
import { ensureStallTables } from '../stalls/repository';
import {
  extractStallSuggestionsFromComment,
  hasBlockingModerationFlags,
} from './comment-suggestion-extraction';
import { makeStableHash, normalizeComparableText, normalizeDisplayText } from './normalize';
import {
  fetchTopYouTubeCommentsForVideo,
  fetchYouTubeVideoMetadata,
  type YouTubeCommentEntry,
} from './youtube-comments-source';
import { fetchYouTubeVideos, type YouTubeVideoEntry } from './youtube-source';

export type CommentSuggestionSyncMode = 'dry-run' | 'apply';
export type CommentSuggestionSyncStatus = 'success' | 'failed' | 'guarded';

export interface CommentSuggestionSyncSummary {
  runId: string;
  triggerSource: string;
  mode: CommentSuggestionSyncMode;
  status: CommentSuggestionSyncStatus;
  startedAt: string;
  finishedAt: string;
  sourceStats: {
    videosConsidered: number;
    videosProcessed: number;
    videosSkippedNonRegular: number;
    topLevelCommentsFetched: number;
    repliesFetched: number;
    commentSourceRecords: number;
    draftCandidates: number;
    canonicalEvidenceCandidates: number;
  };
  changeStats: {
    insertedDrafts: number;
    updatedDrafts: number;
    skippedRejectedDrafts: number;
    canonicalEvidenceUpserts: number;
    highConfidenceDraftCandidates: number;
  };
  applyStats: {
    upsertedCommentSources: number;
    prunedRawCommentRows: number;
    stateUpdated: boolean;
    alertSent: boolean;
  };
  warnings: string[];
  error: string | null;
}

export interface RunCommentSuggestionSyncArgs {
  env: WorkerEnv;
  triggerSource: string;
  executionCtx?: WorkerExecutionContextLike | null;
  modeOverride?: CommentSuggestionSyncMode;
  forceApply?: boolean;
}

interface SyncVideoCandidate {
  videoId: string;
  videoUrl: string;
  title: string;
  publishedAt: string;
}

interface DraftAggregateAccumulator {
  normalizedName: string;
  displayName: string;
  country: string;
  confidenceScore: number;
  topLikeCount: number;
  moderationFlags: Set<string>;
  mapsUrls: Set<string>;
  evidenceCommentIds: Set<string>;
  evidenceVideoIds: Set<string>;
  extractionMethods: Set<'rules' | 'llm' | 'mixed'>;
  extractionNotes: Set<string>;
}

const COMMENT_SYNC_STATE_KEY = 'youtube-comment-sync-progress:v1';
const backfillStateSchema = z.object({
  backfillOffset: z.number(),
  backfillCompleted: z.boolean(),
  lastIncrementalPublishedAt: z.optional(z.union([z.string(), z.null()])),
});

const DEFAULT_MAX_VIDEOS_PER_RUN = 30;
const DEFAULT_TOP_LEVEL_LIMIT = 50;
const DEFAULT_MIN_LIKES = 2;
const DEFAULT_HIGH_CONFIDENCE_THRESHOLD = 80;
const DEFAULT_LLM_MAX_COMMENTS_PER_RUN = 25;
const RAW_COMMENT_RETENTION_DAYS = 90;

function nowIso(): string {
  return new Date().toISOString();
}

function boolFromValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'n'].includes(normalized)) return false;
  return fallback;
}

function numberFromValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function resolveSyncMode(args: RunCommentSuggestionSyncArgs): CommentSuggestionSyncMode {
  if (args.modeOverride) {
    return args.modeOverride;
  }

  return args.env.COMMENT_SYNC_MODE === 'apply' ? 'apply' : 'dry-run';
}

function shouldForceApply(args: RunCommentSuggestionSyncArgs): boolean {
  return boolFromValue(args.forceApply ?? args.env.COMMENT_SYNC_FORCE_APPLY, false);
}

function resolveMaxVideosPerRun(env: WorkerEnv): number {
  const raw = numberFromValue(env.COMMENT_SYNC_MAX_VIDEOS_PER_RUN, DEFAULT_MAX_VIDEOS_PER_RUN);
  return Math.max(1, Math.min(100, Math.trunc(raw)));
}

function resolveTopLevelLimit(env: WorkerEnv): number {
  const raw = numberFromValue(env.COMMENT_SYNC_TOP_LEVEL_LIMIT, DEFAULT_TOP_LEVEL_LIMIT);
  return Math.max(1, Math.min(100, Math.trunc(raw)));
}

function resolveMinLikes(env: WorkerEnv): number {
  const raw = numberFromValue(env.COMMENT_SYNC_MIN_LIKES, DEFAULT_MIN_LIKES);
  return Math.max(0, Math.min(1000, Math.trunc(raw)));
}

function resolveHighConfidenceThreshold(env: WorkerEnv): number {
  const raw = numberFromValue(env.COMMENT_SYNC_HIGH_CONFIDENCE_THRESHOLD, DEFAULT_HIGH_CONFIDENCE_THRESHOLD);
  return Math.max(0, Math.min(100, Math.trunc(raw)));
}

function resolveLlmMaxCommentsPerRun(env: WorkerEnv): number {
  const raw = numberFromValue(env.COMMENT_SYNC_LLM_MAX_COMMENTS_PER_RUN, DEFAULT_LLM_MAX_COMMENTS_PER_RUN);
  return Math.max(0, Math.min(200, Math.trunc(raw)));
}

function resolveLlmEnabled(env: WorkerEnv): boolean {
  const fallback = Boolean(normalizeDisplayText(env.OPENAI_API_KEY ?? ''));
  return boolFromValue(env.COMMENT_SYNC_LLM_ENABLED, fallback);
}

function addDaysIso(isoDate: string, days: number): string {
  const base = new Date(isoDate);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString();
}

function toPublishedAtValue(input: string): number {
  const value = Date.parse(input);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value;
}

function buildRunId(startedAtIso: string): string {
  return `comment-sync-${makeStableHash(startedAtIso).slice(0, 16)}`;
}

function toTelegramMessage(summary: CommentSuggestionSyncSummary): string {
  const lines = [
    'SG Food Guide Comment Suggestion Sync',
    `Run: ${summary.runId}`,
    `Status: ${summary.status}`,
    `Mode: ${summary.mode}`,
    `Trigger: ${summary.triggerSource}`,
    `Videos: ${summary.sourceStats.videosProcessed}/${summary.sourceStats.videosConsidered}`,
    `Comments: ${summary.sourceStats.topLevelCommentsFetched} top-level + ${summary.sourceStats.repliesFetched} replies`,
    `Draft candidates: ${summary.sourceStats.draftCandidates}`,
    `High-confidence (>= threshold): ${summary.changeStats.highConfidenceDraftCandidates}`,
    `Draft changes: +${summary.changeStats.insertedDrafts} / ~${summary.changeStats.updatedDrafts}`,
  ];

  if (summary.warnings.length > 0) {
    lines.push(`Warnings: ${summary.warnings.join(' | ')}`);
  }

  if (summary.error) {
    lines.push(`Error: ${summary.error}`);
  }

  return lines.join('\n');
}

async function sendTelegramAlert(env: WorkerEnv, summary: CommentSuggestionSyncSummary): Promise<Result<void, Error>> {
  const botToken = normalizeDisplayText(env.TELEGRAM_BOT_TOKEN ?? '');
  const chatId = normalizeDisplayText(env.TELEGRAM_CHAT_ID ?? '');

  if (!botToken || !chatId) {
    return Result.ok();
  }

  const responseResult = await Result.tryPromise(() =>
    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: toTelegramMessage(summary),
        disable_web_page_preview: true,
      }),
    })
  );

  if (Result.isError(responseResult)) {
    return Result.err(new Error('Failed to send Telegram alert for comment suggestion sync.'));
  }

  if (!responseResult.value.ok) {
    return Result.err(new Error(`Telegram alert request failed with HTTP ${responseResult.value.status}.`));
  }

  return Result.ok();
}

function normalizeVideoCandidates(entries: YouTubeVideoEntry[]): SyncVideoCandidate[] {
  const candidates: SyncVideoCandidate[] = [];

  for (const entry of entries) {
    const publishedAt = normalizeDisplayText(entry.publishedAt);
    if (!publishedAt) {
      continue;
    }

    candidates.push({
      videoId: entry.videoId,
      videoUrl: entry.videoUrl,
      title: normalizeDisplayText(entry.title) || entry.videoId,
      publishedAt,
    });
  }

  return candidates;
}

function selectVideosForRun(
  allRegularCandidates: SyncVideoCandidate[],
  state: z.infer<typeof backfillStateSchema> | null,
  maxVideosPerRun: number
): {
  selected: SyncVideoCandidate[];
  nextState: z.infer<typeof backfillStateSchema>;
} {
  const sortedByPublishedAtAsc = [...allRegularCandidates].sort(
    (left, right) => toPublishedAtValue(left.publishedAt) - toPublishedAtValue(right.publishedAt)
  );

  const fallbackState: z.infer<typeof backfillStateSchema> = {
    backfillOffset: 0,
    backfillCompleted: false,
    lastIncrementalPublishedAt: null,
  };

  const currentState = state ?? fallbackState;
  if (!currentState.backfillCompleted) {
    const offset = Math.max(0, Math.min(sortedByPublishedAtAsc.length, currentState.backfillOffset));
    const selected = sortedByPublishedAtAsc.slice(offset, offset + maxVideosPerRun);

    const nextOffset = offset + selected.length;
    const latestSeenPublishedAt =
      sortedByPublishedAtAsc.length > 0
        ? sortedByPublishedAtAsc[sortedByPublishedAtAsc.length - 1]?.publishedAt ?? null
        : currentState.lastIncrementalPublishedAt ?? null;

    return {
      selected,
      nextState: {
        backfillOffset: nextOffset,
        backfillCompleted: nextOffset >= sortedByPublishedAtAsc.length,
        lastIncrementalPublishedAt: nextOffset >= sortedByPublishedAtAsc.length ? latestSeenPublishedAt : null,
      },
    };
  }

  const watermark = normalizeDisplayText(currentState.lastIncrementalPublishedAt ?? '');
  const sortedByPublishedAtDesc = [...allRegularCandidates].sort(
    (left, right) => toPublishedAtValue(right.publishedAt) - toPublishedAtValue(left.publishedAt)
  );

  const incrementalCandidates = sortedByPublishedAtDesc.filter((candidate) => {
    if (!watermark) {
      return true;
    }
    return toPublishedAtValue(candidate.publishedAt) > toPublishedAtValue(watermark);
  });

  const selected = incrementalCandidates.slice(0, maxVideosPerRun);
  const maxPublishedAt = selected.reduce<string | null>((current, candidate) => {
    if (!current) {
      return candidate.publishedAt;
    }

    return toPublishedAtValue(candidate.publishedAt) > toPublishedAtValue(current)
      ? candidate.publishedAt
      : current;
  }, watermark || null);

  return {
    selected,
    nextState: {
      backfillOffset: currentState.backfillOffset,
      backfillCompleted: true,
      lastIncrementalPublishedAt: maxPublishedAt,
    },
  };
}

function ensureDraftAccumulator(
  map: Map<string, DraftAggregateAccumulator>,
  normalizedName: string,
  displayName: string
): DraftAggregateAccumulator {
  const existing = map.get(normalizedName);
  if (existing) {
    return existing;
  }

  const created: DraftAggregateAccumulator = {
    normalizedName,
    displayName,
    country: 'SG',
    confidenceScore: 0,
    topLikeCount: 0,
    moderationFlags: new Set<string>(),
    mapsUrls: new Set<string>(),
    evidenceCommentIds: new Set<string>(),
    evidenceVideoIds: new Set<string>(),
    extractionMethods: new Set<'rules' | 'llm' | 'mixed'>(),
    extractionNotes: new Set<string>(),
  };
  map.set(normalizedName, created);
  return created;
}

function aggregateDraftSuggestions(
  comments: YouTubeCommentEntry[],
  extractedByCommentId: Map<string, Awaited<ReturnType<typeof extractStallSuggestionsFromComment>>>,
  canonicalStallNameSet: Set<string>,
  minLikes: number,
  highConfidenceThreshold: number
): {
  draftAggregates: Array<{
    normalizedName: string;
    displayName: string;
    country: string;
    confidenceScore: number;
    supportCount: number;
    topLikeCount: number;
    moderationFlags: Array<'spam' | 'profanity' | 'self-promo' | 'insufficient-signal'>;
    mapsUrls: string[];
    evidenceCommentIds: string[];
    evidenceVideoIds: string[];
    extractionMethod: 'rules' | 'llm' | 'mixed';
    extractionNotes: string;
  }>;
  canonicalEvidenceCandidates: CanonicalStallCommentEvidenceRecord[];
  highConfidenceDraftCandidates: number;
} {
  const byNormalizedName = new Map<string, DraftAggregateAccumulator>();
  const canonicalEvidenceCandidates: CanonicalStallCommentEvidenceRecord[] = [];

  for (const comment of comments) {
    const extractedResult = extractedByCommentId.get(comment.commentId);
    if (!extractedResult || Result.isError(extractedResult)) {
      continue;
    }

    for (const suggestion of extractedResult.value) {
      if (hasBlockingModerationFlags(suggestion.moderationFlags)) {
        continue;
      }

      const shouldFilterByLikes = comment.isTopLevel && !comment.isPinned;
      if (shouldFilterByLikes && comment.likeCount < minLikes) {
        continue;
      }

      const normalizedName = normalizeComparableText(suggestion.normalizedName);
      if (!normalizedName) {
        continue;
      }

      if (canonicalStallNameSet.has(normalizedName)) {
        canonicalEvidenceCandidates.push({
          normalizedName,
          commentId: comment.commentId,
          videoId: comment.videoId,
          likeCount: comment.likeCount,
          confidenceScore: suggestion.confidenceScore,
          sourceUrl: comment.videoUrl,
          authorDisplayName: comment.authorDisplayName,
        });
        continue;
      }

      const accumulator = ensureDraftAccumulator(byNormalizedName, normalizedName, suggestion.displayName);
      if (suggestion.displayName.length > accumulator.displayName.length) {
        accumulator.displayName = suggestion.displayName;
      }
      accumulator.confidenceScore = Math.max(accumulator.confidenceScore, suggestion.confidenceScore);
      accumulator.topLikeCount = Math.max(accumulator.topLikeCount, comment.likeCount);
      accumulator.evidenceCommentIds.add(comment.commentId);
      accumulator.evidenceVideoIds.add(comment.videoId);
      accumulator.extractionMethods.add(suggestion.extractionMethod);
      accumulator.extractionNotes.add(suggestion.extractionNotes);

      for (const flag of suggestion.moderationFlags) {
        accumulator.moderationFlags.add(flag);
      }

      for (const mapsUrl of suggestion.mapsUrls) {
        accumulator.mapsUrls.add(mapsUrl);
      }
    }
  }

  const draftAggregates = [...byNormalizedName.values()].map((accumulator) => {
    let extractionMethod: 'rules' | 'llm' | 'mixed' = 'rules';
    if (accumulator.extractionMethods.size > 1) {
      extractionMethod = 'mixed';
    } else if (accumulator.extractionMethods.has('llm')) {
      extractionMethod = 'llm';
    }

    return {
      normalizedName: accumulator.normalizedName,
      displayName: accumulator.displayName,
      country: accumulator.country,
      confidenceScore: accumulator.confidenceScore,
      supportCount: accumulator.evidenceCommentIds.size,
      topLikeCount: accumulator.topLikeCount,
      moderationFlags: [...accumulator.moderationFlags] as Array<
        'spam' | 'profanity' | 'self-promo' | 'insufficient-signal'
      >,
      mapsUrls: [...accumulator.mapsUrls],
      evidenceCommentIds: [...accumulator.evidenceCommentIds],
      evidenceVideoIds: [...accumulator.evidenceVideoIds],
      extractionMethod,
      extractionNotes: [...accumulator.extractionNotes].join(' | ').slice(0, 600),
    };
  });

  const highConfidenceDraftCandidates = draftAggregates.filter(
    (aggregate) => aggregate.confidenceScore >= highConfidenceThreshold
  ).length;

  return {
    draftAggregates,
    canonicalEvidenceCandidates,
    highConfidenceDraftCandidates,
  };
}

export async function runCommentSuggestionSync(
  args: RunCommentSuggestionSyncArgs
): Promise<CommentSuggestionSyncSummary> {
  const startedAt = nowIso();
  const runId = buildRunId(startedAt);
  const mode = resolveSyncMode(args);
  const forceApply = shouldForceApply(args);
  const maxVideosPerRun = resolveMaxVideosPerRun(args.env);
  const topLevelLimit = resolveTopLevelLimit(args.env);
  const minLikes = resolveMinLikes(args.env);
  const highConfidenceThreshold = resolveHighConfidenceThreshold(args.env);
  const llmEnabled = resolveLlmEnabled(args.env);
  const llmMaxCommentsPerRun = resolveLlmMaxCommentsPerRun(args.env);

  const baseSummary: CommentSuggestionSyncSummary = {
    runId,
    triggerSource: args.triggerSource,
    mode,
    status: 'failed',
    startedAt,
    finishedAt: startedAt,
    sourceStats: {
      videosConsidered: 0,
      videosProcessed: 0,
      videosSkippedNonRegular: 0,
      topLevelCommentsFetched: 0,
      repliesFetched: 0,
      commentSourceRecords: 0,
      draftCandidates: 0,
      canonicalEvidenceCandidates: 0,
    },
    changeStats: {
      insertedDrafts: 0,
      updatedDrafts: 0,
      skippedRejectedDrafts: 0,
      canonicalEvidenceUpserts: 0,
      highConfidenceDraftCandidates: 0,
    },
    applyStats: {
      upsertedCommentSources: 0,
      prunedRawCommentRows: 0,
      stateUpdated: false,
      alertSent: false,
    },
    warnings: [],
    error: null,
  };

  const syncResult = await Result.tryPromise(async () => {
    const ensureTablesResult = await ensureCommentSuggestionTables(args.env.STALLS_DB);
    if (Result.isError(ensureTablesResult)) {
      throw ensureTablesResult.error;
    }

    const ensureStallsResult = await ensureStallTables(args.env.STALLS_DB);
    if (Result.isError(ensureStallsResult)) {
      throw ensureStallsResult.error;
    }

    const backfillStateResult = await getCommentSyncState(
      args.env.STALLS_DB,
      COMMENT_SYNC_STATE_KEY,
      backfillStateSchema
    );
    if (Result.isError(backfillStateResult)) {
      throw backfillStateResult.error;
    }

    const canonicalNameSetResult = await loadCanonicalStallNameSet(args.env.STALLS_DB);
    if (Result.isError(canonicalNameSetResult)) {
      throw canonicalNameSetResult.error;
    }

    const videosResult = await fetchYouTubeVideos(args.env);
    if (Result.isError(videosResult)) {
      throw videosResult.error;
    }

    const normalizedCandidates = normalizeVideoCandidates(videosResult.value);
    baseSummary.sourceStats.videosConsidered = normalizedCandidates.length;

    const metadataByVideoIdResult = await fetchYouTubeVideoMetadata(
      args.env,
      normalizedCandidates.map((candidate) => candidate.videoId)
    );
    if (Result.isError(metadataByVideoIdResult)) {
      throw metadataByVideoIdResult.error;
    }

    const regularCandidates = normalizedCandidates.filter((candidate) => {
      const metadata = metadataByVideoIdResult.value.get(candidate.videoId);
      if (!metadata) {
        return true;
      }
      return metadata.isRegularVideo;
    });

    baseSummary.sourceStats.videosSkippedNonRegular =
      normalizedCandidates.length - regularCandidates.length;

    const selection = selectVideosForRun(
      regularCandidates,
      backfillStateResult.value,
      maxVideosPerRun
    );

    const selectedVideos = selection.selected;
    const nextState = selection.nextState;

    const fetchedComments: YouTubeCommentEntry[] = [];
    let repliesFetched = 0;

    for (const video of selectedVideos) {
      const commentResult = await fetchTopYouTubeCommentsForVideo(args.env, {
        videoId: video.videoId,
        videoTitle: video.title,
        topLevelLimit,
      });

      if (Result.isError(commentResult)) {
        baseSummary.warnings.push(
          `Failed to fetch comments for ${video.videoId}: ${normalizeDisplayText(commentResult.error.message).slice(0, 220)}`
        );
        continue;
      }

      fetchedComments.push(...commentResult.value.comments);
      repliesFetched += commentResult.value.repliesFetched;
      baseSummary.sourceStats.videosProcessed += 1;
    }

    baseSummary.sourceStats.repliesFetched = repliesFetched;
    baseSummary.sourceStats.topLevelCommentsFetched = fetchedComments.filter((item) => item.isTopLevel).length;

    const rawTextExpiresAt = addDaysIso(startedAt, RAW_COMMENT_RETENTION_DAYS);
    const sourceRecords = fetchedComments.map((comment) => ({
      id: `yc_${makeStableHash(comment.commentId).slice(0, 24)}`,
      videoId: comment.videoId,
      videoUrl: comment.videoUrl,
      videoTitle: comment.videoTitle,
      commentId: comment.commentId,
      parentCommentId: comment.parentCommentId,
      isTopLevel: comment.isTopLevel,
      isPinned: comment.isPinned,
      likeCount: comment.likeCount,
      authorDisplayName: comment.authorDisplayName,
      commentText: comment.text,
      publishedAt: comment.publishedAt,
      sourceUpdatedAt: comment.updatedAt,
      fetchedAt: startedAt,
      rawTextExpiresAt,
    }));

    baseSummary.sourceStats.commentSourceRecords = sourceRecords.length;

    let llmBudget = llmEnabled ? llmMaxCommentsPerRun : 0;
    const extractedByCommentId = new Map<string, Awaited<ReturnType<typeof extractStallSuggestionsFromComment>>>();

    for (const comment of fetchedComments) {
      const shouldUseLlm = llmBudget > 0 && comment.likeCount >= minLikes;
      if (shouldUseLlm) {
        llmBudget -= 1;
      }

      const extractedResult = await extractStallSuggestionsFromComment(args.env, comment, {
        llmEnabled: shouldUseLlm,
      });

      extractedByCommentId.set(comment.commentId, extractedResult);
    }

    const aggregateResult = aggregateDraftSuggestions(
      fetchedComments,
      extractedByCommentId,
      canonicalNameSetResult.value,
      minLikes,
      highConfidenceThreshold
    );

    baseSummary.sourceStats.draftCandidates = aggregateResult.draftAggregates.length;
    baseSummary.sourceStats.canonicalEvidenceCandidates =
      aggregateResult.canonicalEvidenceCandidates.length;
    baseSummary.changeStats.highConfidenceDraftCandidates =
      aggregateResult.highConfidenceDraftCandidates;

    const shouldApply = mode === 'apply' || forceApply;
    if (shouldApply) {
      const upsertSourcesResult = await upsertYouTubeCommentSourceRecords(args.env.STALLS_DB, sourceRecords);
      if (Result.isError(upsertSourcesResult)) {
        throw upsertSourcesResult.error;
      }
      baseSummary.applyStats.upsertedCommentSources = upsertSourcesResult.value;

      const evidenceUpsertResult = await upsertCanonicalStallCommentEvidence(
        args.env.STALLS_DB,
        aggregateResult.canonicalEvidenceCandidates,
        startedAt
      );
      if (Result.isError(evidenceUpsertResult)) {
        throw evidenceUpsertResult.error;
      }
      baseSummary.changeStats.canonicalEvidenceUpserts = evidenceUpsertResult.value;

      const draftUpsertResult = await upsertDraftSuggestions(
        args.env.STALLS_DB,
        aggregateResult.draftAggregates,
        startedAt
      );
      if (Result.isError(draftUpsertResult)) {
        throw draftUpsertResult.error;
      }
      baseSummary.changeStats.insertedDrafts = draftUpsertResult.value.inserted;
      baseSummary.changeStats.updatedDrafts = draftUpsertResult.value.updated;
      baseSummary.changeStats.skippedRejectedDrafts = draftUpsertResult.value.skippedRejected;

      const pruneResult = await pruneExpiredCommentSourceRawText(args.env.STALLS_DB, startedAt);
      if (Result.isError(pruneResult)) {
        baseSummary.warnings.push('Failed to prune expired raw comment text.');
      } else {
        baseSummary.applyStats.prunedRawCommentRows = 1;
      }

      const stateUpdateResult = await setCommentSyncState(args.env.STALLS_DB, COMMENT_SYNC_STATE_KEY, nextState, startedAt);
      if (Result.isError(stateUpdateResult)) {
        throw stateUpdateResult.error;
      }
      baseSummary.applyStats.stateUpdated = true;

      if (baseSummary.changeStats.highConfidenceDraftCandidates > 0) {
        const alertResult = await sendTelegramAlert(args.env, {
          ...baseSummary,
          mode: shouldApply ? 'apply' : mode,
          status: 'success',
          finishedAt: nowIso(),
        });

        if (Result.isError(alertResult)) {
          baseSummary.warnings.push('Failed to send Telegram alert for high-confidence drafts.');
        } else {
          baseSummary.applyStats.alertSent = true;
        }
      }
    }

    baseSummary.mode = shouldApply ? 'apply' : mode;
    baseSummary.status = 'success';
    baseSummary.finishedAt = nowIso();

    const insertRunResult = await insertCommentSyncRun(args.env.STALLS_DB, {
      id: runId,
      triggerSource: args.triggerSource,
      mode: baseSummary.mode,
      status: baseSummary.status,
      startedAt,
      finishedAt: baseSummary.finishedAt,
      summaryJson: JSON.stringify(baseSummary),
      errorText: null,
    });

    if (Result.isError(insertRunResult)) {
      baseSummary.warnings.push('Failed to persist comment sync run summary.');
    }

    return baseSummary;
  });

  if (Result.isError(syncResult)) {
    const failedSummary: CommentSuggestionSyncSummary = {
      ...baseSummary,
      finishedAt: nowIso(),
      status: 'failed',
      error: syncResult.error instanceof Error ? syncResult.error.message : String(syncResult.error),
    };

    const insertFailureResult = await insertCommentSyncRun(args.env.STALLS_DB, {
      id: runId,
      triggerSource: args.triggerSource,
      mode,
      status: failedSummary.status,
      startedAt,
      finishedAt: failedSummary.finishedAt,
      summaryJson: JSON.stringify(failedSummary),
      errorText: failedSummary.error,
    });

    if (Result.isError(insertFailureResult)) {
      failedSummary.warnings.push('Failed to persist failed comment sync run summary.');
    }

    return failedSummary;
  }

  return syncResult.value;
}
