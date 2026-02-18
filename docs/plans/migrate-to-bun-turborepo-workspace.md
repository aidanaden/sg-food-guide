# Migrate Repo To Bun Turborepo Workspace

## Summary

Restructure the current single-package Astro + Bun repository into a Turborepo workspace managed by Bun while preserving existing behaviors for local development, checks, data scripts, and Cloudflare Pages deployment.

## Context

Current state:
- One root package with Astro app sources in `src/`, static assets in `public/`, Pages Functions in `functions/`, and scripts in `scripts/`.
- CI/deploy workflows invoke root-level `bun run` scripts.
- Existing dirty working copy includes unrelated edits that must be preserved.

Target state:
- Monorepo workspace with Turbo orchestration and app code moved into `apps/web`.
- Root scripts preserved as primary entry points (`bun run dev`, `bun run build`, etc.) via Turbo delegation.

## Requirements

- Use Bun workspaces and Turborepo.
- Preserve current functional behavior of:
  - Astro dev/build/preview/check flows
  - data validation and source tracking scripts
  - Cloudflare Pages deployment and sheet-tracking GitHub workflow
- Keep migration compatible with current repository without reverting unrelated local changes.

## Questions Resolved

- Request type: feature (repository architecture migration).
- Preferred package manager/runtime: Bun.
- VCS preference: use `jj` over `git` where possible.

## In Scope

- Add workspace + Turbo root configuration.
- Move web app files/config to `apps/web`.
- Update package scripts (root + app) for Turbo orchestration.
- Update workflow/config/docs paths for new structure.
- Run targeted quality gates to validate migration.

## Out of Scope

- Feature changes to site UI/data behavior.
- Refactoring business logic unrelated to workspace migration.
- Introducing additional packages/apps beyond what is needed for migration.

## Public Interfaces and Type Changes

- Public CLI interface stays stable at repo root:
  - `bun run dev`
  - `bun run build`
  - `bun run check`
  - `bun run ci`
  - `bun run deploy`
  - `bun run track:sheet`
  - `bun run populate:youtube-ids`
- Internal file paths change to workspace layout.

## Implementation Steps

1. Create root workspace scaffolding:
   - `package.json` workspaces + Turbo scripts
   - `turbo.json`
2. Create `apps/web/package.json` and move app files:
   - `src/`, `public/`, `scripts/`, `functions/`, Astro/Tailwind/TS configs
3. Update script path assumptions and references:
   - Ensure scripts run from `apps/web` and still write/read expected files
4. Update deployment/workflows:
   - `wrangler` config/script commands
   - GitHub Actions commands/paths
5. Update docs:
   - `README.md` commands and path references
6. Validate:
   - install lockfile consistency
   - run `bun run check` and `bun run build` at root

## Test Strategy

- Run `bun install` for workspace dependency graph.
- Run `bun run check` from repo root.
- Run `bun run build` from repo root.
- Optionally run `bun run track:sheet` in dry/local mode if needed for path validation.

## Risk and Edge-Case Checklist

- Script path regressions due to changed cwd.
- Cloudflare Pages function discovery path mismatch.
- Workflow path breakage (`data/source` moved under app).
- Root command compatibility regressions for contributors/CI.

## Approval Status

- Requested by agent on: 2026-02-18T03:06:15Z
- Approved by user: yes (2026-02-18)

## Beads Tracking

- Issue ID: sg-food-guide-6mw
- Current status: in_progress
- Last progress update: 2026-02-18T03:13:34Z
