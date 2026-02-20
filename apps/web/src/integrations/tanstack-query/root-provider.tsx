import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export type RouterContext = {
  queryClient: QueryClient;
};

export function createRouterContext(): RouterContext {
  return {
    queryClient: new QueryClient(),
  };
}

export default function TanStackQueryProvider({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
