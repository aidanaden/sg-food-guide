# YouTube Data API Migration

## Summary

Migrate all channel-video ingestion from legacy YouTube XML feed/`yt-dlp` to YouTube Data API v3 so scheduled sync and manual backfill use a single supported API path.

## Context

- Current scheduled sync (`stall-sync.ts`) reads YouTube via XML feed parsing.
- Current backfill script (`backfill-missing-youtube-urls.ts`) shells out to `yt-dlp`.
- Target behavior is channel-ID driven ingestion via YouTube Data API in both paths.

## Requirements

- Use YouTube Data API as the source for channel uploads.
- Keep current matching/reconciliation behavior unchanged as much as possible.
- Preserve dry-run/apply semantics for sync and backfill.
- Continue using `zod` for parsing/validation and `better-result` for error handling.
- Keep source channel as configured channel ID, with runtime/env configurability.

## Questions Resolved

- Approval to proceed with YouTube Data API migration: yes.

## In Scope

- `apps/web/src/server/sync/youtube-source.ts`
- `apps/web/src/server/sync/stall-sync.ts` integration compatibility
- `apps/web/scripts/backfill-missing-youtube-urls.ts`
- Runtime/env contracts and docs updates

## Out of Scope

- Reworking stall matching heuristics beyond migration-driven adjustments.
- UI changes unrelated to data ingestion.

## Public Interfaces and Type Changes

- Add YouTube Data API key env support in worker/runtime.
- Remove/retire feed-url specific env usage from sync docs/contracts.
- Keep `YouTubeVideoEntry` shape stable for downstream sync logic.

## Implementation Steps

1. Add YouTube Data API client helpers and schemas in `youtube-source.ts`.
2. Replace feed fetch/parse calls in sync with API fetch results.
3. Replace `yt-dlp` collection in backfill script with API-driven map construction.
4. Update env/runtime typing and docs/wrangler vars.
5. Run checks and perform edge-case review of changed files.

## Test Strategy

- Run `bun run typecheck` and `bun run lint:check` in `apps/web`.
- Manual sanity path:
  - Scheduled sync dry-run still returns summary with `sourceStats.youtubeVideos`.
  - Backfill dry-run still computes assignments.

## Risk and Edge-Case Checklist

- Missing/invalid API key should degrade with explicit warning and no hard crash where possible.
- API pagination should include full uploads playlist, not only first page.
- Parse failures from partial API payloads should be safely filtered.
- Quota failures should be surfaced clearly.

## Approval Status

- Requested by agent on: 2026-02-23T00:00:00Z
- Approved by user: yes ("proceed")

## Beads Tracking

- Issue ID: sg-food-guide-gbp
- Current status: in_progress
- Last progress update: 2026-02-23T08:45:00Z
