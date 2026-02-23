import { Result } from 'better-result';

import { parseTimeCategories } from '../../data/shared';
import type {
  WorkerEnv,
  WorkerExecutionContextLike,
} from '../cloudflare/runtime';
import type { CanonicalStall } from '../stalls/contracts';
import {
  applyCanonicalStalls,
  ensureStallTables,
  getActiveStallCount,
  getActiveStallIndex,
  getStallSlugIndex,
  insertSyncRun,
} from '../stalls/repository';
import { enrichOpeningTimesFromGoogleMaps } from './google-maps-hours';
import {
  fetchSheetCsv,
  parseSheetRows,
  resolveSheetCuisineOverride,
  type SheetStallRow,
} from './sheet-source';
import { buildCanonicalStallsFromStaticData } from './static-seed';
import {
  buildYouTubeVideoUrl,
  deriveSlug,
  infoScore,
  makeLocationId,
  makeStableHash,
  makeStallIdFromSourceKey,
  makeStallSourceKey,
  normalizeComparableText,
  normalizeDisplayText,
  normalizeYouTubeVideoId,
} from './normalize';
import {
  fetchYouTubeVideos,
  searchYouTubeChannelVideoIdsByQuery,
  type YouTubeVideoEntry,
} from './youtube-source';

export type StallSyncMode = 'dry-run' | 'apply';
export type StallSyncStatus = 'success' | 'failed' | 'guarded';

export interface StallSyncSummary {
  runId: string;
  triggerSource: string;
  mode: StallSyncMode;
  status: StallSyncStatus;
  startedAt: string;
  finishedAt: string;
  sourceStats: {
    sheetRows: number;
    youtubeVideos: number;
    canonicalStalls: number;
    usedStaticSeed: boolean;
  };
  changeStats: {
    existingActiveCount: number;
    newCount: number;
    updatedCount: number;
    closedCount: number;
    unchangedCount: number;
    changeRatio: number;
    maxChangeRatio: number;
  };
  applyStats: {
    upsertedStalls: number;
    upsertedLocations: number;
    closedStalls: number;
  };
  warnings: string[];
  error: string | null;
}

export interface RunStallSyncArgs {
  env: WorkerEnv;
  triggerSource: string;
  executionCtx?: WorkerExecutionContextLike | null;
  modeOverride?: StallSyncMode;
  forceApply?: boolean;
}

interface StallAccumulator {
  sourceKey: string;
  rows: SheetStallRow[];
  bestRow: SheetStallRow;
  bestScore: number;
  locations: Map<string, { address: string; youtubeVideoUrl: string | null }>;
  awards: Set<string>;
}

const GENERIC_YOUTUBE_MATCH_TOKENS = new Set([
  'the',
  'best',
  'episode',
  'ep',
  'part',
  'members',
  'singapore',
  'malaysia',
  'thailand',
  'hong',
  'kong',
  'bak',
  'kut',
  'teh',
  'bakchor',
  'chor',
  'mee',
  'wanton',
  'wan',
  'tan',
  'mala',
  'laksa',
  'nasi',
  'lemak',
  'char',
  'kway',
  'teow',
  'hokkien',
  'prawn',
  'soup',
  'noodle',
  'noodles',
  'restaurant',
  'stall',
  'road',
  'street',
]);
const MAX_YOUTUBE_SEARCH_FALLBACK_QUERIES_PER_RUN = 12;

function nowIso(): string {
  return new Date().toISOString();
}

function boolFromValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return fallback;

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;

  return fallback;
}

function numberFromValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function resolveSyncMode(args: RunStallSyncArgs): StallSyncMode {
  if (args.modeOverride) {
    return args.modeOverride;
  }

  return args.env.STALL_SYNC_MODE === 'apply' ? 'apply' : 'dry-run';
}

function shouldForceApply(args: RunStallSyncArgs): boolean {
  return boolFromValue(args.forceApply ?? args.env.STALL_SYNC_FORCE_APPLY, false);
}

function maxChangeRatio(env: WorkerEnv): number {
  const raw = numberFromValue(env.STALL_SYNC_MAX_CHANGE_RATIO, 0.5);
  if (raw <= 0) return 0.5;
  if (raw > 1) return 1;
  return raw;
}

function shouldAlertOnSuccess(env: WorkerEnv): boolean {
  return env.STALL_SYNC_ALERT_MODE !== 'failed';
}

