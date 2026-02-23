/**
 * Backfill missing stall YouTube URLs by reusing known episode mappings and
 * validating video IDs against Alderic channel uploads from YouTube Data API.
 *
 * Usage:
 *   bun scripts/backfill-missing-youtube-urls.ts               # dry-run (remote)
 *   bun scripts/backfill-missing-youtube-urls.ts --apply       # apply (remote)
 *   bun scripts/backfill-missing-youtube-urls.ts --local       # dry-run (local D1)
 *   bun scripts/backfill-missing-youtube-urls.ts --db <name>
 *   bun scripts/backfill-missing-youtube-urls.ts --channel-id <id>
 *   bun scripts/backfill-missing-youtube-urls.ts --youtube-api-key <key>
 */

import { Result } from 'better-result';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as z from 'zod';

const DEFAULT_DB_NAME = 'sg-food-guide-stalls';
const DEFAULT_CHANNEL_ID = 'UCH-dJYvV8UiemFsLZRO0X4A';
const YOUTUBE_DATA_API_BASE = 'https://www.googleapis.com/youtube/v3';
const MAX_PLAYLIST_PAGES = 200;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const execFileAsync = promisify(execFile);

const wranglerEnvelopeSchema = z.array(
  z.object({
    results: z.array(z.record(z.string(), z.unknown())),
    success: z.boolean().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  })
);

const missingStallSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  cuisine: z.string(),
  cuisine_label: z.string(),
  country: z.string(),
  episode_number: z.union([z.number(), z.string(), z.null()]).optional(),
});

const presentStallSchema = z.object({
  id: z.string(),
  name: z.string(),
  cuisine: z.string(),
  cuisine_label: z.string(),
  country: z.string(),
  episode_number: z.union([z.number(), z.string(), z.null()]).optional(),
  youtube_title: z.union([z.string(), z.null()]).optional(),
  youtube_video_url: z.string(),
  youtube_video_id: z.union([z.string(), z.null()]).optional(),
});

const youtubeChannelsResponseSchema = z.object({
  items: z.array(
    z.object({
      contentDetails: z.object({
        relatedPlaylists: z.object({
          uploads: z.string().min(1),
        }),
      }),
    })
  ),
});

const youtubePlaylistItemsResponseSchema = z.object({
  nextPageToken: z.string().optional(),
  items: z.array(
    z.object({
      snippet: z
        .object({
          title: z.string().optional(),
          resourceId: z
            .object({
              videoId: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
      contentDetails: z
        .object({
          videoId: z.string().optional(),
        })
        .optional(),
    })
  ),
});

interface CliOptions {
  apply: boolean;
  remote: boolean;
  dbName: string;
  channelId: string;
  youtubeApiKey: string;
}

interface MissingStall {
  id: string;
  slug: string;
  name: string;
  cuisine: string;
  cuisineLabel: string;
  country: string;
  episode: string;
}

interface VideoCandidate {
  videoId: string;
  videoUrl: string;
  youtubeTitle: string;
  cuisine: string;
  country: string;
  episode: string;
}

interface Assignment {
  stall: MissingStall;
  videoId: string;
  videoUrl: string;
  youtubeTitle: string;
  reason: string;
}

function parseArgs(argv: string[]): CliOptions {
  let apply = false;
  let remote = true;
  let dbName = DEFAULT_DB_NAME;
  let channelId = DEFAULT_CHANNEL_ID;
  let youtubeApiKey = process.env.YOUTUBE_DATA_API_KEY?.trim() ?? '';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      apply = true;
      continue;
    }
    if (arg === '--local') {
      remote = false;
      continue;
    }
    if (arg === '--remote') {
      remote = true;
      continue;
    }
    if (arg === '--db') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --db');
      dbName = value;
      i += 1;
      continue;
    }
    if (arg === '--channel-id') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --channel-id');
      channelId = value.trim();
      i += 1;
      continue;
    }
    if (arg === '--youtube-api-key') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --youtube-api-key');
      youtubeApiKey = value.trim();
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!channelId) {
    throw new Error('Missing YouTube channel ID. Provide --channel-id or set default.');
  }

  if (!youtubeApiKey) {
    throw new Error(
      'Missing YouTube Data API key. Set YOUTUBE_DATA_API_KEY or pass --youtube-api-key.'
    );
  }

  return { apply, remote, dbName, channelId, youtubeApiKey };
}

