import { Result } from 'better-result';

import type { WorkerEnv, WorkerExecutionContextLike } from '../cloudflare/runtime';
import { runStallSync } from './stall-sync';

export interface ScheduledSyncArgs {
  env: WorkerEnv;
  executionCtx: WorkerExecutionContextLike;
  cron: string;
  scheduledTime: number;
}

export async function runScheduledStallSync(args: ScheduledSyncArgs): Promise<void> {
  const syncResult = await Result.tryPromise(() =>
    runStallSync({
      env: args.env,
      executionCtx: args.executionCtx,
      triggerSource: `scheduled:${args.cron}`,
    })
  );

  if (Result.isError(syncResult)) {
    console.error('Scheduled stall sync failed to run.', syncResult.error);
    return;
  }

  if (syncResult.value.status !== 'success') {
    console.error('Scheduled stall sync finished with non-success status.', syncResult.value);
  } else {
    console.log('Scheduled stall sync finished successfully.', syncResult.value);
  }
}
