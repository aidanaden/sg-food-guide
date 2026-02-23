import { Result } from 'better-result';

import type { WorkerEnv, WorkerExecutionContextLike } from '../cloudflare/runtime';
import { runCommentSuggestionSync } from './comment-suggestion-sync';

export interface ScheduledCommentSyncArgs {
  env: WorkerEnv;
  executionCtx: WorkerExecutionContextLike;
  cron: string;
  scheduledTime: number;
}

export async function runScheduledCommentSuggestionSync(args: ScheduledCommentSyncArgs): Promise<void> {
  const syncResult = await Result.tryPromise(() =>
    runCommentSuggestionSync({
      env: args.env,
      executionCtx: args.executionCtx,
      triggerSource: `scheduled:${args.cron}:comment-suggestions`,
    })
  );

  if (Result.isError(syncResult)) {
    console.error('Scheduled comment suggestion sync failed to run.', syncResult.error);
    return;
  }

  if (syncResult.value.status !== 'success') {
    console.error('Scheduled comment suggestion sync finished with non-success status.', syncResult.value);
  } else {
    console.log('Scheduled comment suggestion sync finished successfully.', syncResult.value);
  }
}
