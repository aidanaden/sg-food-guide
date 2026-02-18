---
name: react-query-data-patterns
description: React Query patterns for admin-ui data fetching and mutations using the 2-layer API module pattern (`client.ts`, `types.ts`, `queries.ts`). Use when adding or refactoring query factories, query keys, `queryOptions`/`infiniteQueryOptions`, `skipToken`, cache invalidation, or mutation workflows.
---

Apply this for all server-state work in `apps/admin-ui`.

## Core Workflow

1. Create or update an API module by service (`api/<service>/`).
2. Keep HTTP calls and request/response types in `client.ts` and `types.ts`.
3. Expose query option factories from `queries.ts`.
4. Consume query factories via `useQuery(...)` in components.

## Required Patterns

- Query keys use service namespace first: `['service', 'resource', ...identifiers, params]`.
- Required identifiers are separate key items; optional filters are grouped in a trailing object.
- For cache operations (`invalidateQueries`, `setQueryData`), use `MyServiceQueries.<query>(args).queryKey` instead of hand-written string keys.
- `setQueryData` should rely on query-key inference; do not add explicit generics when using a factory `queryKey`.
- Prefer React Query `select` over `useMemo` for transformations derived from a single query.
- Use `skipToken` when required params are missing.
- Throw errors in query functions and let React Query handle them.
- Prefer `mutate` with callbacks for mutations; use `mutateAsync` only for sequencing.

## Reference Files

- `references/patterns-and-examples.md` for full module and mutation examples.
- `references/query-select-over-memo.md` for selector patterns and `select` caveats.