function computeRowScore(row: SheetStallRow): number {
  return infoScore({
    openingTimes: row.openingTimes,
    dishName: row.dishName,
    youtubeVideoUrl: buildYouTubeVideoUrl(row.youtubeVideoUrl),
    hits: [],
    misses: [],
    awards: row.awards,
    ratingModerated: row.ratingModerated,
    ratingOriginal: row.ratingOriginal,
  });
}

function findBestYoutubeMatchByReference(
  reference: string | null | undefined,
  videos: YouTubeVideoEntry[]
): YouTubeVideoEntry | null {
  const normalizedReference = normalizeComparableText(reference ?? '');
  if (!normalizedReference) {
    return null;
  }

  const referenceTokens = normalizedReference.split(/\s+/).filter((token) => token.length >= 3);
  const episodeTokenMatch = normalizedReference.match(/\bepisode\s+\d+\b/);
  const episodeToken = episodeTokenMatch?.[0] ?? null;
  const requiresMembersToken = normalizedReference.includes('members');

  let best: YouTubeVideoEntry | null = null;
  let bestScore = -1;

  for (const video of videos) {
    const normalizedTitle = normalizeComparableText(video.title);
    if (!normalizedTitle) {
      continue;
    }
    if (requiresMembersToken && !normalizedTitle.includes('members')) {
      continue;
    }

    let score = 0;
    if (normalizedTitle === normalizedReference) score += 10;
    if (normalizedTitle.includes(normalizedReference)) score += 7;
    if (normalizedReference.includes(normalizedTitle)) score += 3;
    if (episodeToken && normalizedTitle.includes(episodeToken)) score += 5;

    const matchingTokens = referenceTokens.filter((token) => normalizedTitle.includes(token));
    score += matchingTokens.length;

    if (score > bestScore) {
      bestScore = score;
      best = video;
    }
  }

  return bestScore >= 6 ? best : null;
}

function significantNameTokens(name: string): string[] {
  return normalizeComparableText(name)
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !GENERIC_YOUTUBE_MATCH_TOKENS.has(token));
}

function collectReferenceCandidates(group: StallAccumulator): string[] {
  const references = [
    group.bestRow.youtubeVideoUrl,
    group.bestRow.youtubeTitle,
    ...group.rows.map((row) => row.youtubeVideoUrl),
    ...group.rows.map((row) => row.youtubeTitle),
  ];

  const unique = new Set<string>();
  for (const reference of references) {
    const normalized = normalizeDisplayText(reference ?? '');
    if (!normalized) {
      continue;
    }
    unique.add(normalized);
  }

  return [...unique];
}

function findBestYoutubeMatchByName(row: SheetStallRow, videos: YouTubeVideoEntry[]): YouTubeVideoEntry | null {
  const normalizedName = normalizeComparableText(row.name);
  if (!normalizedName) return null;
  const nameTokens = significantNameTokens(row.name);
  if (nameTokens.length === 0) return null;

  let best: YouTubeVideoEntry | null = null;
  let bestScore = -1;
  let secondBestScore = -1;

  for (const video of videos) {
    const normalizedTitle = normalizeComparableText(video.title);
    if (!normalizedTitle) continue;

    let score = 0;
    if (normalizedTitle.includes(normalizedName)) {
      score += 10;
    }
    const matchingTokens = nameTokens.filter((token) => normalizedTitle.includes(token));
    if (matchingTokens.length === 0) {
      continue;
    }
    score += matchingTokens.length * 3;
    if (matchingTokens.length >= 2) {
      score += 2;
    }

    if (score > bestScore) {
      secondBestScore = bestScore;
      bestScore = score;
      best = video;
      continue;
    }
    if (score > secondBestScore) {
      secondBestScore = score;
    }
  }

  if (bestScore < 6) {
    return null;
  }
  if (secondBestScore >= 0 && bestScore - secondBestScore < 2) {
    return null;
  }

  return best;
}

function findBestYoutubeMatch(
  row: SheetStallRow,
  videos: YouTubeVideoEntry[],
  referenceCandidates: string[]
): YouTubeVideoEntry | null {
  for (const reference of referenceCandidates) {
    const byReference = findBestYoutubeMatchByReference(reference, videos);
    if (byReference) {
      return byReference;
    }
  }

  return findBestYoutubeMatchByName(row, videos);
}