function normalizeComparableText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractEpisodeKey(value: unknown): string {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      if (Number.isInteger(numeric)) return String(numeric);
      return String(numeric);
    }
    return trimmed;
  }
  return '';
}

function extractVideoId(value: string | null | undefined): string | null {
  const input = (value ?? '').trim();
  if (!input) return null;
  if (VIDEO_ID_RE.test(input)) return input;

  const fromQuery = input.match(/[?&]v=([A-Za-z0-9_-]{11})/i)?.[1];
  if (fromQuery && VIDEO_ID_RE.test(fromQuery)) return fromQuery;

  const fromShort = input.match(/youtu\.be\/([A-Za-z0-9_-]{11})/i)?.[1];
  if (fromShort && VIDEO_ID_RE.test(fromShort)) return fromShort;

  const fromEmbed = input.match(/\/embed\/([A-Za-z0-9_-]{11})/i)?.[1];
  if (fromEmbed && VIDEO_ID_RE.test(fromEmbed)) return fromEmbed;

  return null;
}

function buildWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function groupKey(cuisine: string, episode: string): string {
  return `${cuisine}|${episode}`;
}

function groupCountryKey(cuisine: string, episode: string, country: string): string {
  return `${cuisine}|${episode}|${country}`;
}

function sqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function isMembersVideo(title: string): boolean {
  return normalizeComparableText(title).includes('members');
}

