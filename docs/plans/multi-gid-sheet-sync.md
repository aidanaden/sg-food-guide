# Multi-GID Sheet Sync Fix

## Summary

Fix prod stall sync ingesting only one Google Sheet tab by supporting multiple `gid` values in source fetch and configuring the full tab list.

## Context

- Prod dry-run/apply showed `sheetRows=15`, `canonicalStalls=15`, `changeRatio=1`.
- Current config points to `gid=1935025317`, which is only one tab (`Prawn Mee`).
- Spreadsheet contains multiple cuisine tabs with separate gids.

## Requirements

- Ingest all relevant sheet tabs in one sync run.
- Keep existing parser behavior and row schema unchanged.
- Preserve backward compatibility for single-gid config.
- Redeploy prod and verify dry-run/apply outcomes.

## Questions Resolved

- User approved proceeding with investigation and fix: yes ("yes please").

## In Scope

- `apps/web/src/server/sync/sheet-source.ts`
- `apps/web/wrangler.jsonc`
- Prod redeploy + sync trigger verification

## Out of Scope

- Redesigning sheet schema.
- Major reconciliation logic changes unrelated to source row volume.

## Public Interfaces and Type Changes

- `FOOD_GUIDE_SHEET_GID` will support comma-separated gid values.
- `fetchSheetCsv` output remains `{ sourceUrl, csv }` to avoid wider API changes.

## Implementation Steps

1. Add gid list parsing helper (`comma-separated -> string[]`) with de-dup.
2. Fetch CSV for each gid and concatenate with newline boundaries.
3. Keep first-header parsing; skip duplicate header rows in parser loop.
4. Update wrangler `FOOD_GUIDE_SHEET_GID` var to full gid list.
5. Deploy prod and run dry-run + apply sync checks.

## Test Strategy

- `bun run typecheck` in `apps/web`.
- Manual prod validation via `/api/sync/stalls?mode=dry-run` and `mode=apply`.

## Risk and Edge-Case Checklist

- Duplicate headers between concatenated CSV sections.
- Empty/invalid gids in config.
- Google fetch partial failure for one gid.
- Existing single-gid deployments remain functional.

## Approval Status

- Requested by agent on: 2026-02-23T17:57:30Z
- Approved by user: yes ("yes please")

## Beads Tracking

- Issue ID: sg-food-guide-xv2
- Current status: in_progress
- Last progress update: 2026-02-23T17:57:30Z