function inferYoutubeTitleFromReference(reference: string | null | undefined): string {
  const normalized = normalizeDisplayText(reference ?? '');
  if (!normalized) {
    return '';
  }
  if (buildYouTubeVideoUrl(normalized)) {
    return '';
  }
  return normalized;
}

function dedupeYouTubeEntries(entries: YouTubeVideoEntry[]): YouTubeVideoEntry[] {
  const byVideoId = new Map<string, YouTubeVideoEntry>();
  for (const entry of entries) {
    const existing = byVideoId.get(entry.videoId);
    if (!existing) {
      byVideoId.set(entry.videoId, entry);
      continue;
    }
    if (!existing.title && entry.title) {
      byVideoId.set(entry.videoId, entry);
    }
  }
  return [...byVideoId.values()];
}

function buildCanonicalFromSources(
  rows: SheetStallRow[],
  videos: YouTubeVideoEntry[],
  syncedAtIso: string
): CanonicalStall[] {
  const groups = new Map<string, StallAccumulator>();

  for (const row of rows) {
    const sourceKey = makeStallSourceKey(row.name, row.country, row.cuisine);
    const existing = groups.get(sourceKey);
    const score = computeRowScore(row);
    const address = normalizeDisplayText(row.address);

    if (!existing) {
      const locationMap = new Map<string, { address: string; youtubeVideoUrl: string | null }>();
      locationMap.set(address.toLowerCase(), {
        address,
        youtubeVideoUrl: buildYouTubeVideoUrl(row.youtubeVideoUrl),
      });

      groups.set(sourceKey, {
        sourceKey,
        rows: [row],
        bestRow: row,
        bestScore: score,
        locations: locationMap,
        awards: new Set(row.awards),
      });
      continue;
    }

    existing.rows.push(row);
    if (!existing.locations.has(address.toLowerCase())) {
      existing.locations.set(address.toLowerCase(), {
        address,
        youtubeVideoUrl: buildYouTubeVideoUrl(row.youtubeVideoUrl),
      });
    }

    for (const award of row.awards) {
      existing.awards.add(award);
    }

    if (score > existing.bestScore) {
      existing.bestScore = score;
      existing.bestRow = row;
    }
  }

  const canonicalStalls: CanonicalStall[] = [];

  for (const group of groups.values()) {
    const bestRow = group.bestRow;
    const sourceStallKey = group.sourceKey;
    const stallId = makeStallIdFromSourceKey(sourceStallKey);

    const referenceCandidates = collectReferenceCandidates(group);
    const explicitVideoId =
      normalizeYouTubeVideoId(bestRow.youtubeVideoUrl) ??
      group.rows.map((row) => normalizeYouTubeVideoId(row.youtubeVideoUrl)).find((id) => Boolean(id)) ??
      null;
    const explicitVideoUrl =
      buildYouTubeVideoUrl(explicitVideoId ?? bestRow.youtubeVideoUrl) ??
      group.rows.map((row) => buildYouTubeVideoUrl(row.youtubeVideoUrl)).find((url) => Boolean(url)) ??
      null;

    const matchedVideo = explicitVideoUrl ? null : findBestYoutubeMatch(bestRow, videos, referenceCandidates);

    const youtubeVideoId =
      explicitVideoId ?? normalizeYouTubeVideoId(matchedVideo?.videoId ?? matchedVideo?.videoUrl ?? null);
    const youtubeVideoUrl =
      explicitVideoUrl ?? buildYouTubeVideoUrl(youtubeVideoId ?? matchedVideo?.videoUrl ?? null);

    const locations = [...group.locations.values()].map((location) => ({
      id: makeLocationId(stallId, location.address),
      address: location.address,
      lat: null,
      lng: null,
      youtubeVideoUrl: location.youtubeVideoUrl ?? youtubeVideoUrl,
      mapsQuery: `${bestRow.name} ${location.address}`,
      isPrimary: false,
      isActive: true,
    }));

    const preferredPrimaryAddress = normalizeDisplayText(bestRow.address);
    const primaryLocation =
      locations.find((location) => location.address.toLowerCase() === preferredPrimaryAddress.toLowerCase()) ??
      locations[0];

    if (!primaryLocation) {
      continue;
    }

    for (const location of locations) {
      location.isPrimary = location.address.toLowerCase() === primaryLocation.address.toLowerCase();
    }

    const sourceSheetHash = makeStableHash(group.rows.map((row) => row.sourceRowKey).sort().join('|'));
    const sourceYoutubeHash = youtubeVideoId ?? null;

    const canonical: CanonicalStall = {
      id: stallId,
      sourceStallKey,
      slug: deriveSlug(bestRow.name, sourceStallKey),
      name: normalizeDisplayText(bestRow.name),
      cuisine: bestRow.cuisine,
      cuisineLabel: bestRow.cuisineLabel,
      country: bestRow.country,
      primaryAddress: primaryLocation.address,
      primaryLat: null,
      primaryLng: null,
      episodeNumber: bestRow.episodeNumber,
      dishName: normalizeDisplayText(bestRow.dishName),
      price: bestRow.price,
      ratingOriginal: bestRow.ratingOriginal,
      ratingModerated: bestRow.ratingModerated,
      openingTimes: normalizeDisplayText(bestRow.openingTimes),
      timeCategories: parseTimeCategories(bestRow.openingTimes),
      hits: [],
      misses: [],
      youtubeTitle: normalizeDisplayText(
        bestRow.youtubeTitle || matchedVideo?.title || inferYoutubeTitleFromReference(bestRow.youtubeVideoUrl)
      ),
      youtubeVideoUrl,
      youtubeVideoId,
      googleMapsName: normalizeDisplayText(bestRow.name),
      awards: [...group.awards].sort((a, b) => a.localeCompare(b)),
      status: 'active',
      sourceRank: computeRowScore(bestRow) + (matchedVideo ? 2 : 0),
      sourceSheetHash,
      sourceYoutubeHash,
      locations,
      lastSyncedAt: syncedAtIso,
    };

    canonicalStalls.push(canonical);
  }

  return canonicalStalls;
}

