import type { Register } from '@tanstack/react-start';
import {
  createStartHandler,
  defaultStreamHandler,
  type RequestHandler,
} from '@tanstack/react-start/server';
import { Result } from 'better-result';
import * as z from 'zod/mini';

import type { WorkerEnv, WorkerRequestContext } from './src/server/cloudflare/runtime';
import {
  type CommentSuggestionSyncMode,
  runCommentSuggestionSync,
} from './src/server/sync/comment-suggestion-sync';
import { type StallSyncMode, runStallSync } from './src/server/sync/stall-sync';
import { runScheduledCommentSuggestionSync } from './src/server/sync/scheduled-comment-sync';
import { runScheduledStallSync } from './src/server/sync/scheduled-sync';

interface ScheduledEventLike {
  cron: string;
  scheduledTime: number;
}

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};

declare module '@tanstack/react-start' {
  interface Register {
    server: {
      requestContext: WorkerRequestContext;
    };
  }
}

const startFetch = createStartHandler(defaultStreamHandler);

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

async function maybeHandleSyncApiRequest(request: Request, env: WorkerEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/sync/stalls' && url.pathname !== '/api/sync/comment-suggestions') {
    return null;
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const bodyResult =
    request.method === 'POST' ? await Result.tryPromise(() => request.json()) : Result.ok<unknown>({});
  const body = Result.isError(bodyResult) ? {} : bodyResult.value;

  const payload = syncRequestSchema.safeParse({
    mode: url.searchParams.get('mode') ?? (body as Record<string, unknown>)['mode'],
    force: url.searchParams.get('force') ?? (body as Record<string, unknown>)['force'],
    token: url.searchParams.get('token') ?? (body as Record<string, unknown>)['token'],
  });

  if (!payload.success) {
    return json({ error: 'Invalid sync payload.' }, 400);
  }

  const requiredToken = env.SYNC_ADMIN_TOKEN?.trim();
  if (requiredToken) {
    const providedToken = request.headers.get('x-sync-token')?.trim() ?? payload.data.token?.trim() ?? '';
    if (!providedToken || providedToken !== requiredToken) {
      return json({ error: 'Unauthorized sync trigger.' }, 401);
    }
  }

  const isStallSync = url.pathname === '/api/sync/stalls';
  const summary = isStallSync
    ? await runStallSync({
      env,
      triggerSource: request.method === 'POST' ? 'api:manual' : 'api:get',
      modeOverride: payload.data.mode as StallSyncMode | undefined,
      forceApply: parseBool(payload.data.force),
    })
    : await runCommentSuggestionSync({
      env,
      triggerSource: request.method === 'POST' ? 'api:manual:comment-suggestions' : 'api:get:comment-suggestions',
      modeOverride: payload.data.mode as CommentSuggestionSyncMode | undefined,
      forceApply: parseBool(payload.data.force),
    });

  const statusCode = summary.status === 'failed' ? 500 : 200;
  return json(summary, statusCode);
}

const fetchHandler = (
  request: Request,
  env: WorkerEnv,
  executionCtx: ExecutionContextLike
): Promise<Response> => {
  const syncResponseResult = maybeHandleSyncApiRequest(request, env);
  return Promise.resolve(syncResponseResult).then((syncResponse) => {
    if (syncResponse) {
      return syncResponse;
    }

    const context: WorkerRequestContext = {
      cloudflare: {
        env,
        executionCtx,
        request,
      },
    };

    return Promise.resolve((startFetch as RequestHandler<Register>)(request, { context }));
  });
};

const scheduledHandler = (
  event: ScheduledEventLike,
  env: WorkerEnv,
  executionCtx: ExecutionContextLike
): void => {
  executionCtx.waitUntil((async () => {
    await runScheduledStallSync({
      env,
      executionCtx,
      cron: event.cron,
      scheduledTime: event.scheduledTime,
    });

    await runScheduledCommentSuggestionSync({
      env,
      executionCtx,
      cron: event.cron,
      scheduledTime: event.scheduledTime,
    });
  })());
};

export default {
  fetch: fetchHandler,
  scheduled: scheduledHandler,
};
