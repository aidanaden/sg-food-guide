import { Result } from 'better-result';
import * as z from 'zod/mini';

import type { WorkerEnv } from '../cloudflare/runtime';
import { normalizeComparableText, normalizeDisplayText, normalizeIdentityText } from './normalize';
import type { YouTubeCommentEntry } from './youtube-comments-source';

const EXCLUDED_NAME_TOKENS = new Set([
  'food',
  'stall',
  'stalls',
  'place',
  'places',
  'this',
  'that',
  'there',
  'here',
  'episode',
  'video',
  'review',
  'channel',
  'restaurant',
  'restaurants',
  'hawker',
  'centre',
  'center',
  'please',
  'thanks',
]);

const PROFANITY_PATTERNS = [
  /\bf+u+c*k+\b/i,
  /\bb+i+t+c+h+\b/i,
  /\ba+s+s+h+o+l+e+\b/i,
  /\bm+o+t+h+e+r+f+u+c*k+e*r+\b/i,
];

const SPAM_PATTERNS = [
  /\bwhatsapp\b/i,
  /\btelegram\b/i,
  /\bcontact\s+me\b/i,
  /\bdm\s+me\b/i,
  /\bsubscribe\b/i,
  /\bfollow\s+me\b/i,
  /\bearn\s+money\b/i,
];

const SELF_PROMO_PATTERNS = [/\bmy\s+channel\b/i, /\bcheck\s+out\s+my\b/i, /\bi\s+sell\b/i];

const MAPS_URL_PATTERN =
  /(https?:\/\/(?:maps\.app\.goo\.gl\/[^\s]+|goo\.gl\/maps\/[^\s]+|(?:www\.)?google\.com\/maps[^\s]*))/gi;

const llmResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.optional(z.string()),
      }),
    })
  ),
});

const llmJsonPayloadSchema = z.object({
  stalls: z.array(z.string()),
});

export type CommentModerationFlag = 'spam' | 'profanity' | 'self-promo' | 'insufficient-signal';

export interface ExtractedStallSuggestion {
  normalizedName: string;
  displayName: string;
  confidenceScore: number;
  moderationFlags: CommentModerationFlag[];
  mapsUrls: string[];
  extractionMethod: 'rules' | 'llm' | 'mixed';
  extractionNotes: string;
}

