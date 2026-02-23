import { createFileRoute } from '@tanstack/react-router';
import { Result } from 'better-result';
import * as z from 'zod/mini';

import { getWorkerEnvFromServerContext } from '../../../server/cloudflare/runtime';
import { type StallSyncMode, runStallSync } from '../../../server/sync/stall-sync';

const syncRequestSchema = z.object({
  mode: z.optional(z.union([z.literal('dry-run'), z.literal('apply')])),
  force: z.optional(z.union([z.string(), z.number()])),
  token: z.optional(z.string()),
});

function parseBool(input: string | number | undefined): boolean {
  if (typeof input === 'number') {
    return input !== 0;
  }

  if (typeof input !== 'string') {
    return false;
  }

  const normalized = input.trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function resolveWorkerEnv(primaryContext: unknown, fallbackContext: unknown) {
  const primaryResult = getWorkerEnvFromServerContext(primaryContext);
  if (!Result.isError(primaryResult)) {
    return primaryResult;
  }

  return getWorkerEnvFromServerContext(fallbackContext);
}

export const Route = createFileRoute('/api/sync/stalls')({
  server: {
    handlers: {
      POST: async (handlerContext) => {
        const { request, context } = handlerContext;
        const envResult = resolveWorkerEnv(context, handlerContext);
        if (Result.isError(envResult)) {
          return json({ error: 'Missing worker environment context.' }, 500);
        }

        const url = new URL(request.url);
        const bodyResult = await Result.tryPromise(() => request.json());
        const body = Result.isError(bodyResult) ? {} : bodyResult.value;

        const payload = syncRequestSchema.safeParse({
          mode: url.searchParams.get('mode') ?? (body as Record<string, unknown>)['mode'],
          force: url.searchParams.get('force') ?? (body as Record<string, unknown>)['force'],
          token: url.searchParams.get('token') ?? (body as Record<string, unknown>)['token'],
        });

        if (!payload.success) {
          return json({ error: 'Invalid sync request payload.' }, 400);
        }

        const requiredToken = envResult.value.SYNC_ADMIN_TOKEN?.trim();
        if (requiredToken) {
          const providedToken =
            request.headers.get('x-sync-token')?.trim() ?? payload.data.token?.trim() ?? '';

          if (!providedToken || providedToken !== requiredToken) {
            return json({ error: 'Unauthorized sync trigger.' }, 401);
          }
        }

        const mode = payload.data.mode as StallSyncMode | undefined;

        const summary = await runStallSync({
          env: envResult.value,
          triggerSource: 'api:manual',
          modeOverride: mode,
          forceApply: parseBool(payload.data.force),
        });

        const statusCode = summary.status === 'failed' ? 500 : 200;
        return json(summary, statusCode);
      },
      GET: async (handlerContext) => {
        const { request, context } = handlerContext;
        const url = new URL(request.url);
        const payload = syncRequestSchema.safeParse({
          mode: url.searchParams.get('mode') ?? undefined,
          force: url.searchParams.get('force') ?? undefined,
          token: url.searchParams.get('token') ?? undefined,
        });

        if (!payload.success) {
          return json({ error: 'Invalid sync query payload.' }, 400);
        }

        const envResult = resolveWorkerEnv(context, handlerContext);
        if (Result.isError(envResult)) {
          return json({ error: 'Missing worker environment context.' }, 500);
        }

        const requiredToken = envResult.value.SYNC_ADMIN_TOKEN?.trim();
        if (requiredToken) {
          const providedToken =
            request.headers.get('x-sync-token')?.trim() ?? payload.data.token?.trim() ?? '';
          if (!providedToken || providedToken !== requiredToken) {
            return json({ error: 'Unauthorized sync trigger.' }, 401);
          }
        }

        const summary = await runStallSync({
          env: envResult.value,
          triggerSource: 'api:get',
          modeOverride: payload.data.mode as StallSyncMode | undefined,
          forceApply: parseBool(payload.data.force),
        });

        const statusCode = summary.status === 'failed' ? 500 : 200;
        return json(summary, statusCode);
      },
    },
  },
});
