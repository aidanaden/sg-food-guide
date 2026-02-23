# Parse YouTube Top Comments Into Draft Stall Suggestions

## Summary

Add a daily cron + manual trigger pipeline that parses top-liked comments (and replies) from `@Alderic` regular videos, extracts stall suggestions, stores them as draft suggestions, and exposes an admin-only internal review UI for approve/reject actions. Approved items create records in a separate stall source table (not mixed with sheet/channel-ingested `stalls`).

## Context

Current ingestion covers Google Sheet + YouTube channel metadata and misses crowd-sourced suggestions in comment threads. We need a quality-controlled, admin-approved discovery source from comments.

## Requirements

- Channel scope: `@Alderic` only.
- Video scope: regular videos only (no Shorts/live).
- Comments scope: top-level comments + all replies.
- Ranking: top 50 top-level comments per video by like count.
- Thresholds:
  - minimum likes for parsing: `2`
  - max videos per incremental run: `30`
  - high-confidence threshold: `>= 80`
- Extraction:
  - parse stall name (required)
  - allow LLM-assisted extraction
  - parse Google Maps links when present
  - no translation
  - split one comment with multiple stalls into multiple suggestions
- Deduplication key: normalized stall name (plus source comment identity for idempotent upsert).
- Existing-stall collision: attach suggestion as evidence instead of duplicating.
- Support aggregation: count unique supporting comments/videos for same normalized stall name.
- Moderation: strict spam/self-promo/profanity filtering.
- Retention:
  - raw comment text: 90 days
  - derived suggestion records: retained indefinitely
- Workflow: `new -> reviewed -> approved | rejected`.
- UI:
  - new internal route in current app
  - visible/actionable by admin only (owner)
  - access control enforced via Cloudflare Access
  - approved comment-source stalls must be visible in product UI via separate source filter/tab/section/route
- Notification: Telegram alerts only for high-confidence drafts.
- Execution:
  - daily cron
  - manual trigger supports dry-run and apply
  - partial-save on rate-limit/quota failure + exponential backoff
  - idempotent reruns (no duplicate draft records)
- Approved output:
  - create new stall records in a separate source table from existing canonical `stalls` ingestion
  - do not auto-stale when source comment changes/deletes
  - admin can edit parsed fields in review UI before approval
- Phasing:
  - start with public + currently accessible comments
  - extend member-only coverage once owner OAuth task is ready (`sg-food-guide-gl5`)
- Parsing/validation and error handling:
  - use `zod` for parsing/validation
  - use `better-result` for try/catch/error flow patterns

## Questions Resolved

- Objective is draft suggestions in internal approval UI (not auto-publish).
- Launch precision target is 85%.
- Country default when unknown is `SG`.
- Approver is admin only (user).
- Alternative-source separation is required from sheet/channel-based stalls.

## In Scope

- D1 schema additions for comment source records, draft suggestions, review state, and approved separated-source stalls.
- YouTube comment fetch + extraction + moderation + scoring + dedupe.
- Cron/manual trigger pipeline with dry-run/apply.
- Admin-only draft review UI route and APIs.
- Telegram high-confidence alerting.
- Backfill + incremental checkpointing.

## Out of Scope

- Non-`@Alderic` channels.
- Shorts/live parsing.
- Auto-publish directly into canonical `stalls`.
- Auto-staling approved suggestions on source comment edit/delete.
- Translation pipeline.

## Public Interfaces and Type Changes

- D1 migrations (proposed tables):
  - `youtube_comment_sources`
  - `stall_suggestion_drafts`
  - `stall_suggestion_reviews`
  - `comment_approved_stalls` (separate approved source table)
- Server handlers:
  - `POST /api/sync/youtube-comments` (dry-run/apply)
  - admin APIs for list/review actions under internal route namespace
- UI route:
  - new admin-only page in current app for draft queue
- Types:
  - strongly typed draft suggestion models, scoring models, moderation flags, review actions

## Implementation Steps

1. Add D1 migrations and TypeScript models for comment source + draft + review + approved-separated stalls.
2. Implement YouTube comment fetcher with pagination, top-level like sorting, and reply expansion.
3. Implement extraction pipeline (LLM + deterministic guards), normalization, and maps-link parsing.
4. Implement moderation/scoring/confidence + aggregation and idempotent upsert logic.
5. Add cron/manual trigger endpoint with dry-run/apply, checkpoints, and partial-save retry behavior.
6. Build admin-only internal route for reviewing drafts and approving/rejecting.
7. Implement approval flow to write into separate approved-source table (not canonical `stalls`).
8. Add Telegram alerting for high-confidence drafts only.
9. Add retention job/logic for raw comment text 90-day window.
10. Add observability counters/logging and run summaries.

## Test Strategy

- Unit tests:
  - normalization and dedupe keys
  - extraction parser for single/multi-stall comments
  - moderation filters
  - confidence scoring boundaries (including >=80 alert threshold)
- Integration tests:
  - dry-run vs apply behavior
  - idempotent re-run does not duplicate
  - partial-save + retry on simulated API failures
  - approval creates separated-source stall rows
- Manual scenarios:
  - admin review route access control
  - approve/reject state transitions
  - Telegram alert only for high-confidence items
  - backfill then incremental continuity

## Risk and Edge-Case Checklist

- API quota exhaustion and partial writes.
- Deleted/edited comments after ingestion.
- Duplicate names with different real stalls.
- LLM hallucination causing low-precision suggestions.
- Admin-only route enforcement mistakes.
- Cloudflare Access misconfiguration or bypass.
- Race conditions between cron and manual trigger.
- Retry loops creating duplicate evidence links.

## Approval Status

- Requested by agent on: 2026-02-23 20:44 UTC
- Approved by user: yes (2026-02-23 20:49 UTC)

## Beads Tracking

- Issue ID: `sg-food-guide-77m`
- Current status: `in_progress`
- Last progress update: 2026-02-23 21:12 UTC
