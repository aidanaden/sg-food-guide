import { Result } from 'better-result';
import * as z from 'zod';

import type { WorkerEnv } from '../cloudflare/runtime';
import { buildYouTubeVideoUrl, normalizeDisplayText, normalizeYouTubeVideoId } from './normalize';

const videoEntrySchema = z.object({
  videoId: z.string().min(1),
  videoUrl: z.string().url(),
  title: z.string(),
  publishedAt: z.string(),
});

export type YouTubeVideoEntry = z.infer<typeof videoEntrySchema>;

const channelListResponseSchema = z.object({
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

const playlistItemSchema = z.object({
  snippet: z
    .object({
      title: z.string().optional(),
      publishedAt: z.string().optional(),
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
      videoPublishedAt: z.string().optional(),
    })
    .optional(),
});

const playlistItemsResponseSchema = z.object({
  nextPageToken: z.string().optional(),
  items: z.array(playlistItemSchema),
});

const DEFAULT_YOUTUBE_CHANNEL_ID = 'UCH-dJYvV8UiemFsLZRO0X4A';
const YOUTUBE_DATA_API_BASE = 'https://www.googleapis.com/youtube/v3';
const MAX_PLAYLIST_PAGES = 200;
const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function resolveChannelId(env: WorkerEnv): string {
  return normalizeDisplayText(env.YOUTUBE_CHANNEL_ID ?? DEFAULT_YOUTUBE_CHANNEL_ID) || DEFAULT_YOUTUBE_CHANNEL_ID;
}

function resolveApiKey(env: WorkerEnv): Result<string, Error> {
  const apiKey = normalizeDisplayText(env.YOUTUBE_DATA_API_KEY ?? '');
  if (!apiKey) {
    return Result.err(new Error('Missing YOUTUBE_DATA_API_KEY for YouTube Data API sync.'));
  }

  return Result.ok(apiKey);
}

function buildApiUrl(pathname: string, params: Record<string, string>): string {
  const url = new URL(`${YOUTUBE_DATA_API_BASE}/${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function truncateErrorPayload(value: string): string {
  const normalized = normalizeDisplayText(value);
  if (normalized.length <= 220) {
    return normalized;
  }
  return `${normalized.slice(0, 220)}...`;
}

function extractVideoIdsFromChannelSearchHtml(html: string, maxResults: number): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const matches = html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g);
  for (const match of matches) {
    const id = normalizeYouTubeVideoId(match[1] ?? '');
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
    if (ids.length >= maxResults) {
      break;
    }
  }
  return ids;
}

async function fetchApiJson<TSchema extends z.ZodTypeAny>(
  url: string,
  schema: TSchema,
  label: string
): Promise<Result<z.infer<TSchema>, Error>> {
  const responseResult = await Result.tryPromise(() =>
    fetch(url, {
      headers: {
        'User-Agent': 'sg-food-guide-stall-sync/1.0',
      },
    })
  );

  if (Result.isError(responseResult)) {
    const reason =
      responseResult.error instanceof Error
        ? truncateErrorPayload(responseResult.error.message)
        : truncateErrorPayload(String(responseResult.error));
    const details = reason ? ` Reason: ${reason}` : '';
    return Result.err(new Error(`Failed to fetch YouTube Data API ${label}.${details}`));
  }

  if (!responseResult.value.ok) {
    const bodyResult = await Result.tryPromise(() => responseResult.value.text());
    const bodyText = Result.isError(bodyResult) ? '' : truncateErrorPayload(bodyResult.value);
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

async function fetchUploadsPlaylistId(channelId: string, apiKey: string): Promise<Result<string, Error>> {
  const sourceUrl = buildApiUrl('channels', {
    part: 'contentDetails',
    id: channelId,
    maxResults: '1',
    key: apiKey,
  });

  const responseResult = await fetchApiJson(sourceUrl, channelListResponseSchema, 'channels.list');
  if (Result.isError(responseResult)) {
    return Result.err(responseResult.error);
  }

  const uploadsPlaylist = responseResult.value.items[0]?.contentDetails.relatedPlaylists.uploads ?? '';
  if (!uploadsPlaylist) {
    return Result.err(new Error(`No uploads playlist found for channel ${channelId}.`));
  }

  return Result.ok(uploadsPlaylist);
}

function parseVideoEntry(item: z.infer<typeof playlistItemSchema>): YouTubeVideoEntry | null {
  const rawVideoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId ?? '';
  const videoId = normalizeYouTubeVideoId(rawVideoId);
  const videoUrl = buildYouTubeVideoUrl(videoId);
  if (!videoId || !videoUrl) {
    return null;
  }

  const candidate = videoEntrySchema.safeParse({
    videoId,
    videoUrl,
    title: normalizeDisplayText(item.snippet?.title ?? ''),
    publishedAt:
      item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt ?? new Date(0).toISOString(),
  });

  if (!candidate.success) {
    return null;
  }

  return candidate.data;
}

async function fetchUploadsPlaylistEntries(
  uploadsPlaylistId: string,
  apiKey: string
): Promise<Result<YouTubeVideoEntry[], Error>> {
  const entries: YouTubeVideoEntry[] = [];
  const seenIds = new Set<string>();
  let pageToken = '';

  for (let pageIndex = 0; pageIndex < MAX_PLAYLIST_PAGES; pageIndex += 1) {
    const sourceUrl = buildApiUrl('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: '50',
      key: apiKey,
      ...(pageToken ? { pageToken } : {}),
    });

    const responseResult = await fetchApiJson(sourceUrl, playlistItemsResponseSchema, 'playlistItems.list');
    if (Result.isError(responseResult)) {
      return Result.err(responseResult.error);
    }

    for (const item of responseResult.value.items) {
      const entry = parseVideoEntry(item);
      if (!entry || seenIds.has(entry.videoId)) {
        continue;
      }
      seenIds.add(entry.videoId);
      entries.push(entry);
    }

    pageToken = responseResult.value.nextPageToken?.trim() ?? '';
    if (!pageToken) {
      return Result.ok(entries);
    }
  }

  return Result.err(new Error('YouTube uploads pagination exceeded safety limit.'));
}

export async function fetchYouTubeVideos(env: WorkerEnv): Promise<Result<YouTubeVideoEntry[], Error>> {
  const apiKeyResult = resolveApiKey(env);
  if (Result.isError(apiKeyResult)) {
    return Result.err(apiKeyResult.error);
  }

  const channelId = resolveChannelId(env);
  const uploadsPlaylistResult = await fetchUploadsPlaylistId(channelId, apiKeyResult.value);
  if (Result.isError(uploadsPlaylistResult)) {
    return Result.err(uploadsPlaylistResult.error);
  }

  return fetchUploadsPlaylistEntries(uploadsPlaylistResult.value, apiKeyResult.value);
}

export async function searchYouTubeChannelVideoIdsByQuery(
  env: WorkerEnv,
  query: string,
  maxResults = 5
): Promise<Result<string[], Error>> {
  const normalizedQuery = normalizeDisplayText(query);
  if (!normalizedQuery) {
    return Result.ok([]);
  }

  const safeMaxResults = Number.isFinite(maxResults)
    ? Math.max(1, Math.min(10, Math.trunc(maxResults)))
    : 5;
  const channelId = resolveChannelId(env);
  const searchUrl = `https://www.youtube.com/channel/${channelId}/search?query=${encodeURIComponent(normalizedQuery)}`;
  const responseResult = await Result.tryPromise(() =>
    fetch(searchUrl, {
      headers: {
        'User-Agent': 'sg-food-guide-stall-sync/1.0',
      },
    })
  );

  if (Result.isError(responseResult)) {
    return Result.err(new Error('Failed to query YouTube channel search page.'));
  }
  if (!responseResult.value.ok) {
    return Result.err(
      new Error(`YouTube channel search request failed with HTTP ${responseResult.value.status}.`)
    );
  }

  const htmlResult = await Result.tryPromise(() => responseResult.value.text());
  if (Result.isError(htmlResult)) {
    return Result.err(new Error('Failed to read YouTube channel search response body.'));
  }

  const ids = extractVideoIdsFromChannelSearchHtml(htmlResult.value, safeMaxResults).filter((id) =>
    YOUTUBE_VIDEO_ID_RE.test(id)
  );
  return Result.ok(ids);
}
