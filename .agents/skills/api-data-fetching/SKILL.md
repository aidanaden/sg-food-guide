---
name: api-data-fetching
description: Compatibility alias for API/query guidance. Use `react-query-data-patterns` as the canonical skill for new work.
---

This skill is kept for backward compatibility with prompts that still reference `api-data-fetching`.

For all current guidance, use `react-query-data-patterns`:

- Core workflow and module boundaries (`client.ts`, `types.ts`, `queries.ts`)
- Query key patterns and cache invalidation conventions
- `skipToken` and query factory usage
- `select` over `useMemo` for single-query transforms
- Mutation callback patterns (`mutate` preferred)

Primary reference:

`../react-query-data-patterns/SKILL.md`
