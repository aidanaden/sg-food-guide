import '@fontsource-variable/dm-sans';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/jetbrains-mono';

import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router';
import appCss from '../styles.css?url';
import dmSansLatinWghtNormal from '@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2?url';
import bricolageGrotesqueLatinWghtNormal from '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?url';

export const Route = createRootRouteWithContext<Record<string, never>>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        name: 'description',
        content:
          "The definitive guide to Singapore's best hawker food - 170+ stalls ranked, mapped, and reviewed across 10 cuisines.",
      },
      { property: 'og:site_name', content: 'SG Food Guide' },
      { property: 'og:locale', content: 'en_SG' },
      { name: 'theme-color', content: '#1a1410' },
      { title: 'SG Food Guide' },
    ],
    links: [
      {
        rel: 'preload',
        href: dmSansLatinWghtNormal,
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'preload',
        href: bricolageGrotesqueLatinWghtNormal,
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark bg-background text-foreground antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen font-sans">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
