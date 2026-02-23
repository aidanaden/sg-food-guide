# D1 Scheduled Stall Sync

## Summary

Add a Cloudflare scheduled/manual sync pipeline that ingests stall data from a source Google Sheet and YouTube channel, writes to D1 (with dry-run default), sends Telegram alerts, and cuts app reads over from hardcoded TS data to D1 seeded from existing data.

## Context

- Current app reads stalls from static files in `apps/web/src/data`.
- Existing script `apps/web/scripts/track-food-guide-sheet.ts` tracks source snapshots, but there is no runtime DB sync pipeline.
- Deployment target is Cloudflare Workers via Wrangler; cron will run in production only.

## Requirements

- Use D1 as the primary stall database.
- Use Cloudflare Scheduled Worker trigger (daily, default `0 0 * * *` UTC) and allow manual trigger via Wrangler scheduled simulation.
- Prod-only cron execution.
- Source ingestion combines Google Sheet + YouTube channel feed.
- Source ingestion combines Google Sheet + YouTube channel uploads via YouTube Data API.
- Identity key: normalized `name + country + cuisine`.
- Multiple addresses per stall are supported in DB; UI displays primary address only.
- Source precedence: non-empty beats empty; if both non-empty, richer value wins.
- Cron is allowed to overwrite all synced fields (no manual-only fields).
- Missing source rows are soft-closed (closed status), not hard deleted.
- Partial upsert allowed; required active fields include `name`, `address`, `cuisine`, `country`, and valid YouTube URL.
- Price handling: raw source preserved and canonical SGD parsed when present (no live FX conversion dependency).
- Ratings preserve decimal values.
- YouTube source: channel uploads from `UCH-dJYvV8UiemFsLZRO0X4A` via YouTube Data API, with matching by episode and title fallback.
- Geocoding provider path: OneMap/Nominatim fallback now, with request to add Google key ASAP.
- Max-change safety guard enabled (default 50% threshold) and alert on trigger.
- Telegram alerts enabled for all runs.
- Dry-run first; apply mode is explicit opt-in.
- Seed D1 from currently hardcoded data and cut app routes to read D1.

## Questions Resolved

- D1 cutover is in scope now.
- Source sheet is read-only (cannot add columns).
- Slugs remain stable once created; use existing slug when available from seeded D1 rows.
- Closed stalls should still be retained (status marked), with listing behavior adjusted in query layer.
- Manual cron trigger should be supported via Wrangler scheduled endpoint tooling.

## In Scope

- D1 schema + migration SQL for stalls, stall locations, sync runs, and sync events/diffs.
- Seed script from existing hardcoded `stalls` data.
- Worker cron handler (`scheduled`) and manual trigger path for local/test execution.
- Google Sheet fetch/parse + YouTube API fetch/match pipeline with `zod` validation and `better-result` error handling.
- Sync engine with dry-run/apply modes, safety guard, soft-close behavior, and upsert semantics.
- Telegram notifier integration.
- Route loaders/data access updates for `/`, `/cuisine/:cuisine`, `/stall/:slug` to read from D1.
- Env + Wrangler config for D1 binding, cron trigger, and required vars.

## Out of Scope

- Editing source Google Sheet schema.
- Full UI redesign for multi-location detail display (primary address only for now).
- Real-time/streaming sync frequency beyond daily cron.

## Public Interfaces and Type Changes

- Add D1-backed server data access modules/types for stall read/query paths.
- Introduce sync domain models (`SyncRun`, `SyncDiff`, `StallRecord`, `StallLocationRecord`).
- Add Worker env vars:
  - `FOOD_GUIDE_SHEET_ID`
  - `FOOD_GUIDE_SHEET_GID`
  - `YOUTUBE_CHANNEL_USERNAME`
  - `YOUTUBE_DATA_API_KEY`
  - `SYNC_MODE` (`dry-run` | `apply`)
  - `SYNC_MAX_CHANGE_RATIO`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_CHAT_ID`

## Implementation Steps

1. Create D1 schema/migrations for stalls, locations, sync_runs, sync_events.
2. Add typed D1 query layer (`apps/web/src/server/db/*`) with validation and result wrappers.
3. Add seed script that imports current hardcoded stalls into D1.
4. Add source clients/parsers:
   - Google Sheet CSV ingest/parsing
   - YouTube Data API fetch + matching resolver
5. Add sync reconciliation engine (identity, precedence, upsert, close, guardrails).
6. Add scheduled handler + manual trigger path and structured run logging.
7. Add Telegram notification utility for all run outcomes.
8. Wire Wrangler config for D1 + cron + vars and generate worker types.
9. Cut app loader data access from static arrays to D1 read queries.
10. Run validation checks, document required secrets, and verify dry-run behavior.

## Test Strategy

- Unit-level validation for:
  - source parsing and normalization
  - identity and matching logic
  - precedence/merge rules
  - max-change guard logic
- Integration-style sync test against local D1 in dry-run mode.
- Route-level smoke checks for `/`, `/cuisine/:cuisine`, `/stall/:slug` reading D1.
- Manual scheduled trigger verification (`wrangler dev --test-scheduled`).

## Risk and Edge-Case Checklist

- Sheet schema drift or missing columns.
- YouTube API quota/auth failures.
- Multiple stalls sharing names across markets/cuisines.
- Conflicting URLs/title matches between sources.
- Large source deletions causing unintended closures (guard threshold).
- Partial row quality causing invalid writes.
- Seed + live sync slug stability for existing links.
- D1 query performance under filter/sort routes.

## Approval Status

- Requested by agent on: 2026-02-21T17:30:12Z
- Approved by user: yes (2026-02-21T17:34:00Z)

## Beads Tracking

- Issue ID: sg-food-guide-ymx
- Current status: in_progress
- Last progress update: 2026-02-22T01:55:00Z