function episodeTokenMatchesTitle(episode: string, title: string): boolean {
  if (!episode) return false;
  const escaped = episode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b(?:episode|ep)\\s*${escaped}(?:\\b|[^0-9])`, 'i');
  return pattern.test(title);
}

function getSignificantNameTokens(name: string): string[] {
  const stopWords = new Set([
    'the',
    'and',
    'with',
    'for',
    'road',
    'street',
    'singapore',
    'restaurant',
    'stall',
    'bak',
    'kut',
    'teh',
    'mee',
    'noodle',
    'noodles',
    'kway',
    'teow',
    'char',
    'hokkien',
    'laksa',
    'prawn',
    'wanton',
    'wonton',
  ]);

  return normalizeComparableText(name)
    .split(' ')
    .filter((token) => token.length >= 4 && !stopWords.has(token));
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<Result<{ stdout: string; stderr: string }, Error>> {
  const runResult = await Result.tryPromise(() =>
    execFileAsync(command, args, {
      cwd,
      maxBuffer: 32 * 1024 * 1024,
      env: process.env,
    })
  );

  if (Result.isError(runResult)) {
    return Result.err(runResult.error);
  }

  return Result.ok({
    stdout: runResult.value.stdout,
    stderr: runResult.value.stderr,
  });
}

function parseJsonFromWranglerStdout(stdout: string): Result<unknown, Error> {
  const start = stdout.indexOf('[');
  const end = stdout.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    return Result.err(new Error('Failed to find JSON payload in wrangler output.'));
  }

  const payloadResult = Result.try(() => JSON.parse(stdout.slice(start, end + 1)));
  if (Result.isError(payloadResult)) {
    return Result.err(new Error('Failed to parse wrangler JSON payload.'));
  }
  return Result.ok(payloadResult.value);
}

async function queryD1Rows(
  projectRoot: string,
  dbName: string,
  remote: boolean,
  query: string
): Promise<Result<Array<Record<string, unknown>>, Error>> {
  const args = ['wrangler', 'd1', 'execute', dbName, '--json', '--command', query];
  if (remote) args.push('--remote');
  else args.push('--local');

  const runResult = await runCommand('bunx', args, projectRoot);
  if (Result.isError(runResult)) {
    return Result.err(new Error(`Failed running wrangler query. ${runResult.error.message}`));
  }

  const payloadResult = parseJsonFromWranglerStdout(runResult.value.stdout);
  if (Result.isError(payloadResult)) {
    return Result.err(payloadResult.error);
  }

  const parsed = wranglerEnvelopeSchema.safeParse(payloadResult.value);
  if (!parsed.success) {
    return Result.err(new Error('Invalid wrangler query response shape.'));
  }

  return Result.ok(parsed.data[0]?.results ?? []);
}

async function runD1SqlFile(
  projectRoot: string,
  dbName: string,
  remote: boolean,
  sqlFilePath: string
): Promise<Result<void, Error>> {
  const args = ['wrangler', 'd1', 'execute', dbName, '--file', sqlFilePath];
  if (remote) args.push('--remote');
  else args.push('--local');

  const runResult = await runCommand('bunx', args, projectRoot);
  if (Result.isError(runResult)) {
    return Result.err(new Error(`Failed applying SQL file. ${runResult.error.message}`));
  }

  if (runResult.value.stderr.trim().length > 0) {
    // Wrangler prints non-fatal diagnostics to stderr; only fail on explicit command errors.
    const stderr = runResult.value.stderr;
    if (stderr.includes('[ERROR]') && !stderr.includes('Failed to write to log file Error: EPERM')) {
      return Result.err(new Error('Wrangler reported an error while applying SQL file.'));
    }
  }

  return Result.ok();
}

function buildYouTubeApiUrl(pathname: string, params: Record<string, string>): string {
  const url = new URL(`${YOUTUBE_DATA_API_BASE}/${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function truncateApiErrorBody(value: string): string {
  const normalized = normalizeComparableText(value);
  if (normalized.length <= 220) {
    return normalized;
  }
  return `${normalized.slice(0, 220)}...`;
}

async function fetchYouTubeApiJson<TSchema extends z.ZodTypeAny>(
  sourceUrl: string,
  schema: TSchema,
  label: string
): Promise<Result<z.infer<TSchema>, Error>> {
  const responseResult = await Result.tryPromise(() =>
    fetch(sourceUrl, {
      headers: {
        'User-Agent': 'sg-food-guide-stall-sync/1.0',
      },
    })
  );

  if (Result.isError(responseResult)) {
    return Result.err(new Error(`Failed to fetch YouTube Data API ${label}.`));
  }

  if (!responseResult.value.ok) {
    const bodyResult = await Result.tryPromise(() => responseResult.value.text());
    const bodyText = Result.isError(bodyResult) ? '' : truncateApiErrorBody(bodyResult.value);
    const details = bodyText ? ` (${bodyText})` : '';
    return Result.err(
      new Error(`YouTube Data API ${label} request failed with HTTP ${responseResult.value.status}.${details}`)
    );
  }

  const payloadResult = await Result.tryPromise(() => responseResult.value.json());
  if (Result.isError(payloadResult)) {
    return Result.err(new Error(`Failed to parse YouTube Data API ${label} response.`));
  }

  const parsed = schema.safeParse(payloadResult.value);
  if (!parsed.success) {
    return Result.err(new Error(`Invalid YouTube Data API ${label} response payload.`));
  }

  return Result.ok(parsed.data);
}

async function fetchUploadsPlaylistId(
  channelId: string,
  youtubeApiKey: string
): Promise<Result<string, Error>> {
  const sourceUrl = buildYouTubeApiUrl('channels', {
    part: 'contentDetails',
    id: channelId,
    maxResults: '1',
    key: youtubeApiKey,
  });

  const responseResult = await fetchYouTubeApiJson(
    sourceUrl,
    youtubeChannelsResponseSchema,
    'channels.list'
  );
  if (Result.isError(responseResult)) {
    return Result.err(responseResult.error);
  }

  const uploadsPlaylistId = responseResult.value.items[0]?.contentDetails.relatedPlaylists.uploads ?? '';
  if (!uploadsPlaylistId) {
    return Result.err(new Error(`No uploads playlist found for channel ${channelId}.`));
  }

  return Result.ok(uploadsPlaylistId);
}

async function fetchChannelVideoMap(
  channelId: string,
  youtubeApiKey: string
): Promise<Result<Map<string, string>, Error>> {
  const uploadsPlaylistResult = await fetchUploadsPlaylistId(channelId, youtubeApiKey);
  if (Result.isError(uploadsPlaylistResult)) {
    return Result.err(uploadsPlaylistResult.error);
  }

  const map = new Map<string, string>();
  let pageToken = '';

  for (let pageIndex = 0; pageIndex < MAX_PLAYLIST_PAGES; pageIndex += 1) {
    const sourceUrl = buildYouTubeApiUrl('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistResult.value,
      maxResults: '50',
      key: youtubeApiKey,
      ...(pageToken ? { pageToken } : {}),
    });

    const pageResult = await fetchYouTubeApiJson(
      sourceUrl,
      youtubePlaylistItemsResponseSchema,
      'playlistItems.list'
    );
    if (Result.isError(pageResult)) {
      return Result.err(pageResult.error);
    }

    for (const entry of pageResult.value.items) {
      const videoId = extractVideoId(entry.contentDetails?.videoId) ?? extractVideoId(entry.snippet?.resourceId?.videoId);
      if (!videoId) continue;
      map.set(videoId, (entry.snippet?.title ?? '').trim());
    }

    pageToken = pageResult.value.nextPageToken?.trim() ?? '';
    if (!pageToken) {
      if (map.size === 0) {
        return Result.err(new Error('No videos returned from YouTube uploads playlist.'));
      }
      return Result.ok(map);
    }
  }

  return Result.err(new Error('YouTube uploads pagination exceeded safety limit.'));
}

function parseMissingRows(rows: Array<Record<string, unknown>>): Result<MissingStall[], Error> {
  const parsed: MissingStall[] = [];

  for (const row of rows) {
    const candidate = missingStallSchema.safeParse(row);
    if (!candidate.success) {
      return Result.err(new Error('Invalid missing-stall row payload.'));
    }

    const episode = extractEpisodeKey(candidate.data.episode_number);
    if (!episode) {
      return Result.err(
        new Error(`Missing episode number for stall "${candidate.data.slug}" (${candidate.data.name}).`)
      );
    }

    parsed.push({
      id: candidate.data.id,
      slug: candidate.data.slug,
      name: candidate.data.name,
      cuisine: candidate.data.cuisine,
      cuisineLabel: candidate.data.cuisine_label,
      country: candidate.data.country,
      episode,
    });
  }

  return Result.ok(parsed);
}

function parsePresentRows(
  rows: Array<Record<string, unknown>>,
  channelVideoMap: Map<string, string>
): Result<VideoCandidate[], Error> {
  const parsed: VideoCandidate[] = [];

  for (const row of rows) {
    const candidate = presentStallSchema.safeParse(row);
    if (!candidate.success) {
      return Result.err(new Error('Invalid present-stall row payload.'));
    }

    const episode = extractEpisodeKey(candidate.data.episode_number);
    if (!episode) continue;

    const videoId = extractVideoId(candidate.data.youtube_video_id) ?? extractVideoId(candidate.data.youtube_video_url);
    if (!videoId) continue;

    const videoUrl = buildWatchUrl(videoId);
    const titleFromRow = (candidate.data.youtube_title ?? '').trim();
    const youtubeTitle = titleFromRow || channelVideoMap.get(videoId) || '';

    parsed.push({
      videoId,
      videoUrl,
      youtubeTitle,
      cuisine: candidate.data.cuisine,
      country: candidate.data.country,
      episode,
    });
  }

  return Result.ok(parsed);
}

function dedupeCandidates(candidates: VideoCandidate[]): VideoCandidate[] {
  const map = new Map<string, VideoCandidate>();
  for (const candidate of candidates) {
    if (!map.has(candidate.videoId)) {
      map.set(candidate.videoId, candidate);
      continue;
    }

    const existing = map.get(candidate.videoId)!;
    if (!existing.youtubeTitle && candidate.youtubeTitle) {
      map.set(candidate.videoId, candidate);
    }
  }
  return [...map.values()];
}

function scoreCandidate(stall: MissingStall, candidate: VideoCandidate): number {
  const title = normalizeComparableText(candidate.youtubeTitle);
  const cuisine = normalizeComparableText(stall.cuisineLabel || stall.cuisine.replaceAll('-', ' '));
  const nameTokens = getSignificantNameTokens(stall.name);

  let score = 0;

  if (episodeTokenMatchesTitle(stall.episode, candidate.youtubeTitle)) score += 10;
  if (title.includes(cuisine)) score += 8;
  if (candidate.country === stall.country) score += 6;
  if (!isMembersVideo(candidate.youtubeTitle)) score += 4;
  if (isMembersVideo(candidate.youtubeTitle)) score -= 4;

  if (stall.country === 'SG' && title.includes('singapore')) score += 2;
  if (stall.country === 'MY' && title.includes('malaysia')) score += 2;

  for (const token of nameTokens) {
    if (title.includes(token)) {
      score += 14;
    }
  }

  return score;
}

function chooseBestCandidate(
  stall: MissingStall,
  candidates: VideoCandidate[]
): Result<{ candidate: VideoCandidate; reason: string }, Error> {
  if (candidates.length === 0) {
    return Result.err(new Error(`No candidate videos found for ${stall.slug}.`));
  }

  if (candidates.length === 1) {
    return Result.ok({
      candidate: candidates[0],
      reason: 'single-candidate',
    });
  }

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(stall, candidate),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (isMembersVideo(a.candidate.youtubeTitle) !== isMembersVideo(b.candidate.youtubeTitle)) {
        return Number(isMembersVideo(a.candidate.youtubeTitle)) - Number(isMembersVideo(b.candidate.youtubeTitle));
      }
      return a.candidate.videoId.localeCompare(b.candidate.videoId);
    });

  const best = ranked[0];
  const second = ranked[1];
  if (second && best.score === second.score) {
    return Result.err(
      new Error(
        `Ambiguous candidate scores for ${stall.slug}: ${best.candidate.videoId} vs ${second.candidate.videoId}.`
      )
    );
  }

  return Result.ok({
    candidate: best.candidate,
    reason: `ranked:${best.score}`,
  });
}