function canonicalPayloadHash(stall: CanonicalStall): string {
  const asSqlPayloadPart = (value: string | number | null | undefined): string =>
    value === null || value === undefined ? '' : String(value);

  return [
    asSqlPayloadPart(stall.name),
    asSqlPayloadPart(stall.cuisine),
    asSqlPayloadPart(stall.cuisineLabel),
    asSqlPayloadPart(stall.country),
    asSqlPayloadPart(stall.primaryAddress),
    asSqlPayloadPart(stall.primaryLat),
    asSqlPayloadPart(stall.primaryLng),
    asSqlPayloadPart(stall.episodeNumber),
    asSqlPayloadPart(stall.dishName),
    asSqlPayloadPart(stall.price),
    asSqlPayloadPart(stall.ratingOriginal),
    asSqlPayloadPart(stall.ratingModerated),
    asSqlPayloadPart(stall.openingTimes),
    JSON.stringify([...stall.timeCategories].sort()),
    JSON.stringify([...stall.hits].sort()),
    JSON.stringify([...stall.misses].sort()),
    asSqlPayloadPart(stall.youtubeTitle),
    asSqlPayloadPart(stall.youtubeVideoUrl),
    asSqlPayloadPart(stall.youtubeVideoId),
    asSqlPayloadPart(stall.googleMapsName),
    JSON.stringify([...stall.awards].sort()),
    asSqlPayloadPart(stall.status),
    asSqlPayloadPart(stall.sourceRank),
    asSqlPayloadPart(stall.sourceSheetHash),
    asSqlPayloadPart(stall.sourceYoutubeHash),
  ].join('|');
}

function sanitizeExternalErrorMessage(message: string): string {
  const oneLine = normalizeDisplayText(message).replace(/\s+/g, ' ');
  const redacted = oneLine.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted]');

  if (redacted.length <= 240) {
    return redacted;
  }

  return `${redacted.slice(0, 240)}...`;
}

