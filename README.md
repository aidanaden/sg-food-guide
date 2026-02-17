# SG Food Guide

A production Astro site that curates and ranks hawker and street-food stalls from the SG Food Guide dataset, with filterable listings, stall detail pages, and route-planning utilities.

## Stack

- Astro 5
- Tailwind CSS 4
- Leaflet (route map UI)
- Cloudflare Pages + Pages Functions
- TypeScript
- Bun (scripts/package manager)

## Core Features

- Listing pages for all stalls and per-cuisine views
- Shared filter/sort/search system
- Favorites + visited state persisted in browser storage
- Stall detail pages with:
  - hits/misses
  - opening hours and pricing
  - Google Maps embed/link
  - YouTube review embed/search fallback
- Route planner with walking/driving/transit modes
- Server-backed transit API fallback logic (`/api/transit/plan`)
- Near-me radius filter with geolocation + manual geocode fallback (`/api/geocode/search`)

## Data Source

Primary content is sourced from the SG Food Guide spreadsheet:

- https://docs.google.com/spreadsheets/d/1UMOZE2SM3_y5oUHafwJFEB9RrPDMqBbWjWnMGkO4gGg/edit?gid=1935025317

Stall records live in:

- `src/data/stalls.ts`
- `src/data/cuisines/*.ts`

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
- `bun run build` - Production build to `dist/`
- `bun run preview` - Preview built output
- `bun run check` - Ratings validation + `astro check`
- `bun run ci` - `check` + `build`
- `bun run deploy` - Build and deploy static output via Wrangler Pages

## Deployment (Cloudflare Pages)

This repository is configured for Cloudflare deployment:

- `wrangler.jsonc` project name: `sg-food-guide`
- static assets directory: `./dist`

Deploy command:

```bash
bun run deploy
```

## Runtime Secrets (Transit Enhancements)

Transit enrichment in `/api/transit/plan` supports these optional secrets:

- `ONEMAP_EMAIL`
- `ONEMAP_PASSWORD`
- `LTA_ACCOUNT_KEY`

When absent or unavailable, route mode degrades gracefully to approximate in-app routing.
