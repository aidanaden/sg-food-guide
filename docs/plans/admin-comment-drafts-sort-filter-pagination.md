# Admin Draft Comment Queue Sort/Filter/Table Upgrade

## Summary

Upgrade `/admin/comment-drafts` to a true table layout with high-performance server-side filtering, multi-column sorting, debounced global search, cursor pagination, infinite-load behavior, URL + local persistence, and responsive filter/sort controls in a `ResponsiveDialog`.

## Context

Current behavior is card-based, fetches up to 500 rows, and applies most filtering on the client. This does not scale and does not provide the control surface needed for moderation workflows.

## Requirements

- Server-side filtering, sorting, search, and pagination.
- Cursor-based pagination with load-more / infinite table behavior.
- Default sort: `topLikeCount DESC`.
- Sortable fields: all supported fields except `displayName`; max 3 sort columns.
- Sorting direction supported both ways for each sort column.
- Global filter logic mode: explicit `all` or `any`.
- Moderation-flag matching mode supports explicit `all` / `any` / `none`.
- Search across multiple fields, excluding JSON-backed text support.
- Instant updates (no Apply button), with 250ms debounce for search.
- Preserve state in URL and localStorage (URL precedence confirmed).
- ResponsiveDialog-based filter/sort controls, with compact summary trigger.
- True table layout on desktop and mobile.
- Display total result count.
- Add DB/index optimizations for performance.

## Questions Resolved

- Sortable field scope: remove `displayName` from sortable fields only.
- Filter logic granularity: global `all|any` only (Option A), not per-group logic trees.
- URL/localStorage precedence: URL first, then localStorage fallback.
- Table mode: convert page to true table layout.
- Presets: yes.
- Performance hardening: yes (schema/index recommendations accepted).

## In Scope

- `apps/web/src/routes/admin/comment-drafts.tsx`
- `apps/web/src/server/comment-suggestions/admin.functions.ts`
- `apps/web/src/server/comment-suggestions/repository.ts`
- Supporting types/contracts and any needed D1 index migration statements.

## Out of Scope

- Non-admin routes.
- Full boolean expression builder with nested groups.
- JSON-backed full-text search columns.
- Changes to Cloudflare Access auth flow (already handled separately).

## Public Interfaces and Type Changes

- Extend admin list server input contract for:
  - `cursor`, `limit`
  - `sort[]` (multi-column, max 3)
  - structured filter payload
  - `logicMode` (`all|any`)
  - search query
- Extend response contract for:
  - `nextCursor`
  - `totalCount` (on first page)

## Implementation Steps

1. Add/extend list input/output schemas in `admin.functions.ts`.
2. Implement repository query builder for server-side filters/search/sorts.
3. Implement cursor encoding/decoding and keyset pagination with stable tie-breakers.
4. Add index statements for common filter/sort paths.
5. Refactor admin draft page to table layout with infinite load behavior.
6. Add ResponsiveDialog filter/sort controls and compact trigger summary.
7. Add URL + localStorage state sync with URL precedence.
8. Wire instant updates, 250ms search debounce, clear/reset, and presets.
9. Ensure mutation actions (review/approve/reject) preserve current query state and refresh data.
10. Run targeted checks and a review pass, then iterate on findings.

## Test Strategy

- Typecheck/lint for affected workspace package.
- Manual scenarios:
  - Default load + default sort correctness.
  - Multi-sort (1-3 columns) asc/desc behavior.
  - Global logic mode `all` vs `any`.
  - Moderation flag mode `all/any/none`.
  - Search debounce and multi-field coverage.
  - Cursor pagination with load-more and stable ordering.
  - URL persistence and refresh/restoration behavior.
  - localStorage fallback when URL is empty.
  - Mutation actions with active filters/sorts.
  - Mobile dialog UX and desktop table UX.

## Risk and Edge-Case Checklist

- Cursor invalid/expired payloads.
- Duplicate sort keys and tie-break collisions.
- Null handling and deterministic ordering.
- Query explosion from broad `OR` conditions.
- Total-count correctness with filtered datasets.
- Race conditions from rapid filter/search changes.
- UX consistency when data becomes empty mid-session.

## Approval Status

- Requested by agent on: 2026-02-24 17:38:26 UTC
- Approved by user: yes (2026-02-24 17:41:00 UTC)

## Beads Tracking

- Issue ID: sg-food-guide-afr
- Current status: closed
- Last progress update: 2026-02-24 17:54:00 UTC
