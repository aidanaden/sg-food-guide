import '@tanstack/react-start';
import { createRouter as createTanStackRouter } from '@tanstack/react-router';

import TanStackQueryProvider, { createRouterContext } from './integrations/tanstack-query/root-provider';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  const context = createRouterContext();
  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    Wrap: ({ children }) => (
      <TanStackQueryProvider queryClient={context.queryClient}>{children}</TanStackQueryProvider>
    ),
  });

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
