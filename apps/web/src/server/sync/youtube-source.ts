import { Result } from 'better-result';
import * as z from 'zod';

import type { WorkerEnv } from '../cloudflare/runtime';
import { buildYouTubeVideoUrl, normalizeDisplayText, normalizeYouTubeVideoId } from './normalize';

const channelFeedSchema = z.object({
  sourceUrl: z.string(),
  xml: z.string(),
});

const videoEntrySchema = z.object({
  videoId: z.string().min(1),
  videoUrl: z.string().url(),
  title: z.string(),
  publishedAt: z.string(),
});

export type YouTubeVideoEntry = z.infer<typeof videoEntrySchema>;

const DEFAULT_YOUTUBE_CHANNEL_ID = 'UCH-dJYvV8UiemFsLZRO0X4A';

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractTagValue(source: string, tagName: string): string {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = source.match(pattern);
  return match?.[1]?.trim() ?? '';
}

function extractAlternateLink(source: string): string {
  const match = source.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"[^>]*>/i);
  return match?.[1]?.trim() ?? '';
}

function extractEntries(xml: string): string[] {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)]
    .map((match) => match[1] ?? '')
    .filter((value) => value.length > 0);
}

function buildFeedFromChannelId(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

function buildFeedUrl(env: WorkerEnv): string {
  const explicitFeedUrl = normalizeDisplayText(env.YOUTUBE_CHANNEL_FEED_URL ?? '');
  if (explicitFeedUrl.length > 0) {
    return explicitFeedUrl;
  }

  const channelId =
    normalizeDisplayText(env.YOUTUBE_CHANNEL_ID ?? DEFAULT_YOUTUBE_CHANNEL_ID) ||
    DEFAULT_YOUTUBE_CHANNEL_ID;
  return buildFeedFromChannelId(channelId);
}

export async function fetchYouTubeFeed(env: WorkerEnv): Promise<Result<{ sourceUrl: string; xml: string }, Error>> {
  const sourceUrl = buildFeedUrl(env);
  const responseResult = await Result.tryPromise(() =>
    fetch(sourceUrl, {
      headers: {
        'User-Agent': 'sg-food-guide-stall-sync/1.0',
      },
    })
  );

  if (Result.isError(responseResult)) {
    return Result.err(new Error('Failed to fetch YouTube channel feed.'));
  }

  if (!responseResult.value.ok) {
    return Result.err(new Error(`YouTube feed fetch failed with HTTP ${responseResult.value.status}.`));
  }

  const textResult = await Result.tryPromise(() => responseResult.value.text());
  if (Result.isError(textResult)) {
    return Result.err(new Error('Failed reading YouTube feed response body.'));
  }

  const payload = channelFeedSchema.safeParse({
    sourceUrl,
    xml: textResult.value,
  });

  if (!payload.success) {
    return Result.err(new Error('Invalid YouTube feed payload.'));
  }

  return Result.ok(payload.data);
}

export function parseYouTubeFeedEntries(xml: string): Result<YouTubeVideoEntry[], Error> {
  const entries = extractEntries(xml);
  const parsedEntries: YouTubeVideoEntry[] = [];

  for (const entry of entries) {
    const rawVideoId = extractTagValue(entry, 'yt:videoId') || extractTagValue(entry, 'videoId');
    const rawLink = extractAlternateLink(entry);
    const rawTitle = decodeXmlEntities(extractTagValue(entry, 'title'));
    const rawPublished = extractTagValue(entry, 'published') || extractTagValue(entry, 'updated');

    const videoId = normalizeYouTubeVideoId(rawVideoId) ?? normalizeYouTubeVideoId(rawLink);
    const videoUrl = buildYouTubeVideoUrl(videoId ?? rawLink);

    if (!videoId || !videoUrl) {
      continue;
    }

    const candidate = videoEntrySchema.safeParse({
      videoId,
      videoUrl,
      title: rawTitle,
      publishedAt: rawPublished || new Date(0).toISOString(),
    });

    if (!candidate.success) {
      return Result.err(new Error('Invalid YouTube feed entry payload.'));
    }

    parsedEntries.push(candidate.data);
  }

  return Result.ok(parsedEntries);
}
