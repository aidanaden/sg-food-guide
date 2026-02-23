# Comment Sync Subrequest Budget Fix

## Summary

Prevent Cloudflare Worker subrequest exhaustion in comment suggestion sync so runs complete without repeated `Too many subrequests` warnings.

## Context

Current comment sync can exceed Worker subrequest limits while fetching YouTube comments/replies across many videos in one run. This causes most videos to fail and leaves the admin draft queue under-populated.

## Requirements

- Avoid per-run subrequest exhaustion in comment suggestion sync.
- Keep comment draft ingestion functional and deterministic.
- Preserve existing admin workflows and storage schema.
- Make budget-sensitive behavior explicit and configurable.

## Questions Resolved

- Scope: fix the warning by reducing request fan-out in comment sync; no UI change required.
- Deployment target: production Worker after validation.

## In Scope

- `apps/web/src/server/sync/comment-suggestion-sync.ts`
- `apps/web/src/server/sync/youtube-comments-source.ts`
- `apps/web/src/server/cloudflare/runtime.ts`
- `apps/web/wrangler.jsonc`
- `apps/web/data/d1/README.md`

## Out of Scope

- Rewriting extraction heuristics or moderation logic.
- Reworking YouTube source discovery/state model.

## Public Interfaces and Type Changes

- Add optional Worker env settings for comment fetch fan-out controls.
- No API route signature changes.

## Implementation Steps

1. Add configurable comment-fetch controls in runtime env typing/parsing.
2. Update comment sync to pass conservative defaults (1 comment-thread page, replies off by default).
3. Update YouTube comment fetcher to honor these controls.
4. Set explicit production vars in `wrangler.jsonc` for the new controls.
5. Update runtime docs.
6. Run targeted checks (`typecheck`, lint if feasible).
7. Deploy and verify `/api/sync/comment-suggestions?mode=apply` no longer emits `Too many subrequests` for normal runs.

## Test Strategy

- `bun run typecheck`
- `bun run lint:check` (if timing permits)
- Manual production verification via one API-triggered run and D1 inspection.

## Risk and Edge-Case Checklist

- Ensure reduced fan-out still yields non-zero draft candidates.
- Ensure replies can be re-enabled via env when needed.
- Ensure no runtime parsing errors for new env vars.
- Verify status/warnings remain informative.

## Approval Status

- Requested by agent on: 2026-02-24
- Approved by user: yes (via direct fix request)

## Beads Tracking

- Issue ID: sg-food-guide-foy
- Current status: in_progress
- Last progress update: 2026-02-24

## Current Blocker

- Production deploy blocked by Cloudflare auth/account mismatch in current shell token context.
