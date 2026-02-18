# SG Food Guide

A production Astro site that curates and ranks hawker and street-food stalls from the SG Food Guide dataset, with filterable listings, stall detail pages, and route-planning utilities.

## Workspace Layout

This repository is a Bun + Turborepo workspace:

- Root: workspace orchestration (`turbo.json`, shared scripts, CI entrypoint)
- App: `apps/web` (Astro app, Pages Functions, scripts, data)

Root-level commands (`bun run dev`, `bun run build`, etc.) remain the primary interface and delegate to `apps/web` via Turbo.

## Stack

- Astro 5
- Tailwind CSS 4
- Leaflet (route map UI)
- Cloudflare Pages + Pages Functions
- TypeScript
- Bun workspaces + Turborepo

## Core Features

- Listing pages for all stalls and per-cuisine views
- Shared filter/sort/search system
- Adventure research page for horse riding and dirt biking by city/country (`/adventure`)
- Favorites + visited state persisted in browser storage
- Stall detail pages with:
  - hits/misses
  - opening hours and pricing
  - Google Maps embed/link
  - YouTube review embed/search fallback
- Route planner with walking/driving/transit modes
- Server-backed transit API fallback logic (`/api/transit/plan`)
- Near-me radius filter with geolocation + manual geocode fallback (`/api/geocode/search`)
- Activity research API for horse riding and dirt biking (`/api/adventure/search`)

## Data Source

Primary content is sourced from the SG Food Guide spreadsheet:

- https://docs.google.com/spreadsheets/d/1UMOZE2SM3_y5oUHafwJFEB9RrPDMqBbWjWnMGkO4gGg/edit?gid=1935025317

Stall records live in:

- `apps/web/src/data/stalls.ts`
- `apps/web/src/data/cuisines/*.ts`

Automated source snapshots are tracked in:

- `apps/web/data/source/food-guide-sheet.csv`
- `apps/web/data/source/food-guide-sheet.meta.json`
- `apps/web/data/source/food-places.json`

## Local Development

1. Install dependencies:

```bash
bun install
```

2. Start dev server:

```bash
bun run dev
```

3. Open:

- `http://localhost:4321`

## Quality Gates

Run data + Astro static checks:

```bash
bun run check
```

Run full local CI gate:

```bash
bun run ci
```

## Scripts

- `bun run dev` - Start Astro dev server
- `bun run build` - Production build to `apps/web/dist/`
- `bun run preview` - Preview built output
- `bun run check` - Ratings validation + `astro check`
- `bun run ci` - `check` + `build`
- `bun run track:sheet` - Fetch and snapshot the latest Google Sheet source
- `bun run populate:youtube-ids` - Fill missing `youtubeVideoId` fields from episode mappings
- `bun run deploy` - Build and deploy static output via Wrangler Pages

## Source Tracking Cron

A scheduled workflow keeps the sheet snapshot in sync:

- Workflow: `.github/workflows/track-food-guide-sheet.yml`
- Schedule: every 6 hours
- Trigger: `workflow_dispatch` (manual run) is also enabled
- Behavior: runs `bun run track:sheet`, then commits and pushes changes under `apps/web/data/source/` when sheet content changes

Optional repository variables for a different tab/source:

- `FOOD_GUIDE_SHEET_ID`
- `FOOD_GUIDE_SHEET_GID`

## Deployment (Cloudflare Pages)

This repository is configured for Cloudflare Pages deployment:

- Worker config: `apps/web/wrangler.jsonc`
- Pages build output directory: `./dist` (inside `apps/web`)

One-time project setup (skip if the Pages project already exists):

```bash
bunx wrangler pages project create sg-food-guide --production-branch=main
```

Deploy command:

```bash
bun run deploy
```

Automated deploys are configured in `.github/workflows/deploy.yml` (pushes to `main`).
Set these repository secrets in GitHub:

- `CLOUDFLARE_API_TOKEN` (token with Cloudflare Pages edit access)
- `CLOUDFLARE_ACCOUNT_ID` (the Cloudflare account ID that owns `sg-food-guide`)

## Runtime Secrets (Transit Enhancements)

Transit enrichment in `/api/transit/plan` supports these optional secrets:

- `ONEMAP_EMAIL`
- `ONEMAP_PASSWORD`
- `LTA_ACCOUNT_KEY`

When absent or unavailable, route mode degrades gracefully to approximate in-app routing.
