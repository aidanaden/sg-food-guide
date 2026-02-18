# Use React Query select over useMemo

When data is derived from a single query result, prefer query-level `select` over component-level `useMemo`.

## Why

- The query returns the exact shape the component needs.
- React Query structurally shares selected results and avoids unnecessary re-renders.
- You avoid dependency-array churn for common query transformations.

## Prefer This

```tsx
function selectVisibleCount(data: ListResponse): number {
  return data.items.filter((item) => item.visible).length;
}

function VisibleCount() {
  const { data: count } = useQuery({
    ...MyServiceQueries.list({ page: 1 }),
    select: selectVisibleCount,
  });

  return <span>{count ?? 0}</span>;
}
```

## Avoid This for Single-Query Transforms

```tsx
function VisibleCount() {
  const { data } = useQuery(MyServiceQueries.list({ page: 1 }));
  const count = useMemo(() => data?.items.filter((item) => item.visible).length ?? 0, [data]);

  return <span>{count}</span>;
}
```

## Selector Stability

- Best: pure selector function declared outside the component.
- Use `useCallback` only if selector depends on component props/state.
- Inline selector is acceptable for trivial leaf usage.

## Caveats

- Do not throw inside `select`; throw from `queryFn`.
- `select` transforms subscribed output only; cache still stores the full response.

## When useMemo is Still Fine

- Combining multiple query results.
- Expensive computation on non-query data.
- Transformations requiring non-query state that are not practical in `select`.
