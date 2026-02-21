import { Result } from 'better-result';
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

const modeSchema = z.union([z.literal('dry-run'), z.literal('apply')]);
const alertModeSchema = z.union([z.literal('all'), z.literal('failed')]);

const workerEnvSchema = z.object({
  STALLS_DB: z.unknown(),
  FOOD_GUIDE_SHEET_ID: z.optional(z.string()),
  FOOD_GUIDE_SHEET_GID: z.optional(z.string()),
  FOOD_GUIDE_SHEET_CSV_URL: z.optional(z.string()),
  YOUTUBE_CHANNEL_FEED_URL: z.optional(z.string()),
  YOUTUBE_CHANNEL_USERNAME: z.optional(z.string()),
  STALL_SYNC_MODE: z.optional(modeSchema),
  STALL_SYNC_MAX_CHANGE_RATIO: z.optional(z.union([z.string(), z.number()])),
  STALL_SYNC_ALERT_MODE: z.optional(alertModeSchema),
  STALL_SYNC_FORCE_APPLY: z.optional(z.union([z.string(), z.number()])),
  SYNC_ADMIN_TOKEN: z.optional(z.string()),
  TELEGRAM_BOT_TOKEN: z.optional(z.string()),
  TELEGRAM_CHAT_ID: z.optional(z.string()),
});

const requestContextSchema = z.object({
  cloudflare: z.object({
    env: z.unknown(),
    executionCtx: z.optional(z.unknown()),
    request: z.optional(z.unknown()),
  }),
});

export interface WorkerExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

export interface WorkerEnv {
  STALLS_DB: D1Database;
  FOOD_GUIDE_SHEET_ID?: string;
  FOOD_GUIDE_SHEET_GID?: string;
  FOOD_GUIDE_SHEET_CSV_URL?: string;
  YOUTUBE_CHANNEL_FEED_URL?: string;
  YOUTUBE_CHANNEL_USERNAME?: string;
  STALL_SYNC_MODE?: 'dry-run' | 'apply';
  STALL_SYNC_MAX_CHANGE_RATIO?: string | number;
  STALL_SYNC_ALERT_MODE?: 'all' | 'failed';
  STALL_SYNC_FORCE_APPLY?: string | number;
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

export function parseWorkerEnv(input: unknown): Result<WorkerEnv, Error> {
  const parsed = workerEnvSchema.safeParse(input);
  if (!parsed.success) {
    return Result.err(new Error('Invalid Cloudflare worker environment payload.'));
  }

  if (!isD1Database(parsed.data.STALLS_DB)) {
    return Result.err(new Error('Missing required D1 binding "STALLS_DB".'));
  }

  return Result.ok({
    ...parsed.data,
    STALLS_DB: parsed.data.STALLS_DB,
  });
}

export function getWorkerEnvFromServerContext(context: unknown): Result<WorkerEnv, Error> {
  const parsedContext = requestContextSchema.safeParse(context);
  if (!parsedContext.success) {
    return Result.err(new Error('Missing Cloudflare request context.'));
  }

  return parseWorkerEnv(parsedContext.data.cloudflare.env);
}

export function getExecutionContextFromServerContext(
  context: unknown
): Result<WorkerExecutionContextLike | null, Error> {
  const parsedContext = requestContextSchema.safeParse(context);
  if (!parsedContext.success) {
    return Result.err(new Error('Missing Cloudflare request context.'));
  }

  const executionCtx = parsedContext.data.cloudflare.executionCtx;
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
