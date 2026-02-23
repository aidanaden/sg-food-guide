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
- `FOOD_GUIDE_SHEET_GID` (supports comma-separated gids to ingest multiple tabs in one run)
- `FOOD_GUIDE_SHEET_CSV_URL` (optional direct override; accepts Google Sheet edit URL and auto-converts to CSV export)
- `GOOGLE_PLACES_API_KEY` (optional; used to enrich missing opening hours via Google Places lookups and Google Maps URL/query fallback)
- `YOUTUBE_CHANNEL_ID` (recommended source, e.g. `UCH-dJYvV8UiemFsLZRO0X4A`)
- `YOUTUBE_DATA_API_KEY` (required for YouTube channel ingestion via YouTube Data API v3; set as a Wrangler secret)
- `STALL_SYNC_MODE` (`dry-run` or `apply`)
- `STALL_SYNC_MAX_CHANGE_RATIO` (0..1)
- `STALL_SYNC_ALERT_MODE` (`all` or `failed`)
- `STALL_SYNC_FORCE_APPLY` (`1`/`0`, optional)
- `STALL_SYNC_MANUAL_YOUTUBE_OVERRIDES_JSON` (optional JSON array of manual member-only YouTube overrides)
- `COMMENT_SYNC_MODE` (`dry-run` or `apply`)
- `COMMENT_SYNC_FORCE_APPLY` (`1`/`0`, optional)
- `COMMENT_SYNC_MAX_VIDEOS_PER_RUN` (default `30`)
- `COMMENT_SYNC_TOP_LEVEL_LIMIT` (default `50`)
- `COMMENT_SYNC_MIN_LIKES` (default `2`)
- `COMMENT_SYNC_HIGH_CONFIDENCE_THRESHOLD` (default `80`)
- `COMMENT_SYNC_LLM_ENABLED` (`1`/`0`, optional)
- `COMMENT_SYNC_LLM_MAX_COMMENTS_PER_RUN` (default `25`)
- `CLOUDFLARE_ACCESS_ADMIN_EMAILS` (required for `/admin/comment-drafts`, comma-separated emails)
- `AI` Wrangler binding (optional but recommended; enables free Workers AI extraction from comments)
- `WORKERS_AI_MODEL` (optional, default `@cf/meta/llama-3.1-8b-instruct-fast`)
- `OPENAI_API_KEY` (optional fallback if Workers AI binding is unavailable/fails)
- `OPENAI_MODEL` (optional, default `gpt-4o-mini`)
- `SYNC_ADMIN_TOKEN` (optional token for `/api/sync/stalls` and `/api/sync/comment-suggestions`)
- `TELEGRAM_BOT_TOKEN` (optional)
- `TELEGRAM_CHAT_ID` (optional)

### Manual YouTube Override Format

When member-only videos are not discoverable via public YouTube APIs, set `STALL_SYNC_MANUAL_YOUTUBE_OVERRIDES_JSON`:

```json
[
  {
    "sourceStallKey": "bari uma|sg|japanese",
    "youtubeVideoUrl": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
    "youtubeTitle": "Optional manual title"
  }
]
```

You can also provide `name`, `cuisine`, and `country` instead of `sourceStallKey`; the sync derives the stable key automatically.

### Cloudflare Access Admin Onboarding

1. Ensure Cloudflare Access policy for your app includes the admin identity.
2. Set `CLOUDFLARE_ACCESS_ADMIN_EMAILS` in Wrangler vars/secrets (comma-separated, lowercase recommended).
3. Verify access:
   - authorized identity can load `/admin/comment-drafts`
   - non-allowlisted identity receives admin access error

## Manual Trigger

With app dev server running:

```bash
bun --filter @sg-food-guide/web sync:stalls:api
```

Comment suggestion sync trigger:

```bash
curl -sS -X POST 'http://127.0.0.1:3000/api/sync/comment-suggestions?mode=dry-run'
```

To test scheduled handler locally:

```bash
bun --filter @sg-food-guide/web sync:stalls:scheduled:dev
# then open http://127.0.0.1:8787/__scheduled
```

## Notes

- Sync uses Google Sheet + YouTube Data API channel uploads and writes to D1.
- Comment suggestion sync parses top YouTube comments/replies into admin-review drafts.
- If sheet produces zero canonical stalls, sync falls back to static seed data.
- Missing source rows are soft-closed (`status = 'closed'`).
- All parsing uses zod schemas; thrown operations are wrapped with better-result.