function buildAssignments(
  missing: MissingStall[],
  present: VideoCandidate[],
  channelVideoMap: Map<string, string>
): Result<Assignment[], Error> {
  const byGroupCountry = new Map<string, VideoCandidate[]>();
  const byGroup = new Map<string, VideoCandidate[]>();

  for (const row of present) {
    const keyCountry = groupCountryKey(row.cuisine, row.episode, row.country);
    const keyGroup = groupKey(row.cuisine, row.episode);
    byGroupCountry.set(keyCountry, [...(byGroupCountry.get(keyCountry) ?? []), row]);
    byGroup.set(keyGroup, [...(byGroup.get(keyGroup) ?? []), row]);
  }

  for (const [key, rows] of byGroupCountry.entries()) {
    byGroupCountry.set(key, dedupeCandidates(rows));
  }
  for (const [key, rows] of byGroup.entries()) {
    byGroup.set(key, dedupeCandidates(rows));
  }

  const assignments: Assignment[] = [];

  for (const stall of missing) {
    const candidatesByCountry =
      byGroupCountry.get(groupCountryKey(stall.cuisine, stall.episode, stall.country)) ?? [];
    const candidates = candidatesByCountry.length > 0 ? candidatesByCountry : byGroup.get(groupKey(stall.cuisine, stall.episode)) ?? [];

    const selectedResult = chooseBestCandidate(stall, candidates);
    if (Result.isError(selectedResult)) {
      return Result.err(selectedResult.error);
    }

    const selected = selectedResult.value.candidate;
    if (!channelVideoMap.has(selected.videoId)) {
      return Result.err(
        new Error(`Selected video ID ${selected.videoId} for ${stall.slug} was not found in channel feed.`)
      );
    }

    assignments.push({
      stall,
      videoId: selected.videoId,
      videoUrl: selected.videoUrl,
      youtubeTitle: selected.youtubeTitle || channelVideoMap.get(selected.videoId) || '',
      reason: selectedResult.value.reason,
    });
  }

  return Result.ok(assignments);
}

