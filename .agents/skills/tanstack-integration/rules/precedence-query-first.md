# precedence-query-first: Apply Query-First Ownership Across Router and Start

## Priority: CRITICAL

## Explanation

When TanStack Query, TanStack Router, and TanStack Start are used together, avoid overlapping responsibilities:

- TanStack Query owns server-state caching, freshness, invalidation, and mutation sync.
- TanStack Router owns navigation, route matching, params/search validation, and loader timing.
- TanStack Start owns server execution boundaries (server functions, API routes, middleware).

If two tools can manage the same server-state cache, Query should be authoritative.

## Bad Example

```tsx
// router.tsx
const router = createRouter({
  routeTree,
  context: { queryClient },
  // Router preload cache remains active
  // defaultPreloadStaleTime: 30000
})

// routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loader: async () => {
    // Router-managed loader data cache
    const posts = await fetchPosts()
    return { posts }
  },
  component: PostsPage,
})

function PostsPage() {
  // Same data queried again with TanStack Query
  const { data } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  })

  // Two caches can diverge and invalidate differently
  return <PostList posts={data ?? []} />
}
```

## Good Example

```tsx
// router.tsx
export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  })

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0, // Router asks Query for freshness
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

// routes/posts.tsx
export const Route = createFileRoute('/posts')({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(postQueries.list())
  },
  component: PostsPage,
})

function PostsPage() {
  const { data: posts } = useSuspenseQuery(postQueries.list())
  return <PostList posts={posts} />
}
```

## Good Example: Mutations Follow Query Keys

```tsx
const createPost = useMutation({
  mutationFn: PostApiClient.create,
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: postQueries.list().queryKey,
    })
  },
})
```

## Context

- Loaders should warm Query cache, not duplicate server-state ownership.
- Route-level data from loaders should be metadata (for example: breadcrumbs, feature flags, auth redirects) when possible.
- Use `defaultPreloadStaleTime: 0` when Query is present.
- Treat Query keys as the canonical invalidation API.
- TanStack Start server functions remain the server boundary; Query functions call those boundaries.
