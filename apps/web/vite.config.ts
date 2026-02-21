import { resolve as resolvePath } from 'node:path';
import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

const webNodeModules = resolvePath(import.meta.dirname, 'node_modules');
const devtoolsEventBusPort = Number(process.env.TANSTACK_DEVTOOLS_EVENT_BUS_PORT ?? '0');
const devtoolsEventBusEnabled = process.env.TANSTACK_DEVTOOLS_EVENT_BUS === '1';

export default defineConfig({
  plugins: [
    devtools({
      eventBusConfig: {
        // Default to disabled to avoid hard crashes when :42069 is already in use.
        enabled: devtoolsEventBusEnabled,
        port: Number.isFinite(devtoolsEventBusPort) ? devtoolsEventBusPort : 0,
      },
    }),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: resolvePath(webNodeModules, 'react'),
      'react-dom': resolvePath(webNodeModules, 'react-dom'),
      'react/jsx-runtime': resolvePath(webNodeModules, 'react/jsx-runtime.js'),
      'react/jsx-dev-runtime': resolvePath(webNodeModules, 'react/jsx-dev-runtime.js'),
    },
  },
  server: {
    port: 3000,
  },
});
