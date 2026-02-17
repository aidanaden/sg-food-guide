# Complete Open Beads Issues (Backlog Sweep)

## Summary
Implement and close all currently open Beads issues in this repository, covering UI behavior, filter persistence, location filtering, data completeness, documentation, and deployment pipeline setup.

## Context
Open issues at start:
- sg-food-guide-zah
- sg-food-guide-59h
- sg-food-guide-1w0
- sg-food-guide-6oc
- sg-food-guide-oyo
- sg-food-guide-q1c
- sg-food-guide-kcc

## Requirements
- Complete each open issue according to its issue description.
- Preserve existing behavior unless issue explicitly changes it.
- Run project quality gates after code/data changes.
- Update Beads issue statuses/comments throughout execution.

## Questions Resolved
- User intent confirmed by request: "work on all incomplete plans within sg-food-guide project" and follow-up "continue".
- Execution approval inferred as explicit from the same request and follow-up.

## In Scope
- UI/logic updates for `sg-food-guide-kcc`, `sg-food-guide-oyo`, `sg-food-guide-zah`.
- README replacement for `sg-food-guide-q1c`.
- Data updates for `sg-food-guide-59h` and `sg-food-guide-6oc`.
- Remote/deploy pipeline checks for `sg-food-guide-1w0`.

## Out of Scope
- New features outside the currently open issue set.
- Major data model/schema redesign.

## Public Interfaces and Type Changes
- `FilterBar` and `filter-sort` client APIs will expand to include location filter controls/state.
- New geocoding API endpoint under `functions/api/geocode/search.ts`.
- Query-string persistence for listing filters may add/consume URL params.

## Implementation Steps
1. Claim first UI batch issues (`kcc`, `oyo`, `zah`) as in-progress.
2. Implement un-visit toggle on detail page and preferences sync.
3. Implement filter state persistence across listing navigation.
4. Implement near-me + manual geocode fallback location filtering.
5. Run review pass on touched files and fix issues.
6. Update README.
7. Populate missing YouTube IDs and missing content fields (`hits`, `misses`, `openingTimes`).
8. Validate remote/deploy pipeline status and implement missing setup where possible.
9. Run quality gates and finalize Beads statuses/comments.

## Test Strategy
- `bun run check`
- `bun run build`
- Manual browser checks:
  - detail-page favorite + visited toggles
  - filter persistence between `/` and `/cuisine/*`
  - near-me geolocation and manual geocode fallback
  - clear filters/reset behavior

## Risk and Edge-Case Checklist
- Geolocation denied/unavailable fallback path works.
- URL param persistence does not break existing filtering defaults.
- Cards with missing coordinates are excluded only when location filter is active.
- Detail-page visited state does not regress favorites behavior.
- Data updates preserve rating and stall integrity.

## Approval Status
- Requested by agent on: 2026-02-18
- Approved by user: yes (2026-02-18)

## Beads Tracking
- Issue IDs: sg-food-guide-zah, sg-food-guide-59h, sg-food-guide-1w0, sg-food-guide-6oc, sg-food-guide-oyo, sg-food-guide-q1c, sg-food-guide-kcc
- Current status: mixed (open -> in_progress -> done during execution)
- Last progress update: 2026-02-18
