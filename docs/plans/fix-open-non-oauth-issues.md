# Fix Open Non-OAuth Issues

## Summary

Complete all currently open Beads issues except YouTube OAuth (`sg-food-guide-gl5`).

## Context

Target issues:

- `sg-food-guide-5ik` manual mapping source for member-only YouTube references
- `sg-food-guide-cg5` Cloudflare Access allowlist ops setup
- `sg-food-guide-3du` missing worker env context in `/api/sync/stalls`
- `sg-food-guide-ati` test coverage for routes and API endpoints
- `sg-food-guide-0g7` TanStack/Cloudflare warning cleanup

## Requirements

- Ship fixes for all target issues above.
- Keep YouTube OAuth (`sg-food-guide-gl5`) out of scope.
- Preserve existing behavior unless issue explicitly requires change.

## Questions Resolved

- User requested: "fix all issues except youtube oauth".
- Approval for execution is explicit in user request.

## In Scope

- Runtime context parsing improvements for route handlers.
- Manual YouTube override source + sync integration + docs.
- Cloudflare Access allowlist config/docs.
- Warning fixes and test runner config hardening.
- Route/API automated tests.

## Out of Scope

- Owner OAuth/member-only API ingestion (`sg-food-guide-gl5`).

## Public Interfaces and Type Changes

- Worker env contract may gain additional optional parsing support and vars.
- Route modules may export testable loader helpers.
- No external API contract breaks intended.

## Implementation Steps

1. Fix context resolution path for sync API route handlers.
2. Implement manual override source for unresolved member-only YouTube mapping.
3. Add allowlist runtime var + onboarding docs for Cloudflare Access admin route.
4. Address recurring warning vectors (compat date freshness, start instance/runtime friction, test env).
5. Add automated tests for page loader logic and API endpoint behavior.
6. Run checks: lint, typecheck, test, build.
7. Iterate until no findings remain.

## Test Strategy

- Unit tests for route loader helper behavior: `/`, `/cuisine/:cuisine`, `/stall/:slug`.
- API tests for `/api/geocode/search` and `/api/transit/plan` success/validation/fallback paths.
- Full project checks with `bun --filter @sg-food-guide/web typecheck`, `lint:check`, `test`, `build`.

## Risk and Edge-Case Checklist

- Route handler context shape differences across TanStack handler types.
- Invalid/unused manual override entries.
- Cloudflare Access header/allowlist misconfiguration.
- Transit API missing credentials fallback behavior.
- Geocode short/invalid query validation and cache behavior.

## Approval Status

- Requested by agent on: 2026-02-23
- Approved by user: yes ("fix all issues except youtube oauth")

## Beads Tracking

- Issue ID: `sg-food-guide-5ik`, `sg-food-guide-cg5`, `sg-food-guide-3du`, `sg-food-guide-ati`, `sg-food-guide-0g7`
- Current status: `in_progress`
- Last progress update: 2026-02-23