export interface ExtractionOptions {
  llmEnabled: boolean;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function extractMapsUrls(input: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const match of input.matchAll(MAPS_URL_PATTERN)) {
    const candidate = normalizeDisplayText(match[0] ?? '');
    if (!candidate || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    urls.push(candidate);
  }

  return urls;
}

export function moderateCommentText(input: string): CommentModerationFlag[] {
  const text = normalizeDisplayText(input);
  const lowered = text.toLowerCase();
  const flags = new Set<CommentModerationFlag>();

  if (!text || text.length < 4) {
    flags.add('insufficient-signal');
  }

  if (PROFANITY_PATTERNS.some((pattern) => pattern.test(text))) {
    flags.add('profanity');
  }

  if (SPAM_PATTERNS.some((pattern) => pattern.test(text))) {
    flags.add('spam');
  }

  if (SELF_PROMO_PATTERNS.some((pattern) => pattern.test(text))) {
    flags.add('self-promo');
  }

  const externalLinks = [...lowered.matchAll(/https?:\/\/[^\s]+/g)];
  const mapsLinks = extractMapsUrls(text);
  if (externalLinks.length >= 2 && mapsLinks.length === 0) {
    flags.add('spam');
  }

  return [...flags];
}

export function hasBlockingModerationFlags(flags: CommentModerationFlag[]): boolean {
  return flags.includes('spam') || flags.includes('profanity') || flags.includes('self-promo');
}

function normalizeCandidateName(value: string): string {
  return normalizeDisplayText(value)
    .replace(/^[@#\-•*\s]+/, '')
    .replace(/\b(?:at|in|near|around|the|a|an)\b\s+/i, '')
    .replace(/\s+(?:please|thanks|thank\s+you)$/i, '')
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isLikelyStallName(value: string): boolean {
  const normalized = normalizeCandidateName(value);
  if (!normalized || normalized.length < 2 || normalized.length > 80) {
    return false;
  }

  const tokens = normalizeComparableText(normalized).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return false;
  }

  const hasLetter = /[a-z]/i.test(normalized);
  if (!hasLetter) {
    return false;
  }

  if (tokens.every((token) => EXCLUDED_NAME_TOKENS.has(token))) {
    return false;
  }

  return true;
}

function sentenceSegments(text: string): string[] {
  return text
    .split(/[\n;,|]/)
    .map((segment) => normalizeDisplayText(segment))
    .filter((segment) => segment.length > 0);
}

function extractRuleBasedCandidates(commentText: string): string[] {
  const normalizedText = normalizeDisplayText(commentText);
  const candidates = new Set<string>();

  for (const segment of sentenceSegments(normalizedText)) {
    const directMatch = segment.match(
      /(?:try|recommend|suggest|must\s+try|go\s+to|check\s+out|should\s+visit)\s+(.+)/i
    );

    if (directMatch?.[1]) {
      const candidate = normalizeCandidateName(directMatch[1]);
      if (isLikelyStallName(candidate)) {
        candidates.add(candidate);
      }
    }

    const listParts = segment
      .split(/\band\b|\/+|\+/i)
      .map((part) => normalizeCandidateName(part));

    for (const listPart of listParts) {
      if (!isLikelyStallName(listPart)) {
        continue;
      }
      candidates.add(listPart);
    }
  }

  if (candidates.size === 0) {
    const fallbackCandidate = normalizeCandidateName(normalizedText);
    if (isLikelyStallName(fallbackCandidate)) {
      candidates.add(fallbackCandidate);
    }
  }

  return [...candidates];
}

function qualityScoreForName(name: string): number {
  const normalized = normalizeComparableText(name);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return 0;
  }

  let score = 4;
  if (tokens.length >= 2) score += 4;
  if (tokens.length >= 3) score += 2;

  const containsNumber = /\d/.test(name);
  if (containsNumber) score += 1;

  const hasBusinessSignal = /\b(mee|noodle|rice|bak|teh|kway|laksa|ramen|soup|satay|stall|house|shop)\b/i.test(name);
  if (hasBusinessSignal) score += 3;

  return Math.min(15, score);
}

function scoreSuggestion(
  comment: YouTubeCommentEntry,
  name: string,
  mapsUrls: string[],
  extractionMethod: 'rules' | 'llm' | 'mixed',
  moderationFlags: CommentModerationFlag[]
): number {
  let score = 20;
  score += Math.min(35, Math.max(0, comment.likeCount) * 4);
  if (comment.isTopLevel) score += 10;
  if (comment.isPinned) score += 15;
  if (mapsUrls.length > 0) score += 10;
  score += qualityScoreForName(name);

  if (extractionMethod === 'llm') score += 8;
  if (extractionMethod === 'mixed') score += 5;

  if (!comment.isTopLevel) score -= 3;

  if (moderationFlags.includes('insufficient-signal')) score -= 10;
  if (hasBlockingModerationFlags(moderationFlags)) score -= 45;

  return clampScore(score);
}

async function extractNamesWithLlm(env: WorkerEnv, commentText: string): Promise<Result<string[], Error>> {
  const apiKey = normalizeDisplayText(env.OPENAI_API_KEY ?? '');
  if (!apiKey) {
    return Result.ok([]);
  }

  const model = normalizeDisplayText(env.OPENAI_MODEL ?? 'gpt-4o-mini') || 'gpt-4o-mini';

  const responseResult = await Result.tryPromise(() =>
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'Extract food stall names from user text. Return strict JSON: {"stalls": string[]} with no explanation. Keep only plausible stall/place names.',
          },
          {
            role: 'user',
            content: commentText,
          },
        ],
      }),
    })
  );

  if (Result.isError(responseResult)) {
    return Result.err(new Error('Failed to call OpenAI for comment extraction.'));
  }

  if (!responseResult.value.ok) {
    return Result.err(new Error(`OpenAI extraction request failed with HTTP ${responseResult.value.status}.`));
  }

  const payloadResult = await Result.tryPromise(() => responseResult.value.json());
  if (Result.isError(payloadResult)) {
    return Result.err(new Error('Failed to parse OpenAI extraction response JSON.'));
  }

  const parsedResponse = llmResponseSchema.safeParse(payloadResult.value);
  if (!parsedResponse.success) {
    return Result.err(new Error('Invalid OpenAI extraction response shape.'));
  }

  const rawContent = parsedResponse.data.choices[0]?.message.content ?? '';
  if (!rawContent) {
    return Result.ok([]);
  }

  const llmJsonResult = Result.try(() => JSON.parse(rawContent));
  if (Result.isError(llmJsonResult)) {
    return Result.err(new Error('OpenAI extraction response was not valid JSON.'));
  }

  const parsedLlmJson = llmJsonPayloadSchema.safeParse(llmJsonResult.value);
  if (!parsedLlmJson.success) {
    return Result.err(new Error('OpenAI extraction JSON payload did not match schema.'));
  }

  const candidates = parsedLlmJson.data.stalls
    .map((name) => normalizeCandidateName(name))
    .filter((name) => isLikelyStallName(name));

  return Result.ok([...new Set(candidates)]);
}

