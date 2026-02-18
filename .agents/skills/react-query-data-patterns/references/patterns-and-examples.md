# React Query Patterns and Examples

Use this reference when implementing new API modules or refactoring existing ones in `apps/admin-ui/src/api`.

## Folder and Module Structure

- Create folders by backend service (`feedback/`, `launchpad/`, `user/`).
- Use subfolders for feature grouping when needed (`launchpad/forms/`, `launchpad/queries/`).
- Keep the same service namespace in query keys.

## Layer 1: Client and Types

In `client.ts` and `types.ts`:

- Use a static client object with `ky` methods.
- Accept typed request params and optional ky `Options`.
- Return typed promises.
- Use `serializeParams()` for GET params and `json` for POST/PUT/PATCH bodies.

```typescript
// api/myservice/types.ts
export type GetItemRequest = {
  includeArchived?: boolean;
};

export type GetItemResponse = {
  id: string;
  name: string;
};

// api/myservice/client.ts
import ky, { type Options } from 'ky';

const getClient = () => ky.extend({ prefixUrl: getApiUrl(), credentials: 'include' });

export const MyServiceClient = {
  getItem: (id: string, req: GetItemRequest, options?: Options): Promise<GetItemResponse> =>
    getClient()
      .get(`admin/item/${id}`, { searchParams: serializeParams(req), ...options })
      .json(),
};
```

## Layer 2: Query Options Factory

In `queries.ts`:

- Export query factories, not custom query hooks.
- Use `queryOptions()` or `infiniteQueryOptions()`.
- Keep query keys invalidation-friendly.
- Use `skipToken` when required params are missing.

For transformation guidance, see `references/query-select-over-memo.md`.

```typescript
// api/myservice/queries.ts
import { queryOptions, skipToken } from '@tanstack/react-query';

export const MyServiceQueries = {
  detail: (args: { id?: string; includeArchived?: boolean }) =>
    queryOptions({
      queryKey: ['myservice', 'detail', args.id, { includeArchived: args.includeArchived }],
      queryFn: !args.id ? skipToken : () => MyServiceClient.getItem(args.id, { includeArchived: args.includeArchived }),
    }),
};
```

## Invalidation Patterns

Do not hand-write query keys for cache operations.

```typescript
const detailQuery = MyServiceQueries.detail({ id, includeArchived });

queryClient.invalidateQueries({ queryKey: detailQuery.queryKey });
```

## setQueryData Pattern (No Explicit Generic)

Use the query factory `queryKey` so data type is inferred.

```typescript
const detailQuery = MyServiceQueries.detail({ id, includeArchived });

queryClient.setQueryData(detailQuery.queryKey, (previous) => {
  if (!previous) return previous;

  return {
    ...previous,
    name: nextName,
  };
});
```

## Mutation Pattern

Prefer `mutate` with callbacks.

```typescript
const mutation = useMutation({
  mutationFn: MyServiceClient.updateItem,
  onSuccess: () => {
    const detailQuery = MyServiceQueries.detail({ id, includeArchived });
    queryClient.invalidateQueries({ queryKey: detailQuery.queryKey });
    toast.success('Saved');
  },
  onError: () => {
    toast.error('Save failed');
  },
});

mutation.mutate({ id, payload });
```

Use `mutateAsync` only when sequencing operations is required.
