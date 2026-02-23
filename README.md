# SG Food Guide

A TanStack Start + React app for ranking and exploring Singapore hawker and street-food stalls, with filterable listings, detail pages, and transit/geocode APIs.

## Workspace Layout

This repository is a Bun + Turborepo monorepo:

- `apps/web`: TanStack Start web app (React routes + server API routes)
- `configs/*`: shared configuration packages (`tsconfig`, `oxlint`, `tailwind`)
- `libs/*`: shared libraries (`toolkit`, `ui`)

## Stack

- TanStack Start (React)
- TanStack Router + Query
- Tailwind CSS 4
- Cloudflare Workers (via `wrangler`)
- TypeScript
- Bun workspaces + Turborepo
- `zod` for parsing/validation
- `better-result` for fallible operation handling

## Core Routes

- `/`
- `/cuisine/:cuisine`
- `/stall/:slug`
- `/community/stalls` (approved community-source stalls from YouTube comments)
- `/admin/comment-drafts` (admin-only draft review queue via Cloudflare Access)
- `/api/geocode/search`
- `/api/transit/plan`
- `/api/sync/stalls`
- `/api/sync/comment-suggestions`

## Local Development

1. Install dependencies:

```bash
bun install
```

2. Start app dev server:

```bash
bun run dev
```

3. Open:

- `http://localhost:3000`

## Dev Tunnel (tmux + Cloudflared)

The project ships a `bun` tunnel script that manages a tmux session:

```bash
bun run dev:tunnel
```

Useful variants:

- `bun run dev:tunnel start`
- `bun run dev:tunnel stop`
- `bun run dev:tunnel status`
- `bun run dev:tunnel logs`

## Quality Gates

```bash
bun run check
bun run ci
```

## Data Source

Primary content source spreadsheet:

- https://docs.google.com/spreadsheets/d/1UMOZE2SM3_y5oUHafwJFEB9RrPDMqBbWjWnMGkO4gGg/edit?gid=1935025317

Source snapshots are tracked under:

- `apps/web/data/source/food-guide-sheet.csv`
- `apps/web/data/source/food-guide-sheet.meta.json`
- `apps/web/data/source/food-places.json`

## Deployment

Deploy the web app to Cloudflare Workers:

```bash
bun run deploy
```
