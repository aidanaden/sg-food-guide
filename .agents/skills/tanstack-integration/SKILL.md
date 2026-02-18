---
name: tanstack-integration-best-practices
description: Best practices for integrating TanStack Query with TanStack Router and TanStack Start. Patterns for full-stack data flow, SSR, and caching coordination.
---

# TanStack Integration Best Practices

Guidelines for integrating TanStack Query, Router, and Start together effectively. These patterns ensure optimal data flow, caching coordination, and type safety across the stack.

## When to Apply

- Setting up a new TanStack Start project
- Integrating TanStack Query with TanStack Router
- Configuring SSR with query hydration
- Coordinating caching between router and query
- Setting up type-safe data fetching patterns

## Rule Categories by Priority

| Priority | Category | Rules | Impact |
|----------|----------|-------|--------|
| CRITICAL | Precedence | 1 rule | Resolves Query/Router/Start ownership conflicts |
| CRITICAL | Setup | 1 rule | Foundational configuration |
| CRITICAL | SSR Integration | 1 rule | Router + Query SSR setup |
| HIGH | Data Flow | 1 rule | Correct data fetching patterns |
| MEDIUM | Caching | 1 rule | Performance optimization |

## Quick Reference

### Precedence (Prefix: `precedence-`)

- `precedence-query-first` — Query owns server-state cache; Router orchestrates loading

### Setup (Prefix: `setup-`)

- `setup-query-client-context` — Pass QueryClient through router context

### Data Flow (Prefix: `flow-`)

- `flow-loader-query-pattern` — Use loaders with ensureQueryData

### Caching (Prefix: `cache-`)

- `cache-single-source` — Let TanStack Query manage caching

### SSR Integration (Prefix: `ssr-`)

- `ssr-dehydrate-hydrate` — Use setupRouterSsrQueryIntegration for automatic SSR

## How to Use

Each rule file in the `rules/` directory contains:
1. **Explanation** — Why this pattern matters
2. **Bad Example** — Anti-pattern to avoid
3. **Good Example** — Recommended implementation
4. **Context** — When to apply or skip this rule

## Full Reference

See individual rule files in `rules/` directory for detailed guidance and code examples.