function ensureUniqueCanonicalSlugs(stalls: CanonicalStall[], existingSlugIndex: Map<string, string>): number {
  const occupiedSlugs = new Map<string, string>();
  let adjustedCount = 0;

  const canonicalOrdered = [...stalls].sort((left, right) =>
    left.sourceStallKey.localeCompare(right.sourceStallKey)
  );

  for (const stall of canonicalOrdered) {
    const baseSlug = stall.slug;
    let candidateSlug = baseSlug;
    let attempt = 0;

    while (true) {
      const occupiedBy = occupiedSlugs.get(candidateSlug);
      const existingBy = existingSlugIndex.get(candidateSlug);
      const occupiedByCurrent = !occupiedBy || occupiedBy === stall.sourceStallKey;
      const existingByCurrent = !existingBy || existingBy === stall.sourceStallKey;

      if (occupiedByCurrent && existingByCurrent) {
        break;
      }

      attempt += 1;
      const suffixLength = 6 + Math.min(attempt, 4);
      const suffix = makeStableHash(`${stall.sourceStallKey}|${attempt}`).slice(0, suffixLength);
      candidateSlug = `${baseSlug}-${suffix}`;
    }

    if (candidateSlug !== stall.slug) {
      adjustedCount += 1;
      stall.slug = candidateSlug;
    }

    occupiedSlugs.set(candidateSlug, stall.sourceStallKey);
  }

  return adjustedCount;
}

function toTelegramMessage(summary: StallSyncSummary): string {
  const lines = [
    `SG Food Guide Stall Sync`,
    `Run: ${summary.runId}`,
    `Status: ${summary.status}`,
    `Mode: ${summary.mode}`,
    `Trigger: ${summary.triggerSource}`,
    `Sheet rows: ${summary.sourceStats.sheetRows}`,
    `YouTube videos: ${summary.sourceStats.youtubeVideos}`,
    `Canonical stalls: ${summary.sourceStats.canonicalStalls}`,
    `Changes: +${summary.changeStats.newCount} / ~${summary.changeStats.updatedCount} / -${summary.changeStats.closedCount}`,
    `Applied stalls: ${summary.applyStats.upsertedStalls}`,
    `Applied locations: ${summary.applyStats.upsertedLocations}`,
    `Closed stalls: ${summary.applyStats.closedStalls}`,
  ];

  if (summary.error) {
    lines.push(`Error: ${summary.error}`);
  }

  if (summary.warnings.length > 0) {
    lines.push(`Warnings: ${summary.warnings.join(' | ')}`);
  }

  return lines.join('\n');
}

async function sendTelegramAlert(env: WorkerEnv, summary: StallSyncSummary): Promise<Result<void, Error>> {
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();

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
    return Result.err(new Error('Failed sending Telegram alert for stall sync.'));
  }

  if (!responseResult.value.ok) {
    return Result.err(new Error(`Telegram alert request failed with HTTP ${responseResult.value.status}.`));
  }

  return Result.ok();
}

function buildRunId(startedAtIso: string): string {
  return `stall-sync-${makeStableHash(startedAtIso).slice(0, 16)}`;
}

