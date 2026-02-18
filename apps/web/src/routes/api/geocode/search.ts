import { createFileRoute } from '@tanstack/react-router';

import { onRequestGet } from '../../../server/api/geocode';

export const Route = createFileRoute('/api/geocode/search')({
  server: {
    handlers: {
      GET: async ({ request }) => onRequestGet({ request }),
    },
  },
});
