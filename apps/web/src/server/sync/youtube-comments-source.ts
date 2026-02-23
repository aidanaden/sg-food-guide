import { Result } from 'better-result';
import * as z from 'zod';

import type { WorkerEnv } from '../cloudflare/runtime';
import { buildYouTubeVideoUrl, normalizeDisplayText, normalizeYouTubeVideoId } from './normalize';

const YOUTUBE_DATA_API_BASE = 'https://www.googleapis.com/youtube/v3';
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 350;
const MAX_COMMENT_THREAD_PAGES = 4;
const MAX_REPLY_PAGES = 10;
const SHORT_DURATION_SECONDS_THRESHOLD = 120;

const commentSnippetSchema = z.object({
  videoId: z.optional(z.string()),
  parentId: z.optional(z.string()),
  textDisplay: z.optional(z.string()),
  textOriginal: z.optional(z.string()),
  authorDisplayName: z.optional(z.string()),
  likeCount: z.optional(z.union([z.number(), z.string()])),
  publishedAt: z.optional(z.string()),
  updatedAt: z.optional(z.string()),
});

const commentThreadItemSchema = z.object({
  snippet: z.optional(
    z.object({
      totalReplyCount: z.optional(z.union([z.number(), z.string()])),
      topLevelComment: z.optional(
        z.object({
          id: z.string(),
          snippet: commentSnippetSchema,
        })
      ),
    })
  ),
});

const commentThreadsResponseSchema = z.object({
  nextPageToken: z.optional(z.string()),
  items: z.array(commentThreadItemSchema),
});

const repliesResponseSchema = z.object({
  nextPageToken: z.optional(z.string()),
  items: z.array(
    z.object({
      id: z.string(),
      snippet: commentSnippetSchema,
    })
  ),
});

const videosListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      snippet: z.optional(
        z.object({
          title: z.optional(z.string()),
          liveBroadcastContent: z.optional(z.string()),
        })
      ),
      contentDetails: z.optional(
        z.object({
          duration: z.optional(z.string()),
        })
      ),
    })
  ),
});

export interface YouTubeVideoMetadata {
  videoId: string;
  title: string;
  durationSeconds: number | null;
  liveBroadcastContent: string;
  isRegularVideo: boolean;
}

export interface YouTubeCommentEntry {
  commentId: string;
  parentCommentId: string | null;
  replyCount: number;
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  isTopLevel: boolean;
  isPinned: boolean;
  likeCount: number;
  authorDisplayName: string;
  text: string;
  publishedAt: string | null;
  updatedAt: string | null;
}

function resolveApiKey(env: WorkerEnv): Result<string, Error> {
  const apiKey = normalizeDisplayText(env.YOUTUBE_DATA_API_KEY ?? '');
  if (!apiKey) {
    return Result.err(new Error('Missing YOUTUBE_DATA_API_KEY for YouTube comment sync.'));
  }

  return Result.ok(apiKey);
}

