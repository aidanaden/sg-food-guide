---
name: tanstack-start-best-practices
description: TanStack Start best practices for full-stack React applications. Server functions, middleware, SSR, authentication, and deployment patterns. Activate when building full-stack apps with TanStack Start.
---

# TanStack Start Best Practices

Comprehensive guidelines for implementing TanStack Start patterns in full-stack React applications. These rules cover server functions, middleware, SSR, authentication, and deployment.

## When to Apply

- Creating server functions for data mutations
- Setting up middleware for auth/logging
- Configuring SSR and hydration
- Implementing authentication flows
- Handling errors across client/server boundary
- Organizing full-stack code
- Deploying to various platforms

## Rule Categories by Priority

| Priority | Category | Rules | Impact |
|----------|----------|-------|--------|
| CRITICAL | Server Functions | 2 rules | Core data mutation patterns |
| HIGH | Middleware | 1 rule | Request/response handling |
| HIGH | Authentication | 2 rules | Secure user sessions |
| MEDIUM | API Routes | 1 rule | External endpoint patterns |
| MEDIUM | SSR | 3 rules | Server rendering patterns |
| MEDIUM | Error Handling | 1 rule | Graceful failure handling |
| MEDIUM | Environment | 1 rule | Configuration management |
| LOW | File Organization | 1 rule | Maintainable code structure |
| LOW | Deployment | 1 rule | Production readiness |

## Quick Reference

### Server Functions (Prefix: `sf-`)

- `sf-create-server-fn` — Use createServerFn for server-side logic
- `sf-input-validation` — Always validate server function inputs

### Middleware (Prefix: `mw-`)

- `mw-request-middleware` — Use request middleware for cross-cutting concerns

### Authentication (Prefix: `auth-`)

- `auth-session-management` — Implement secure session handling
- `auth-route-protection` — Protect routes with beforeLoad

### API Routes (Prefix: `api-`)

- `api-routes` — Create API routes for external consumers

### SSR (Prefix: `ssr-`)

- `ssr-hydration-safety` — Prevent hydration mismatches
- `ssr-streaming` — Implement streaming SSR for faster TTFB
- `ssr-prerender` — Configure static prerendering and ISR

### Environment (Prefix: `env-`)

- `env-functions` — Use environment functions for configuration

### Error Handling (Prefix: `err-`)

- `err-server-errors` — Handle server function errors

### File Organization (Prefix: `file-`)

- `file-separation` — Separate server and client code

### Deployment (Prefix: `deploy-`)

- `deploy-adapters` — Choose appropriate deployment adapter

## Integration Priority

When TanStack Router and TanStack Query are also present:

- Follow `tanstack-integration/rules/precedence-query-first.md` for cache ownership.
- Keep Query as the server-state cache authority (`ensureQueryData` in loaders, Query hooks in components).
- Use `defaultPreloadStaleTime: 0` so Router defers freshness to Query.

## How to Use

Each rule file in the `rules/` directory contains:
1. **Explanation** — Why this pattern matters
2. **Bad Example** — Anti-pattern to avoid
3. **Good Example** — Recommended implementation
4. **Context** — When to apply or skip this rule

## Full Reference

See individual rule files in `rules/` directory for detailed guidance and code examples.
