---
name: tanstack-router-best-practices
description: TanStack Router best practices for type-safe routing, data loading, search params, and navigation. Activate when building React applications with complex routing needs.
---

# TanStack Router Best Practices

Comprehensive guidelines for implementing TanStack Router patterns in React applications. These rules optimize type safety, data loading, navigation, and code organization.

## When to Apply

- Setting up application routing
- Creating new routes and layouts
- Implementing search parameter handling
- Configuring data loaders
- Setting up code splitting
- Integrating with TanStack Query
- Refactoring navigation patterns

## Rule Categories by Priority

| Priority | Category | Rules | Impact |
|----------|----------|-------|--------|
| CRITICAL | Type Safety | 2 rules | Prevents runtime errors and enables refactoring |
| CRITICAL | Route Organization | 1 rule | Ensures maintainable route structure |
| HIGH | Router Config | 1 rule | Global router defaults |
| HIGH | Data Loading | 3 rules | Optimizes data fetching and caching |
| HIGH | Search Params | 2 rules | Enables type-safe URL state |
| HIGH | Error Handling | 1 rule | Handles 404 and errors gracefully |
| MEDIUM | Navigation | 2 rules | Improves UX and accessibility |
| MEDIUM | Code Splitting | 1 rule | Reduces bundle size |
| MEDIUM | Preloading | 1 rule | Improves perceived performance |
| LOW | Route Context | 1 rule | Enables dependency injection |

## Quick Reference

### Type Safety (Prefix: `ts-`)

- `ts-register-router` — Register router type for global inference
- `ts-use-from-param` — Use `from` parameter for type narrowing

### Router Config (Prefix: `router-`)

- `router-default-options` — Configure router defaults (scrollRestoration, defaultErrorComponent, etc.)

### Route Organization (Prefix: `org-`)

- `org-virtual-routes` — Understand virtual file routes

### Data Loading (Prefix: `load-`)

- `load-use-loaders` — Use route loaders for data fetching
- `load-ensure-query-data` — Use ensureQueryData with TanStack Query
- `load-parallel` — Leverage parallel route loading

When TanStack Query is also in use, follow `tanstack-integration/rules/precedence-query-first.md` so Query remains the single server-state cache authority.

### Search Params (Prefix: `search-`)

- `search-validation` — Always validate search params
- `search-custom-serializer` — Configure custom search param serializers

### Error Handling (Prefix: `err-`)

- `err-not-found` — Handle not-found routes properly

### Navigation (Prefix: `nav-`)

- `nav-link-component` — Prefer Link component for navigation
- `nav-route-masks` — Use route masks for modal URLs

### Code Splitting (Prefix: `split-`)

- `split-lazy-routes` — Use .lazy.tsx for code splitting

### Preloading (Prefix: `preload-`)

- `preload-intent` — Enable intent-based preloading

### Route Context (Prefix: `ctx-`)

- `ctx-root-context` — Define context at root route

## How to Use

Each rule file in the `rules/` directory contains:
1. **Explanation** — Why this pattern matters
2. **Bad Example** — Anti-pattern to avoid
3. **Good Example** — Recommended implementation
4. **Context** — When to apply or skip this rule

## Full Reference

See individual rule files in `rules/` directory for detailed guidance and code examples.