function buildApiUrl(pathname: string, params: Record<string, string>): string {
  const url = new URL(`${YOUTUBE_DATA_API_BASE}/${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (!value) {
      continue;
    }
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function parseNumeric(input: number | string | undefined): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : 0;
}

function parseDurationToSeconds(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  if (!Number.isFinite(total)) {
    return null;
  }

  return total;
}

function normalizeCommentText(snippet: z.infer<typeof commentSnippetSchema>): string {
  const original = normalizeDisplayText(snippet.textOriginal ?? '');
  if (original) {
    return original;
  }

  return normalizeDisplayText(snippet.textDisplay ?? '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchApiJsonWithRetry<TSchema extends z.ZodTypeAny>(
  url: string,
  schema: TSchema,
  label: string,
  attempts = DEFAULT_ATTEMPTS
): Promise<Result<z.infer<TSchema>, Error>> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const responseResult = await Result.tryPromise(() =>
      fetch(url, {
        headers: {
          'User-Agent': 'sg-food-guide-comment-sync/1.0',
        },
      })
    );

    if (Result.isError(responseResult)) {
      lastError =
        responseResult.error instanceof Error
          ? responseResult.error
          : new Error(String(responseResult.error));
    } else if (!responseResult.value.ok) {
      const bodyResult = await Result.tryPromise(() => responseResult.value.text());
      const bodyText = Result.isError(bodyResult) ? '' : normalizeDisplayText(bodyResult.value).slice(0, 280);
      lastError = new Error(`${label} failed with HTTP ${responseResult.value.status}${bodyText ? ` (${bodyText})` : ''}`);
    } else {
      const payloadResult = await Result.tryPromise(() => responseResult.value.json());
      if (Result.isError(payloadResult)) {
        lastError = new Error(`Failed to parse ${label} JSON payload.`);
      } else {
        const parsedPayload = schema.safeParse(payloadResult.value);
        if (parsedPayload.success) {
          return Result.ok(parsedPayload.data);
        }

        lastError = new Error(`Invalid ${label} payload shape.`);
      }
    }

    if (attempt < attempts) {
      await sleep(DEFAULT_BACKOFF_MS * Math.pow(2, attempt - 1));
    }
  }

  return Result.err(lastError ?? new Error(`Failed to fetch ${label}.`));
}

function buildTopLevelComment(
  thread: z.infer<typeof commentThreadItemSchema>,
  videoId: string,
  videoTitle: string,
  isPinned: boolean
): YouTubeCommentEntry | null {
  const topLevelComment = thread.snippet?.topLevelComment;
  if (!topLevelComment) {
    return null;
  }

  const parsedVideoId = normalizeYouTubeVideoId(topLevelComment.snippet.videoId ?? videoId);
  if (!parsedVideoId) {
    return null;
  }

  const text = normalizeCommentText(topLevelComment.snippet);
  if (!text) {
    return null;
  }

  return {
    commentId: topLevelComment.id,
    parentCommentId: null,
    replyCount: parseNumeric(thread.snippet?.totalReplyCount),
    videoId: parsedVideoId,
    videoUrl: buildYouTubeVideoUrl(parsedVideoId) ?? '',
    videoTitle,
    isTopLevel: true,
    isPinned,
    likeCount: parseNumeric(topLevelComment.snippet.likeCount),
    authorDisplayName: normalizeDisplayText(topLevelComment.snippet.authorDisplayName ?? ''),
    text,
    publishedAt: topLevelComment.snippet.publishedAt ?? null,
    updatedAt: topLevelComment.snippet.updatedAt ?? null,
  };
}

function buildReplyComment(
  item: z.infer<typeof repliesResponseSchema>['items'][number],
  videoId: string,
  videoTitle: string
): YouTubeCommentEntry | null {
  const parsedVideoId = normalizeYouTubeVideoId(item.snippet.videoId ?? videoId);
  if (!parsedVideoId) {
    return null;
  }

  const text = normalizeCommentText(item.snippet);
  if (!text) {
    return null;
  }

  const parentCommentId = normalizeDisplayText(item.snippet.parentId ?? '');

  return {
    commentId: item.id,
    parentCommentId: parentCommentId || null,
    replyCount: 0,
    videoId: parsedVideoId,
    videoUrl: buildYouTubeVideoUrl(parsedVideoId) ?? '',
    videoTitle,
    isTopLevel: false,
    isPinned: false,
    likeCount: parseNumeric(item.snippet.likeCount),
    authorDisplayName: normalizeDisplayText(item.snippet.authorDisplayName ?? ''),
    text,
    publishedAt: item.snippet.publishedAt ?? null,
    updatedAt: item.snippet.updatedAt ?? null,
  };
}

export async function fetchYouTubeVideoMetadata(
  env: WorkerEnv,
  videoIds: string[]
): Promise<Result<Map<string, YouTubeVideoMetadata>, Error>> {
  const normalizedVideoIds = [...new Set(videoIds.map((videoId) => normalizeYouTubeVideoId(videoId)).filter(Boolean))] as string[];
  if (normalizedVideoIds.length === 0) {
    return Result.ok(new Map());
  }

  const apiKeyResult = resolveApiKey(env);
  if (Result.isError(apiKeyResult)) {
    return Result.err(apiKeyResult.error);
  }

  const metadataByVideoId = new Map<string, YouTubeVideoMetadata>();

  for (let index = 0; index < normalizedVideoIds.length; index += 50) {
    const batchIds = normalizedVideoIds.slice(index, index + 50);
    const responseUrl = buildApiUrl('videos', {
      part: 'snippet,contentDetails',
      id: batchIds.join(','),
      key: apiKeyResult.value,
      maxResults: '50',
    });

    const responseResult = await fetchApiJsonWithRetry(responseUrl, videosListResponseSchema, 'videos.list');
    if (Result.isError(responseResult)) {
      return Result.err(responseResult.error);
    }

    for (const item of responseResult.value.items) {
      const normalizedVideoId = normalizeYouTubeVideoId(item.id);
      if (!normalizedVideoId) {
        continue;
      }

      const title = normalizeDisplayText(item.snippet?.title ?? '');
      const durationSeconds = parseDurationToSeconds(item.contentDetails?.duration);
      const liveBroadcastContent = normalizeDisplayText(item.snippet?.liveBroadcastContent ?? 'none').toLowerCase();
      const isShortTitle = /\b#?shorts\b/i.test(title);
      const isLive = liveBroadcastContent !== 'none';
      const isVeryShort = durationSeconds !== null && durationSeconds <= SHORT_DURATION_SECONDS_THRESHOLD;
      const isRegularVideo = !isLive && !isShortTitle && !isVeryShort;

      metadataByVideoId.set(normalizedVideoId, {
        videoId: normalizedVideoId,
        title,
        durationSeconds,
        liveBroadcastContent,
        isRegularVideo,
      });
    }
  }

  return Result.ok(metadataByVideoId);
}

async function fetchRepliesForTopLevelComment(
  apiKey: string,
  videoId: string,
  videoTitle: string,
  parentCommentId: string
): Promise<Result<YouTubeCommentEntry[], Error>> {
  const entries: YouTubeCommentEntry[] = [];
  let pageToken = '';

  for (let pageIndex = 0; pageIndex < MAX_REPLY_PAGES; pageIndex += 1) {
    const responseUrl = buildApiUrl('comments', {
      part: 'snippet',
      maxResults: '100',
      parentId: parentCommentId,
      textFormat: 'plainText',
      key: apiKey,
      ...(pageToken ? { pageToken } : {}),
    });

    const responseResult = await fetchApiJsonWithRetry(responseUrl, repliesResponseSchema, 'comments.list');
    if (Result.isError(responseResult)) {
      return Result.err(responseResult.error);
    }

    for (const reply of responseResult.value.items) {
      const entry = buildReplyComment(reply, videoId, videoTitle);
      if (!entry) {
        continue;
      }
      entries.push(entry);
    }

    pageToken = responseResult.value.nextPageToken?.trim() ?? '';
    if (!pageToken) {
      return Result.ok(entries);
    }
  }

  return Result.ok(entries);
}

export async function fetchTopYouTubeCommentsForVideo(
  env: WorkerEnv,
  args: {
    videoId: string;
    videoTitle: string;
    topLevelLimit: number;
  }
): Promise<Result<{ comments: YouTubeCommentEntry[]; repliesFetched: number }, Error>> {
  const videoId = normalizeYouTubeVideoId(args.videoId);
  if (!videoId) {
    return Result.err(new Error('Invalid video id for YouTube comments fetch.'));
  }

  const apiKeyResult = resolveApiKey(env);
  if (Result.isError(apiKeyResult)) {
    return Result.err(apiKeyResult.error);
  }

  const topLevelCandidates: YouTubeCommentEntry[] = [];
  let pageToken = '';

  for (let pageIndex = 0; pageIndex < MAX_COMMENT_THREAD_PAGES; pageIndex += 1) {
    const responseUrl = buildApiUrl('commentThreads', {
      part: 'snippet',
      maxResults: '100',
      order: 'relevance',
      textFormat: 'plainText',
      videoId,
      key: apiKeyResult.value,
      ...(pageToken ? { pageToken } : {}),
    });

    const responseResult = await fetchApiJsonWithRetry(responseUrl, commentThreadsResponseSchema, 'commentThreads.list');
    if (Result.isError(responseResult)) {
      return Result.err(responseResult.error);
    }

    for (const [threadIndex, thread] of responseResult.value.items.entries()) {
      const entry = buildTopLevelComment(thread, videoId, args.videoTitle, pageIndex === 0 && threadIndex === 0);
      if (!entry) {
        continue;
      }
      topLevelCandidates.push(entry);
    }

    pageToken = responseResult.value.nextPageToken?.trim() ?? '';
    if (!pageToken) {
      break;
    }
  }

  const sortedTopLevel = [...topLevelCandidates].sort((left, right) => right.likeCount - left.likeCount);
  const pinnedTopLevel = topLevelCandidates.filter((item) => item.isPinned);
  const selectedMap = new Map<string, YouTubeCommentEntry>();

  for (const pinnedComment of pinnedTopLevel) {
    selectedMap.set(pinnedComment.commentId, pinnedComment);
  }

  for (const comment of sortedTopLevel) {
    if (selectedMap.size >= args.topLevelLimit) {
      break;
    }
    selectedMap.set(comment.commentId, comment);
  }

  const selectedTopLevel = [...selectedMap.values()];
  let repliesFetched = 0;
  const allComments: YouTubeCommentEntry[] = [...selectedTopLevel];

  for (const topLevelComment of selectedTopLevel) {
    if (topLevelComment.replyCount <= 0) {
      continue;
    }

    const repliesResult = await fetchRepliesForTopLevelComment(
      apiKeyResult.value,
      videoId,
      args.videoTitle,
      topLevelComment.commentId
    );

    if (Result.isError(repliesResult)) {
      return Result.err(repliesResult.error);
    }

    repliesFetched += repliesResult.value.length;
    allComments.push(...repliesResult.value);
  }

  return Result.ok({
    comments: allComments,
    repliesFetched,
  });
}
