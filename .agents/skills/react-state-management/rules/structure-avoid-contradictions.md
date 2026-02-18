---
title: Avoid Contradictory State
impact: HIGH
impactDescription: prevents impossible states
tags: state, structure, discriminated-union, typescript
---

## Avoid Contradictory State

Structure state to make impossible states unrepresentable. Use a single discriminated union instead of multiple booleans that can contradict each other.

**Incorrect (contradictory booleans):**

```tsx
function DataFetcher() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Bug-prone: what if isLoading AND isError are both true?
  // Must remember to reset all flags on each state change
  const handleFetch = async () => {
    setIsLoading(true);
    setIsError(false); // Easy to forget
    setIsSuccess(false); // Easy to forget
    // ...
  };
}
```

**Correct (discriminated union):**

```tsx
type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

function DataFetcher() {
  const [state, setState] = useState<FetchState<Data>>({ status: "idle" });

  // Impossible to be loading AND error at same time
  const handleFetch = async () => {
    setState({ status: "loading" });
    try {
      const data = await fetchData();
      setState({ status: "success", data });
    } catch (error) {
      setState({ status: "error", error: error as Error });
    }
  };

  // TypeScript narrows the type based on status
  if (state.status === "success") {
    return <div>{state.data.name}</div>; // data is guaranteed to exist
  }
}
```

**React Query:** Prefer checking `status` over boolean flags like `isLoading`, `isError`, `isSuccess`. The `status` field is a discriminated union (`'pending' | 'error' | 'success'`) that avoids the same contradictory-state problem:

```tsx
// Incorrect — boolean flags can mislead
const { isLoading, isError, data, error } = useQuery(SomeQueries.items(args));

// Correct — single status field, narrowed by TypeScript
const { status, data, error } = useQuery(SomeQueries.items(args));

if (status === "pending") return <Spinner />;
if (status === "error") return <ErrorMessage error={error} />;
return <ItemList items={data} />; // data is guaranteed defined
```

**Benefits:** TypeScript enforces valid states, no forgotten flag resets, cleaner conditionals.
