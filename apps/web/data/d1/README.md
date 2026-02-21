# D1 Stall Sync

## Migration

Run the initial schema migration:

```bash
bun --filter @sg-food-guide/web d1:migrate:local
```

For remote D1:

```bash
bun --filter @sg-food-guide/web d1:migrate:remote
```

## Required Wrangler Config

`apps/web/wrangler.jsonc` now expects a D1 binding named `STALLS_DB`.
Replace the placeholder `database_id` with the real D1 database id before deploy.

## Runtime Vars

Set via `wrangler.jsonc` vars and/or secrets:

- `FOOD_GUIDE_SHEET_ID`
- `FOOD_GUIDE_SHEET_GID`
- `FOOD_GUIDE_SHEET_CSV_URL` (optional direct override; accepts Google Sheet edit URL and auto-converts to CSV export)
- `YOUTUBE_CHANNEL_ID` (recommended source, e.g. `UCH-dJYvV8UiemFsLZRO0X4A`)
- `YOUTUBE_CHANNEL_FEED_URL` (optional direct override, e.g. `https://www.youtube.com/feeds/videos.xml?channel_id=...`)
- `STALL_SYNC_MODE` (`dry-run` or `apply`)
- `STALL_SYNC_MAX_CHANGE_RATIO` (0..1)
- `STALL_SYNC_ALERT_MODE` (`all` or `failed`)
- `STALL_SYNC_FORCE_APPLY` (`1`/`0`, optional)
- `SYNC_ADMIN_TOKEN` (optional token for `/api/sync/stalls`)
- `TELEGRAM_BOT_TOKEN` (optional)
- `TELEGRAM_CHAT_ID` (optional)

## Manual Trigger

With app dev server running:

```bash
bun --filter @sg-food-guide/web sync:stalls:api
```

To test scheduled handler locally:

```bash
bun --filter @sg-food-guide/web sync:stalls:scheduled:dev
# then open http://127.0.0.1:8787/__scheduled
```

## Notes

- Sync uses Google Sheet + YouTube channel feed data and writes to D1.
- If sheet produces zero canonical stalls, sync falls back to static seed data.
- Missing source rows are soft-closed (`status = 'closed'`).
- All parsing uses zod schemas; thrown operations are wrapped with better-result.
