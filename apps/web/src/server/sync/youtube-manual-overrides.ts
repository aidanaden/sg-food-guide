import { Result } from 'better-result';
import * as z from 'zod/mini';

import type { WorkerEnv } from '../cloudflare/runtime';
import {
  buildYouTubeVideoUrl,
  makeStallSourceKey,
  normalizeDisplayText,
  normalizeYouTubeVideoId,
} from './normalize';

const manualOverrideEntrySchema = z.object({
  sourceStallKey: z.optional(z.string()),
  name: z.optional(z.string()),
  cuisine: z.optional(z.string()),
  country: z.optional(z.string()),
  youtubeVideoUrl: z.string(),
  youtubeTitle: z.optional(z.string()),
});

const manualOverrideListSchema = z.array(manualOverrideEntrySchema);

// Manual fallback source for member-only mappings that are not resolvable from
// public channel metadata APIs. Keep this list intentionally small and curated.
const defaultManualOverrideEntries: Array<z.infer<typeof manualOverrideEntrySchema>> = [];

export interface ManualYouTubeOverride {
  sourceStallKey: string;
  youtubeVideoUrl: string;
  youtubeVideoId: string | null;
  youtubeTitle: string;
}

function deriveSourceStallKey(
  entry: z.infer<typeof manualOverrideEntrySchema>,
  sourceLabel: string
): Result<string, Error> {
  const explicitSourceKey = normalizeDisplayText(entry.sourceStallKey ?? '');
  if (explicitSourceKey) {
    return Result.ok(explicitSourceKey);
  }

  const name = normalizeDisplayText(entry.name ?? '');
  const cuisine = normalizeDisplayText(entry.cuisine ?? '');
  const country = normalizeDisplayText(entry.country ?? '');
  if (!name || !cuisine || !country) {
    return Result.err(
      new Error(
        `${sourceLabel}: every override entry must define "sourceStallKey", or all of "name", "cuisine", and "country".`
      )
    );
  }

  return Result.ok(makeStallSourceKey(name, country, cuisine));
}

function parseOverrideEntries(
  sourceLabel: string,
  input: unknown
): Result<ManualYouTubeOverride[], Error> {
  const parsedEntries = manualOverrideListSchema.safeParse(input);
  if (!parsedEntries.success) {
    return Result.err(new Error(`${sourceLabel}: invalid manual override payload shape.`));
  }

  const bySourceKey = new Map<string, ManualYouTubeOverride>();

  for (const entry of parsedEntries.data) {
    const sourceKeyResult = deriveSourceStallKey(entry, sourceLabel);
    if (Result.isError(sourceKeyResult)) {
      return Result.err(sourceKeyResult.error);
    }

    const canonicalVideoUrl = buildYouTubeVideoUrl(entry.youtubeVideoUrl);
    if (!canonicalVideoUrl) {
      return Result.err(new Error(`${sourceLabel}: invalid YouTube URL/value "${entry.youtubeVideoUrl}".`));
    }

    const override: ManualYouTubeOverride = {
      sourceStallKey: sourceKeyResult.value,
      youtubeVideoUrl: canonicalVideoUrl,
      youtubeVideoId: normalizeYouTubeVideoId(canonicalVideoUrl),
      youtubeTitle: normalizeDisplayText(entry.youtubeTitle ?? ''),
    };

    bySourceKey.set(override.sourceStallKey, override);
  }

  return Result.ok([...bySourceKey.values()]);
}

export function loadManualYouTubeOverrides(env: WorkerEnv): Result<ManualYouTubeOverride[], Error> {
  const envPayload = normalizeDisplayText(env.STALL_SYNC_MANUAL_YOUTUBE_OVERRIDES_JSON ?? '');
  if (!envPayload) {
    return parseOverrideEntries('default manual override list', defaultManualOverrideEntries);
  }

  const parsedEnvPayload = Result.try(() => JSON.parse(envPayload));
  if (Result.isError(parsedEnvPayload)) {
    return Result.err(new Error('Failed to parse STALL_SYNC_MANUAL_YOUTUBE_OVERRIDES_JSON as JSON.'));
  }

  return parseOverrideEntries('STALL_SYNC_MANUAL_YOUTUBE_OVERRIDES_JSON', parsedEnvPayload.value);
}