export async function extractStallSuggestionsFromComment(
  env: WorkerEnv,
  comment: YouTubeCommentEntry,
  options: ExtractionOptions
): Promise<Result<ExtractedStallSuggestion[], Error>> {
  const normalizedText = normalizeDisplayText(comment.text);
  if (!normalizedText) {
    return Result.ok([]);
  }

  const moderationFlags = moderateCommentText(normalizedText);
  const mapsUrls = extractMapsUrls(normalizedText);

  const ruleCandidates = extractRuleBasedCandidates(normalizedText);
  let llmCandidates: string[] = [];

  if (options.llmEnabled) {
    const llmResult = await extractNamesWithLlm(env, normalizedText);
    if (!Result.isError(llmResult)) {
      llmCandidates = llmResult.value;
    }
  }

  const mergedCandidates = mergeCandidateNames(ruleCandidates, llmCandidates);
  const extractionMethod: 'rules' | 'llm' | 'mixed' =
    llmCandidates.length > 0 && ruleCandidates.length > 0
      ? 'mixed'
      : llmCandidates.length > 0
        ? 'llm'
        : 'rules';

  const suggestions: ExtractedStallSuggestion[] = [];
  for (const candidate of mergedCandidates) {
    const normalizedName = normalizeComparableText(candidate);
    if (!normalizedName) {
      continue;
    }

    const confidenceScore = scoreSuggestion(comment, candidate, mapsUrls, extractionMethod, moderationFlags);
    suggestions.push({
      normalizedName,
      displayName: candidate,
      confidenceScore,
      moderationFlags,
      mapsUrls,
      extractionMethod,
      extractionNotes: `likes=${comment.likeCount}; topLevel=${comment.isTopLevel ? 1 : 0}; pinned=${comment.isPinned ? 1 : 0}`,
    });
  }

  return Result.ok(suggestions);
}

function mergeCandidateNames(ruleCandidates: string[], llmCandidates: string[]): string[] {
  const byNormalized = new Map<string, string>();

  for (const candidate of [...ruleCandidates, ...llmCandidates]) {
    const normalized = normalizeComparableText(candidate);
    if (!normalized) {
      continue;
    }

    const existing = byNormalized.get(normalized);
    if (!existing || candidate.length > existing.length) {
      byNormalized.set(normalized, candidate);
    }
  }

  const finalCandidates = [...byNormalized.values()]
    .map((name) => normalizeDisplayText(name))
    .filter((name) => isLikelyStallName(name));

  const unique = new Set<string>();
  const result: string[] = [];

  for (const candidate of finalCandidates) {
    const identity = normalizeIdentityText(candidate);
    if (!identity || unique.has(identity)) {
      continue;
    }

    unique.add(identity);
    result.push(candidate);
  }

  return result;
}