function buildApplySql(assignments: Assignment[]): string {
  const lines: string[] = [];

  for (const assignment of assignments) {
    lines.push(
      `UPDATE stalls
SET youtube_video_url = ${sqlQuote(assignment.videoUrl)},
    youtube_video_id = ${sqlQuote(assignment.videoId)},
    source_youtube_hash = ${sqlQuote(assignment.videoId)},
    updated_at = CURRENT_TIMESTAMP
WHERE id = ${sqlQuote(assignment.stall.id)}
  AND (youtube_video_url IS NULL OR TRIM(youtube_video_url) = '');`
    );

    lines.push(
      `UPDATE stall_locations
SET youtube_video_url = ${sqlQuote(assignment.videoUrl)},
    updated_at = CURRENT_TIMESTAMP
WHERE stall_id = ${sqlQuote(assignment.stall.id)}
  AND is_active = 1
  AND (youtube_video_url IS NULL OR TRIM(youtube_video_url) = '');`
    );
  }

  return `${lines.join('\n')}\n`;
}

function printAssignmentPreview(assignments: Assignment[]): void {
  console.log(`Prepared ${assignments.length} assignments:\n`);
  for (const assignment of assignments) {
    console.log(
      [
        `${assignment.stall.slug}`,
        `${assignment.stall.cuisine} ep${assignment.stall.episode}`,
        assignment.videoId,
        assignment.reason,
      ].join(' | ')
    );
  }
}

