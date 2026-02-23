import { Result } from 'better-result';
import { getStartContext } from '@tanstack/start-storage-context';
import * as z from 'zod/mini';

export interface D1PreparedStatement {
  bind(...values: Array<unknown>): D1PreparedStatement;
  first<T = unknown>(columnName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean }>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: Array<D1PreparedStatement>): Promise<T[]>;
  exec(query: string): Promise<{ success: boolean }>;
}

export interface WorkersAiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

const modeSchema = z.union([z.literal('dry-run'), z.literal('apply')]);
const alertModeSchema = z.union([z.literal('all'), z.literal('failed')]);

const workerEnvSchema = z.object({
  STALLS_DB: z.unknown(),
  AI: z.optional(z.unknown()),
  FOOD_GUIDE_SHEET_ID: z.optional(z.string()),
  FOOD_GUIDE_SHEET_GID: z.optional(z.string()),
  FOOD_GUIDE_SHEET_CSV_URL: z.optional(z.string()),
  GOOGLE_PLACES_API_KEY: z.optional(z.string()),
  YOUTUBE_CHANNEL_ID: z.optional(z.string()),
  YOUTUBE_DATA_API_KEY: z.optional(z.string()),
  ONEMAP_EMAIL: z.optional(z.string()),
  ONEMAP_PASSWORD: z.optional(z.string()),
  LTA_ACCOUNT_KEY: z.optional(z.string()),
  STALL_SYNC_MODE: z.optional(modeSchema),
  STALL_SYNC_MAX_CHANGE_RATIO: z.optional(z.union([z.string(), z.number()])),
  STALL_SYNC_ALERT_MODE: z.optional(alertModeSchema),
  STALL_SYNC_FORCE_APPLY: z.optional(z.union([z.string(), z.number()])),
  STALL_SYNC_MANUAL_YOUTUBE_OVERRIDES_JSON: z.optional(z.string()),
  COMMENT_SYNC_MODE: z.optional(modeSchema),
  COMMENT_SYNC_FORCE_APPLY: z.optional(z.union([z.string(), z.number()])),
  COMMENT_SYNC_MAX_VIDEOS_PER_RUN: z.optional(z.union([z.string(), z.number()])),
  COMMENT_SYNC_TOP_LEVEL_LIMIT: z.optional(z.union([z.string(), z.number()])),
  COMMENT_SYNC_MIN_LIKES: z.optional(z.union([z.string(), z.number()])),
  COMMENT_SYNC_HIGH_CONFIDENCE_THRESHOLD: z.optional(z.union([z.string(), z.number()])),
  COMMENT_SYNC_LLM_ENABLED: z.optional(z.union([z.string(), z.number(), z.boolean()])),
  COMMENT_SYNC_LLM_MAX_COMMENTS_PER_RUN: z.optional(z.union([z.string(), z.number()])),
  CLOUDFLARE_ACCESS_ADMIN_EMAILS: z.optional(z.string()),
  WORKERS_AI_MODEL: z.optional(z.string()),
  OPENAI_API_KEY: z.optional(z.string()),
  OPENAI_MODEL: z.optional(z.string()),
  SYNC_ADMIN_TOKEN: z.optional(z.string()),
  TELEGRAM_BOT_TOKEN: z.optional(z.string()),
  TELEGRAM_CHAT_ID: z.optional(z.string()),
});

export interface WorkerExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

