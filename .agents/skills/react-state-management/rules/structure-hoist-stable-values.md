---
title: Hoist Stable Values Outside Components
impact: HIGH
impactDescription: prevents silent referential instability that breaks memo, effects, and child re-renders
tags: state, constants, pure-functions, referential-equality, re-renders
---

## Hoist Stable Values Outside Components

Any value that does not depend on props, state, or hooks must be defined **outside** the component. Objects, arrays, functions, and config defined inside a component body are recreated every render, producing a new reference each time. This silently breaks `React.memo`, `useMemo` deps, `useEffect` deps, `useCallback` deps, and React Query options like `select`.

The oxlint `react-perf/jsx-no-new-*-as-prop` rules catch this in JSX props, but the same problem exists anywhere a value is consumed by reference.

### Incorrect (recreated every render)

```tsx
function TokenTable({ tokens }: Props) {
  // New reference every render — breaks any downstream memo/effect
  const columns = ["name", "price", "volume"];
  const defaultFilter = { active: true, limit: 50 };
  const formatPrice = (v: number) => `$${v.toFixed(2)}`;

  return (
    <Table
      columns={columns} // new array ref → Table re-renders
      filter={defaultFilter} // new object ref → Table re-renders
      format={formatPrice} // new function ref → Table re-renders
    />
  );
}
```

### Correct (hoisted outside component)

```tsx
const COLUMNS = ["name", "price", "volume"] as const;
const DEFAULT_FILTER = { active: true, limit: 50 } as const;
const formatPrice = (v: number) => `$${v.toFixed(2)}`;

function TokenTable({ tokens }: Props) {
  return <Table columns={COLUMNS} filter={DEFAULT_FILTER} format={formatPrice} />;
}
```

### What to hoist

| Value type                                   | Hoist?                 | Example                                                |
| -------------------------------------------- | ---------------------- | ------------------------------------------------------ |
| Static objects/arrays                        | Yes                    | `const OPTIONS = { limit: 10 } as const`               |
| Pure functions (no closure over props/state) | Yes                    | `const format = (v: number) => v.toFixed(2)`           |
| Regex patterns                               | Yes                    | `const EMAIL_RE = /^[^@]+@[^@]+$/`                     |
| React Query `select` functions               | Yes                    | `const selectCount = (data: Res) => data.items.length` |
| Default/fallback values                      | Yes                    | `const EMPTY_ARRAY: Token[] = []`                      |
| Derived from props/state                     | No — use `useMemo`     | `const filtered = useMemo(() => ..., [items, filter])` |
| Callbacks that close over state              | No — use `useCallback` | `const handleClick = useCallback(() => ..., [id])`     |

### Common pitfall: empty fallback arrays

```tsx
// Incorrect — new [] every render, triggers downstream effects/memo
function TokenList() {
  const { data } = useQuery(DatapiQueries.tokenList(args));
  const tokens = data?.tokens ?? [];
  //                              ^^ new ref every render when data is undefined
}

// Correct — stable fallback
const EMPTY_TOKENS: Token[] = [];

function TokenList() {
  const { data } = useQuery(DatapiQueries.tokenList(args));
  const tokens = data?.tokens ?? EMPTY_TOKENS;
}
```

### The test

Ask: "Does this value depend on props, state, or hooks?" If no, hoist it to module scope.
