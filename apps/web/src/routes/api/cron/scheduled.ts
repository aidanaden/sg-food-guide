import { createFileRoute } from "@tanstack/react-router";
import { Result } from "better-result";

import { getWorkerEnvFromServerContext, getExecutionContextFromServerContext } from "../../../server/cloudflare/runtime";
import { runStallSync } from "../../../server/sync/stall-sync";
import { runExternalReviewSync } from "../../../server/sync/external-review-sync";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/cron/scheduled")({
  server: {
    handlers: {
      GET: async (handlerContext) => {
        const { context } = handlerContext;
        
        const envResult = getWorkerEnvFromServerContext(context);
        if (Result.isError(envResult)) {
          return json({ error: "Missing worker environment context." }, 500);
        }

        const execCtxResult = getExecutionContextFromServerContext(context);
        const execCtx = Result.isError(execCtxResult) ? null : execCtxResult.value;

        // Run stall sync
        const stallSyncPromise = runStallSync({
          env: envResult.value,
          triggerSource: "cron:scheduled",
          executionCtx: execCtx ?? undefined,
        });

        // Run external review sync (placeholder - will run when fetcher is implemented)
        const externalReviewSyncPromise = runExternalReviewSync({
          env: envResult.value,
          sourceId: "google-maps-default",
          triggerSource: "cron:scheduled",
          executionCtx: execCtx ?? undefined,
        });

        // If we have an execution context, use waitUntil
        if (execCtx) {
          execCtx.waitUntil(stallSyncPromise);
          execCtx.waitUntil(externalReviewSyncPromise);
          
          return json({ 
            status: "scheduled", 
            message: "Sync jobs queued" 
          });
        }

        // Otherwise wait for results (development mode)
        const [stallSummary, externalSummary] = await Promise.all([
          stallSyncPromise,
          externalReviewSyncPromise,
        ]);

        return json({
          stallSync: stallSummary,
          externalReviewSync: externalSummary,
        });
      },
    },
  },
});
