# YouTube Subrequest Budget Fix

## Summary

Prevent Cloudflare subrequest exhaustion from breaking YouTube Data API ingestion during stall sync.

## Context

Prod sync currently triggers Google Maps enrichment before YouTube fetch. Maps performs many outbound requests and can exceed Worker subrequest limits, causing YouTube `channels.list` fetch to fail with `Too many subrequests`.

## Requirements

- Ensure YouTube fetch completes reliably in the sync pipeline.
- Keep existing sync output behavior unchanged except budget-related warnings.
- Avoid hard failures when Maps enrichment exceeds safe request volume.

## Questions Resolved

- User approval to proceed with fixes: yes ("proceed with fixes").

## In Scope

- `apps/web/src/server/sync/stall-sync.ts`
- `apps/web/src/server/sync/google-maps-hours.ts`

## Out of Scope

- Reworking matching heuristics or sheet parsing.
- Large telemetry redesign.

## Public Interfaces and Type Changes

- None.

## Implementation Steps

1. Move YouTube fetch ahead of Maps enrichment in sync pipeline.
2. Add per-run Maps lookup cap and process lookups sequentially.
3. Emit explicit warning when lookups are skipped by budget cap.
4. Run typecheck/lint.
5. Deploy and verify prod dry-run no longer reports YouTube fetch failure.

## Test Strategy

- `bun run typecheck`
- `bun run lint:check`
- Prod dry-run via `/api/sync/stalls?mode=dry-run`

## Risk and Edge-Case Checklist

- Confirm YouTube warning is removed and `youtubeVideos` > 0.
- Confirm Maps warnings remain non-fatal.
- Ensure lookup cap warning is clear.

## Approval Status

- Requested by agent on: 2026-02-24
- Approved by user: yes

## Beads Tracking

- Issue ID: sg-food-guide-oh3
- Current status: in_progress
- Last progress update: 2026-02-24
