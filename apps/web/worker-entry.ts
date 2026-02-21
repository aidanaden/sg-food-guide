import type { Register } from '@tanstack/react-start';
import {
  createStartHandler,
  defaultStreamHandler,
  type RequestHandler,
} from '@tanstack/react-start/server';

import type { WorkerEnv, WorkerRequestContext } from './src/server/cloudflare/runtime';
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

const fetchHandler = (
  request: Request,
  env: WorkerEnv,
  executionCtx: ExecutionContextLike
): Promise<Response> => {
  const context: WorkerRequestContext = {
    cloudflare: {
      env,
      executionCtx,
      request,
    },
  };

  return Promise.resolve((startFetch as RequestHandler<Register>)(request, { context }));
};

const scheduledHandler = (
  event: ScheduledEventLike,
  env: WorkerEnv,
  executionCtx: ExecutionContextLike
): void => {
  executionCtx.waitUntil(
    runScheduledStallSync({
      env,
      executionCtx,
      cron: event.cron,
      scheduledTime: event.scheduledTime,
    })
  );
};

export default {
  fetch: fetchHandler,
  scheduled: scheduledHandler,
};