async function main(): Promise<void> {
  const cliResult = Result.try(() => parseArgs(process.argv.slice(2)));
  if (Result.isError(cliResult)) {
    throw cliResult.error;
  }
  const cli = cliResult.value;

  const projectRoot = process.cwd();
  const channelMapResult = await fetchChannelVideoMap(cli.channelId, cli.youtubeApiKey);
  if (Result.isError(channelMapResult)) {
    throw channelMapResult.error;
  }
  const channelVideoMap = channelMapResult.value;

  const missingRowsResult = await queryD1Rows(
    projectRoot,
    cli.dbName,
    cli.remote,
    `SELECT id, slug, name, cuisine, cuisine_label, country, episode_number
     FROM stalls
     WHERE status = 'active'
       AND (youtube_video_url IS NULL OR TRIM(youtube_video_url) = '')
     ORDER BY cuisine, episode_number, name`
  );
  if (Result.isError(missingRowsResult)) {
    throw missingRowsResult.error;
  }

  const missingParseResult = parseMissingRows(missingRowsResult.value);
  if (Result.isError(missingParseResult)) {
    throw missingParseResult.error;
  }
  const missing = missingParseResult.value;

  if (missing.length === 0) {
    console.log('No missing YouTube URLs found. Nothing to do.');
    return;
  }

  const presentRowsResult = await queryD1Rows(
    projectRoot,
    cli.dbName,
    cli.remote,
    `SELECT id, name, cuisine, cuisine_label, country, episode_number, youtube_title, youtube_video_url, youtube_video_id
     FROM stalls
     WHERE status = 'active'
       AND youtube_video_url IS NOT NULL
       AND TRIM(youtube_video_url) <> ''
     ORDER BY cuisine, episode_number, country, name`
  );
  if (Result.isError(presentRowsResult)) {
    throw presentRowsResult.error;
  }

  const presentParseResult = parsePresentRows(presentRowsResult.value, channelVideoMap);
  if (Result.isError(presentParseResult)) {
    throw presentParseResult.error;
  }

  const assignmentsResult = buildAssignments(missing, presentParseResult.value, channelVideoMap);
  if (Result.isError(assignmentsResult)) {
    throw assignmentsResult.error;
  }
  const assignments = assignmentsResult.value;

  printAssignmentPreview(assignments);

  if (!cli.apply) {
    console.log('\nDry-run mode. Re-run with --apply to persist changes.');
    return;
  }

  const tmpDir = mkdtempSync(join(tmpdir(), 'sg-food-guide-youtube-backfill-'));
  const sqlFile = join(tmpDir, 'backfill.sql');
  writeFileSync(sqlFile, buildApplySql(assignments), 'utf8');

  const applyResult = await runD1SqlFile(projectRoot, cli.dbName, cli.remote, sqlFile);
  rmSync(tmpDir, { recursive: true, force: true });
  if (Result.isError(applyResult)) {
    throw applyResult.error;
  }

  const verifyResult = await queryD1Rows(
    projectRoot,
    cli.dbName,
    cli.remote,
    `SELECT COUNT(*) AS missing_youtube
     FROM stalls
     WHERE status = 'active'
       AND (youtube_video_url IS NULL OR TRIM(youtube_video_url) = '')`
  );
  if (Result.isError(verifyResult)) {
    throw verifyResult.error;
  }

  const verifyCount = Number((verifyResult.value[0]?.missing_youtube as number | string | undefined) ?? 0);
  console.log(`\nApply complete. Remaining missing YouTube URLs: ${verifyCount}`);
}

const mainResult = await Result.tryPromise(() => main());
if (Result.isError(mainResult)) {
  const message = mainResult.error instanceof Error ? mainResult.error.message : String(mainResult.error);
  console.error(`Backfill failed: ${message}`);
  process.exitCode = 1;
}