export interface WorkerEnv {
  STALLS_DB: D1Database;
  AI?: WorkersAiBinding;
  FOOD_GUIDE_SHEET_ID?: string;
  FOOD_GUIDE_SHEET_GID?: string;
  FOOD_GUIDE_SHEET_CSV_URL?: string;
  GOOGLE_PLACES_API_KEY?: string;
  YOUTUBE_CHANNEL_ID?: string;
  YOUTUBE_DATA_API_KEY?: string;
  ONEMAP_EMAIL?: string;
  ONEMAP_PASSWORD?: string;
  LTA_ACCOUNT_KEY?: string;
  STALL_SYNC_MODE?: 'dry-run' | 'apply';
  STALL_SYNC_MAX_CHANGE_RATIO?: string | number;
  STALL_SYNC_ALERT_MODE?: 'all' | 'failed';
  STALL_SYNC_FORCE_APPLY?: string | number;
  STALL_SYNC_MANUAL_YOUTUBE_OVERRIDES_JSON?: string;
  COMMENT_SYNC_MODE?: 'dry-run' | 'apply';
  COMMENT_SYNC_FORCE_APPLY?: string | number;
  COMMENT_SYNC_MAX_VIDEOS_PER_RUN?: string | number;
  COMMENT_SYNC_TOP_LEVEL_LIMIT?: string | number;
  COMMENT_SYNC_MIN_LIKES?: string | number;
  COMMENT_SYNC_HIGH_CONFIDENCE_THRESHOLD?: string | number;
  COMMENT_SYNC_LLM_ENABLED?: string | number | boolean;
  COMMENT_SYNC_LLM_MAX_COMMENTS_PER_RUN?: string | number;
  CLOUDFLARE_ACCESS_ADMIN_EMAILS?: string;
  WORKERS_AI_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  SYNC_ADMIN_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

export interface WorkerRequestContext {
  cloudflare: {
    env: WorkerEnv;
    executionCtx?: WorkerExecutionContextLike;
    request?: Request;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface CloudflareContextPayload {
  env: unknown;
  executionCtx?: unknown;
  request?: unknown;
}

function toCloudflareContextPayload(input: unknown): CloudflareContextPayload | null {
  if (!isRecord(input)) {
    return null;
  }

  if (input.env === undefined) {
    return null;
  }

  return {
    env: input.env,
    executionCtx: input.executionCtx,
    request: input.request,
  };
}

function tryParseCloudflareContext(input: unknown, depth = 0): CloudflareContextPayload | null {
  if (depth > 3) {
    return null;
  }

  const directContext = toCloudflareContextPayload(input);
  if (directContext) {
    return directContext;
  }

  if (!isRecord(input)) {
    return null;
  }

  const directCloudflare = input.cloudflare;
  if (directCloudflare !== undefined) {
    const parsedDirectCloudflare = toCloudflareContextPayload(directCloudflare);
    if (parsedDirectCloudflare) {
      return parsedDirectCloudflare;
    }
  }

  const nestedRequestContext = input.requestContext;
  if (nestedRequestContext !== undefined) {
    const parsedNestedRequestContext = tryParseCloudflareContext(nestedRequestContext, depth + 1);
    if (parsedNestedRequestContext) {
      return parsedNestedRequestContext;
    }
  }

  const nestedContext = input.context;
  if (nestedContext !== undefined) {
    const parsedNestedContext = tryParseCloudflareContext(nestedContext, depth + 1);
    if (parsedNestedContext) {
      return parsedNestedContext;
    }
  }

  return null;
}

function resolveCloudflareContext(context: unknown): Result<CloudflareContextPayload, Error> {
  const parsedContext = tryParseCloudflareContext(context);
  if (parsedContext) {
    return Result.ok(parsedContext);
  }

  const startContextResult = Result.try(() => getStartContext({ throwIfNotFound: false }));
  if (!Result.isError(startContextResult)) {
    const globalContext = startContextResult.value?.contextAfterGlobalMiddlewares;

    const parsedGlobalContext = tryParseCloudflareContext(globalContext);
    if (parsedGlobalContext) {
      return Result.ok(parsedGlobalContext);
    }
  }

  return Result.err(new Error('Missing Cloudflare request context.'));
}

export function isD1Database(value: unknown): value is D1Database {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<D1Database>;
  return (
    typeof candidate.prepare === 'function' &&
    typeof candidate.batch === 'function' &&
    typeof candidate.exec === 'function'
  );
}

function isWorkersAiBinding(value: unknown): value is WorkersAiBinding {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<WorkersAiBinding>;
  return typeof candidate.run === 'function';
}

export function parseWorkerEnv(input: unknown): Result<WorkerEnv, Error> {
  const parsed = workerEnvSchema.safeParse(input);
  if (!parsed.success) {
    return Result.err(new Error('Invalid Cloudflare worker environment payload.'));
  }

  if (!isD1Database(parsed.data.STALLS_DB)) {
    return Result.err(new Error('Missing required D1 binding "STALLS_DB".'));
  }

  if (parsed.data.AI !== undefined && !isWorkersAiBinding(parsed.data.AI)) {
    return Result.err(new Error('Invalid optional AI binding "AI".'));
  }

  const aiBinding = parsed.data.AI as WorkersAiBinding | undefined;

  return Result.ok({
    ...parsed.data,
    STALLS_DB: parsed.data.STALLS_DB,
    AI: aiBinding,
  });
}

export function getWorkerEnvFromServerContext(context: unknown): Result<WorkerEnv, Error> {
  const cloudflareContextResult = resolveCloudflareContext(context);
  if (Result.isError(cloudflareContextResult)) {
    return Result.err(cloudflareContextResult.error);
  }

  return parseWorkerEnv(cloudflareContextResult.value.env);
}

export function getExecutionContextFromServerContext(
  context: unknown
): Result<WorkerExecutionContextLike | null, Error> {
  const cloudflareContextResult = resolveCloudflareContext(context);
  if (Result.isError(cloudflareContextResult)) {
    return Result.err(cloudflareContextResult.error);
  }

  const executionCtx = cloudflareContextResult.value.executionCtx;
  if (!executionCtx) {
    return Result.ok(null);
  }

  const hasWaitUntil =
    typeof executionCtx === 'object' &&
    executionCtx !== null &&
    'waitUntil' in executionCtx &&
    typeof (executionCtx as WorkerExecutionContextLike).waitUntil === 'function';

  if (!hasWaitUntil) {
    return Result.err(new Error('Invalid execution context payload.'));
  }

  return Result.ok(executionCtx as WorkerExecutionContextLike);
}

export function getRequestFromServerContext(context: unknown): Result<Request, Error> {
  const cloudflareContextResult = resolveCloudflareContext(context);
  if (Result.isError(cloudflareContextResult)) {
    return Result.err(cloudflareContextResult.error);
  }

  const request = cloudflareContextResult.value.request;
  if (!(request instanceof Request)) {
    return Result.err(new Error('Missing request in Cloudflare context.'));
  }

  return Result.ok(request);
}