export async function runStallSync(args: RunStallSyncArgs): Promise<StallSyncSummary> {
  const startedAt = nowIso();
  const runId = buildRunId(startedAt);
  const mode = resolveSyncMode(args);
  const guardRatio = maxChangeRatio(args.env);
  const forceApply = shouldForceApply(args);

  const baseSummary: StallSyncSummary = {
    runId,
    triggerSource: args.triggerSource,
    mode,
    status: 'failed',
    startedAt,
    finishedAt: startedAt,
    sourceStats: {
      sheetRows: 0,
      youtubeVideos: 0,
      canonicalStalls: 0,
      usedStaticSeed: false,
    },
    changeStats: {
      existingActiveCount: 0,
      newCount: 0,
      updatedCount: 0,
      closedCount: 0,
      unchangedCount: 0,
      changeRatio: 0,
      maxChangeRatio: guardRatio,
    },
    applyStats: {
      upsertedStalls: 0,
      upsertedLocations: 0,
      closedStalls: 0,
    },
    warnings: [],
    error: null,
  };

  const syncResult = await Result.tryPromise(async () => {
    const ensureResult = await ensureStallTables(args.env.STALLS_DB);
    if (Result.isError(ensureResult)) {
      throw ensureResult.error;
    }

    const [existingCountResult, existingIndexResult, existingSlugIndexResult] = await Promise.all([
      getActiveStallCount(args.env.STALLS_DB),
      getActiveStallIndex(args.env.STALLS_DB),
      getStallSlugIndex(args.env.STALLS_DB),
    ]);

    if (Result.isError(existingCountResult)) {
      throw existingCountResult.error;
    }

    if (Result.isError(existingIndexResult)) {
      throw existingIndexResult.error;
    }
    if (Result.isError(existingSlugIndexResult)) {
      throw existingSlugIndexResult.error;
    }

    const sheetFetchResult = await fetchSheetCsv(args.env);
    if (Result.isError(sheetFetchResult)) {
      throw sheetFetchResult.error;
    }

    const parsedSheetRows: SheetStallRow[] = [];
    const sheetSources =
      sheetFetchResult.value.sources.length > 0
        ? sheetFetchResult.value.sources
        : [{ sourceUrl: sheetFetchResult.value.sourceUrl, gid: '', csv: sheetFetchResult.value.csv }];

    for (const source of sheetSources) {
      const sheetRowsResult = parseSheetRows(source.csv, {
        defaultCuisine: resolveSheetCuisineOverride(source.gid),
        sourceIdentityPrefix: source.gid,
      });
      if (Result.isError(sheetRowsResult)) {
        throw sheetRowsResult.error;
      }

      parsedSheetRows.push(...sheetRowsResult.value);
    }

    let sheetRows = parsedSheetRows;
    const pipelineWarnings: string[] = [];

    // Fetch YouTube data before Maps enrichment so map lookups cannot exhaust
    // subrequest budget and starve the YouTube sync step.
    let youtubeEntries: YouTubeVideoEntry[] = [];
    const youtubeFetchResult = await fetchYouTubeVideos(args.env);
    if (Result.isError(youtubeFetchResult)) {
      const reason = sanitizeExternalErrorMessage(youtubeFetchResult.error.message);
      pipelineWarnings.push(
        `YouTube Data API fetch failed; proceeding with sheet-only enrichment. Reason: ${reason}`
      );
    } else {
      youtubeEntries = youtubeFetchResult.value;
    }

    const mapsHoursResult = await enrichOpeningTimesFromGoogleMaps(sheetRows, args.env);
    if (Result.isError(mapsHoursResult)) {
      pipelineWarnings.push('Google Maps hours enrichment failed unexpectedly; proceeding with raw sheet opening times.');
    } else {
      sheetRows = mapsHoursResult.value.rows;
      if (mapsHoursResult.value.warnings.length > 0) {
        pipelineWarnings.push(...mapsHoursResult.value.warnings);
      }
    }

    let canonical = buildCanonicalFromSources(sheetRows, youtubeEntries, startedAt);
    const unresolvedSearchQueries = [
      ...new Set(
        canonical
          .filter((stall) => !stall.youtubeVideoUrl)
          .map((stall) => normalizeDisplayText(stall.youtubeTitle))
          .filter((title) => title.length > 0 && !normalizeComparableText(title).includes('members'))
      ),
    ];
    if (unresolvedSearchQueries.length > 0) {
      const fallbackQueries = unresolvedSearchQueries.slice(0, MAX_YOUTUBE_SEARCH_FALLBACK_QUERIES_PER_RUN);
      const fallbackEntries: YouTubeVideoEntry[] = [];

      for (const query of fallbackQueries) {
        const searchResult = await searchYouTubeChannelVideoIdsByQuery(args.env, query, 3);
        if (Result.isError(searchResult)) {
          const reason = sanitizeExternalErrorMessage(searchResult.error.message);
          pipelineWarnings.push(`YouTube search fallback failed for query "${query}". Reason: ${reason}`);
          continue;
        }

        const firstVideoId = searchResult.value[0] ?? '';
        const fallbackUrl = buildYouTubeVideoUrl(firstVideoId);
        if (!fallbackUrl) {
          continue;
        }

        fallbackEntries.push({
          videoId: firstVideoId,
          videoUrl: fallbackUrl,
          title: query,
          publishedAt: new Date(0).toISOString(),
        });
      }

      if (fallbackEntries.length > 0) {
        youtubeEntries = dedupeYouTubeEntries([...youtubeEntries, ...fallbackEntries]);
        canonical = buildCanonicalFromSources(sheetRows, youtubeEntries, startedAt);
      }
      if (unresolvedSearchQueries.length > fallbackQueries.length) {
        pipelineWarnings.push(
          `YouTube search fallback skipped ${unresolvedSearchQueries.length - fallbackQueries.length} unresolved title query(ies) to stay within per-run budget (${MAX_YOUTUBE_SEARCH_FALLBACK_QUERIES_PER_RUN}).`
        );
      }
    }
    let usedStaticSeed = false;

    if (canonical.length === 0) {
      canonical = buildCanonicalStallsFromStaticData(startedAt);
      usedStaticSeed = true;
    }

    const slugAdjustments = ensureUniqueCanonicalSlugs(canonical, existingSlugIndexResult.value);

    const existingCount = existingCountResult.value;
    const existingIndex = existingIndexResult.value;

    const nextHashes = new Map<string, string>();
    for (const stall of canonical) {
      nextHashes.set(stall.sourceStallKey, canonicalPayloadHash(stall));
    }

    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    for (const [sourceKey, nextHash] of nextHashes.entries()) {
      const existing = existingIndex.get(sourceKey);
      if (!existing) {
        newCount += 1;
      } else if (existing.payloadHash === nextHash) {
        unchangedCount += 1;
      } else {
        updatedCount += 1;
      }
    }

    let closedCount = 0;
    for (const sourceKey of existingIndex.keys()) {
      if (!nextHashes.has(sourceKey)) {
        closedCount += 1;
      }
    }

    const changeRatio = existingCount > 0 ? closedCount / existingCount : 0;

    const summary: StallSyncSummary = {
      ...baseSummary,
      status: 'success',
      finishedAt: nowIso(),
      sourceStats: {
        sheetRows: sheetRows.length,
        youtubeVideos: youtubeEntries.length,
        canonicalStalls: canonical.length,
        usedStaticSeed,
      },
      changeStats: {
        existingActiveCount: existingCount,
        newCount,
        updatedCount,
        closedCount,
        unchangedCount,
        changeRatio,
        maxChangeRatio: guardRatio,
      },
    };

    if (usedStaticSeed) {
      summary.warnings.push('Sheet source produced zero canonical rows; static dataset seed was used.');
    }
    if (pipelineWarnings.length > 0) {
      summary.warnings.push(...pipelineWarnings);
    }
    if (slugAdjustments > 0) {
      summary.warnings.push(`Adjusted ${slugAdjustments} slug(s) to avoid uniqueness collisions.`);
    }

    if (mode === 'dry-run') {
      summary.applyStats = {
        upsertedStalls: 0,
        upsertedLocations: 0,
        closedStalls: 0,
      };
      return summary;
    }

    if (!forceApply && existingCount > 0 && changeRatio > guardRatio) {
      summary.status = 'guarded';
      summary.warnings.push(
        `Guardrail prevented apply mode: closure ratio ${(changeRatio * 100).toFixed(1)}% exceeded ${(guardRatio * 100).toFixed(1)}%.`
      );
      return summary;
    }

    const applyResult = await applyCanonicalStalls(args.env.STALLS_DB, canonical, startedAt);
    if (Result.isError(applyResult)) {
      throw applyResult.error;
    }

    summary.applyStats = {
      upsertedStalls: applyResult.value.upsertedStalls,
      upsertedLocations: applyResult.value.upsertedLocations,
      closedStalls: applyResult.value.closedStalls,
    };

    return summary;
  });

  const finalSummary: StallSyncSummary = Result.isError(syncResult)
    ? {
        ...baseSummary,
        status: 'failed',
        finishedAt: nowIso(),
        error: syncResult.error instanceof Error ? syncResult.error.message : 'Unknown stall sync failure.',
      }
    : syncResult.value;

  const runInsertResult = await insertSyncRun(args.env.STALLS_DB, {
    id: finalSummary.runId,
    triggerSource: finalSummary.triggerSource,
    mode: finalSummary.mode,
    status: finalSummary.status,
    startedAt: finalSummary.startedAt,
    finishedAt: finalSummary.finishedAt,
    summaryJson: JSON.stringify(finalSummary),
    errorText: finalSummary.error,
  });

  if (Result.isError(runInsertResult)) {
    finalSummary.warnings.push('Failed to persist sync run record to D1.');
  }

  const shouldSendAlert =
    finalSummary.status !== 'success' || shouldAlertOnSuccess(args.env);

  if (shouldSendAlert) {
    const alertResult = await sendTelegramAlert(args.env, finalSummary);
    if (Result.isError(alertResult)) {
      finalSummary.warnings.push('Failed to deliver Telegram alert.');
    }
  }

  return finalSummary;
}
