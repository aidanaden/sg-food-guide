import { createFileRoute } from '@tanstack/react-router';
import * as z from 'zod/mini';

import { onRequestGet } from '../../../server/api/transit';

const transitEnvSchema = z.object({
  ONEMAP_EMAIL: z.optional(z.string()),
  ONEMAP_PASSWORD: z.optional(z.string()),
  LTA_ACCOUNT_KEY: z.optional(z.string()),
});

export const Route = createFileRoute('/api/transit/plan')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const parsedEnv = transitEnvSchema.safeParse({
          ONEMAP_EMAIL: process.env.ONEMAP_EMAIL,
          ONEMAP_PASSWORD: process.env.ONEMAP_PASSWORD,
          LTA_ACCOUNT_KEY: process.env.LTA_ACCOUNT_KEY,
        });

        if (!parsedEnv.success) {
          return new Response(
            JSON.stringify({
              error: 'Invalid transit environment configuration.',
            }),
            {
              status: 500,
              headers: {
                'content-type': 'application/json; charset=utf-8',
                'cache-control': 'no-store',
              },
            }
          );
        }

        return onRequestGet({
          request,
          env: parsedEnv.data,
        });
      },
    },
  },
});
