# YouTube API Fetch Failure Investigation

## Summary

Surface the exact YouTube Data API error from sync warnings, redeploy, run prod dry-run, and identify root cause.

## Context

Current sync warning is generic and hides underlying Google API failure reason.

## Requirements

- Keep sync behavior unchanged except diagnostics.
- Do not expose secrets in warning output.
- Validate on prod via manual dry-run trigger.

## Questions Resolved

- User approval to proceed: yes ("proceed").

## In Scope

- `apps/web/src/server/sync/stall-sync.ts`
- Prod deployment + manual dry-run verification

## Out of Scope

- Permanent telemetry redesign
- Non-YouTube sync behavior changes

## Public Interfaces and Type Changes

- None

## Implementation Steps

1. Add sanitized YouTube error detail to sync warning path.
2. Run typecheck/lint.
3. Deploy worker to prod.
4. Trigger manual dry-run and inspect warning message.
5. Document root cause in Beads.

## Test Strategy

- `bun run typecheck`
- `bun run lint:check`
- Manual API trigger in prod: `/api/sync/stalls?mode=dry-run`

## Risk and Edge-Case Checklist

- Ensure warning text does not include API key.
- Preserve existing dry-run/apply flow.

## Approval Status

- Requested by agent on: 2026-02-24
- Approved by user: yes

## Beads Tracking

- Issue ID: sg-food-guide-r8x
- Current status: in_progress
- Last progress update: 2026-02-24
