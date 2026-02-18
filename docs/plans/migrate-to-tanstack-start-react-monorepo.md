# Migrate SG Food Guide to TanStack Start + React Monorepo

## Summary

Re-platform SG Food Guide from Astro to TanStack Start + React, while mirroring the Jupiter Admin monorepo stack and conventions as closely as practical. Preserve existing user-facing routes, data behavior, and API contracts during the migration.

## Context

- Current app is Astro (`apps/web`) with Cloudflare Pages Functions (`apps/web/functions/api/*`) and static route generation.
- Target reference is `/Users/aidan/jupiter/admin` (Bun + Turborepo monorepo with React + TanStack Router conventions, shared `configs/*` and `libs/*`, expanded `.agents` setup).
- User confirmed "all A" on migration decisions:
  - true TanStack Start runtime
  - full admin-style monorepo layout and stack parity
  - keep existing API behavior but move implementation to Start server functions
  - replace Astro immediately (no side-by-side runtime)
  - copy admin agent/config patterns as much as possible

## Requirements

- Replace Astro runtime and pages with TanStack Start + React.
- Adopt admin-style monorepo structure (`apps/*`, `libs/*`, `configs/*`) and tooling conventions.
- Move current API endpoints to TanStack Start server functions without contract breaks:
  - `GET /api/geocode/search`
  - `GET /api/transit/plan`
- Preserve primary frontend routes and behavior:
  - `/`
  - `/cuisine/:cuisine`
  - `/stall/:slug`
- Preserve existing env-var semantics for integrations (`ONEMAP_*`, `LTA_*`).
- Copy agent/config files from Jupiter Admin where compatible (with SG Food Guide-specific adjustments).
- Remove Astro-specific setup from active runtime path.
- Use `zod` for all parsing and validation (request/query/body/env/domain parsing).
- Use `better-result` for async/error-flow handling instead of ad-hoc `try/catch`.

## Questions Resolved

- Runtime target: TanStack Start (confirmed).
- Workspace scope: full admin-style monorepo adaptation (confirmed).
- API migration strategy: preserve behavior, migrate to Start server functions (confirmed).
- Astro transition: immediate replacement (confirmed via "all A").
- Agent/config strategy: copy admin patterns/files as much as possible (confirmed).

## In Scope

- Root workspace + scripts + turbo pipeline redesign to admin-like pattern.
- Introduce `configs/*` and `libs/*` packages modeled after admin patterns.
- Build TanStack Start app in `apps/web` (keeping path for deployment continuity) with React routes and route tree generation.
- Port SG food-guide UI screens and client behavior from Astro to React/TanStack routes.
- Port both API endpoints to Start server functions with same response payload shape.
- Migrate styles, fonts, icons, and shared UI primitives into React-compatible structure.
- Update deployment/dev docs and commands.
- Copy/merge agent files and skills layout where relevant.

## Out of Scope

- Net-new product features not present in existing SG Food Guide behavior.
- Major data model redesign of `stalls` content beyond compatibility adjustments.
- Adding a separate `apps/remote-api` service in this migration cut.

## Public Interfaces and Type Changes

- Preserve public route paths: `/`, `/cuisine/:cuisine`, `/stall/:slug`.
- Preserve API endpoint paths and response envelopes for geocode/transit.
- Keep Cloudflare deployment target and environment variable names.
- Internal changes:
  - Astro components/pages/types replaced by React components/routes/types.
  - Introduce TanStack Start server function handlers and app context.
  - Introduce shared libs/config packages (admin parity structure).
  - Standardize validation and parsing flows on `zod`.
  - Standardize error-handling flows on `better-result`.

## Implementation Steps

1. Scaffold admin-style workspace foundation
- Add `configs/tsconfig`, `configs/oxlint-config`, and supporting root config files aligned with admin conventions.
- Add `libs/toolkit` and `libs/ui` baselines (minimal initially, expandable during port).
- Update root `package.json`, workspace catalogs, and `turbo.json` to admin-like structure.

2. Bootstrap TanStack Start app in `apps/web`
- Replace Astro app runtime files with TanStack Start app entry, router, root route, and route generation script.
- Configure Vite plugins (TanStack router/start plugin, react plugin, tsconfig paths, tailwind plugin).
- Set up app tsconfig + route tree generation.

3. Port SG Food Guide frontend routes
- Rebuild index, cuisine, and stall pages as React routes with equivalent UI content and behaviors.
- Migrate shared UI components (`FilterBar`, `StallCard`, route planner, badges/buttons/selects/inputs/checks) from Astro to React.
- Port client-side preferences/filter/search logic.

4. Port API behavior to TanStack Start server functions
- Migrate geocode logic to Start server handler preserving response format and caching behavior.
- Migrate transit planning endpoint preserving query contract, fallback logic, and warnings.
- Ensure both endpoints are reachable at original URLs.
- Ensure all endpoint parsing/validation uses `zod` and all failure paths use `better-result` patterns.

5. Migrate styling, assets, and design tokens
- Move global CSS, font imports, and icon pipeline to React app.
- Preserve current visual baseline while adopting admin-style organization.

6. Copy admin agent/config ecosystem
- Import compatible `.agents` skills/content and top-level guidance patterns.
- Merge with SG Food Guide-specific AGENTS constraints (beads workflow and deployment specifics).

7. Remove Astro-specific runtime and stale scripts
- Remove Astro config, pages/functions wiring, and obsolete scripts once parity is validated.
- Update README and operational scripts to new workflow.

8. Validation and hardening
- Run install, typecheck, lint, tests, and build under new stack.
- Manual smoke for key routes + API endpoints.
- Address regressions and close parity gaps.
- Perform code review pass to reject any new ad-hoc `try/catch` and non-`zod` parsing paths.

## Implementation Status (2026-02-20)

- Completed: steps 1, 2, 3, 4, 5, 6.
- Partially completed: step 7 (Astro is removed from active runtime path; legacy Astro files remain in tree pending cleanup sweep).
- Completed for step 8:
  - `bun install`
  - `bun --filter @sg-food-guide/web routes:gen`
  - `bun --filter @sg-food-guide/web check`
  - `bun --filter @sg-food-guide/web build`
  - `bun run check`
  - `bun run build`
- Remaining for step 8:
  - explicit route/API manual smoke runbook execution
  - optional cleanup of residual legacy Astro files not referenced by TanStack Start runtime

## Test Strategy

- Automated checks:
  - workspace typecheck
  - lint check
  - route-tree generation integrity
  - unit tests for migrated API logic (at least happy/fallback/error paths)
  - production build
- Manual scenarios:
  - Load `/`, `/cuisine/:cuisine`, `/stall/:slug`
  - Search/filter/favorites/visited flows
  - Route planner interactions
  - `GET /api/geocode/search` valid + invalid queries
  - `GET /api/transit/plan` with and without credentials

## Risk and Edge-Case Checklist

- Route parity regressions due Astro->React rendering differences.
- Client hydration/SSR mismatches for dynamic UI state.
- API contract drift (status codes, field names, fallback semantics).
- Env var wiring differences in Start/Cloudflare runtime.
- Build/deploy pipeline breakage from folder and script changes.
- Large-scale file moves causing import resolution regressions.
- Agent/config copy conflicts with SG-specific instructions.

## Approval Status

- Requested by agent on: 2026-02-20 12:21:36Z
- Approved by user: yes (2026-02-20, user message: "proceed")

## Beads Tracking

- Issue ID: sg-food-guide-156
- Current status: in_progress
- Last progress update: 2026-02-20 12:46:00Z
