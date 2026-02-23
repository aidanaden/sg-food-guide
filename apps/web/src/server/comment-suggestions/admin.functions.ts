import { Result } from 'better-result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { requireCloudflareAccessAdmin } from '../auth/cloudflare-access';
import { getWorkerEnvFromServerContext } from '../cloudflare/runtime';
import {
  ensureCommentSuggestionTables,
  getDraftStatusCounts,
  listApprovedCommentSourceStalls,
  listCommentSuggestionDrafts,
  reviewDraftSuggestion,
} from './repository';

const listDraftsInputSchema = z.object({
  status: z.enum(['all', 'new', 'reviewed', 'approved', 'rejected']).optional(),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

const reviewDraftInputSchema = z.object({
  draftId: z.string().min(1),
  action: z.enum(['review', 'approve', 'reject']),
  reviewNote: z.string().max(500).optional(),
  rejectedReason: z.string().max(300).optional(),
  editedName: z.string().max(120).optional(),
  editedCountry: z.string().max(8).optional(),
});

const listApprovedInputSchema = z.object({
  includeArchived: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const getCommentSuggestionAdminData = createServerFn()
  .inputValidator((input: unknown) => listDraftsInputSchema.parse(input ?? {}))
  .handler(
    async ({ context, data }: { context: unknown; data: z.infer<typeof listDraftsInputSchema> }) => {
      const authResult = requireCloudflareAccessAdmin(context);
      if (Result.isError(authResult)) {
        throw authResult.error;
      }

      const ensureTablesResult = await ensureCommentSuggestionTables(authResult.value.env.STALLS_DB);
      if (Result.isError(ensureTablesResult)) {
        throw ensureTablesResult.error;
      }

      const [draftsResult, countsResult, approvedResult] = await Promise.all([
        listCommentSuggestionDrafts(authResult.value.env.STALLS_DB, {
          status: data.status ?? 'all',
          query: data.query,
          limit: data.limit,
          offset: data.offset,
        }),
        getDraftStatusCounts(authResult.value.env.STALLS_DB),
        listApprovedCommentSourceStalls(authResult.value.env.STALLS_DB, {
          includeArchived: false,
          limit: 200,
        }),
      ]);

      if (Result.isError(draftsResult)) {
        throw draftsResult.error;
      }

      if (Result.isError(countsResult)) {
        throw countsResult.error;
      }

      if (Result.isError(approvedResult)) {
        throw approvedResult.error;
      }

      return {
        adminEmail: authResult.value.email,
        drafts: draftsResult.value,
        counts: countsResult.value,
        approvedStalls: approvedResult.value,
      };
    }
  );

export const reviewCommentSuggestionDraft = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => reviewDraftInputSchema.parse(input))
  .handler(
    async ({ context, data }: { context: unknown; data: z.infer<typeof reviewDraftInputSchema> }) => {
      const authResult = requireCloudflareAccessAdmin(context);
      if (Result.isError(authResult)) {
        throw authResult.error;
      }

      const ensureTablesResult = await ensureCommentSuggestionTables(authResult.value.env.STALLS_DB);
      if (Result.isError(ensureTablesResult)) {
        throw ensureTablesResult.error;
      }

      const reviewResult = await reviewDraftSuggestion(
        authResult.value.env.STALLS_DB,
        {
          draftId: data.draftId,
          action: data.action,
          reviewerEmail: authResult.value.email,
          reviewNote: data.reviewNote,
          rejectedReason: data.rejectedReason,
          editedName: data.editedName,
          editedCountry: data.editedCountry,
        },
        new Date().toISOString()
      );

      if (Result.isError(reviewResult)) {
        throw reviewResult.error;
      }

      return reviewResult.value;
    }
  );

export const getApprovedCommentSourceStalls = createServerFn()
  .inputValidator((input: unknown) => listApprovedInputSchema.parse(input ?? {}))
  .handler(
    async ({ context, data }: { context: unknown; data: z.infer<typeof listApprovedInputSchema> }) => {
      const authResult = requireCloudflareAccessAdmin(context);
      if (Result.isError(authResult)) {
        throw authResult.error;
      }

      const ensureTablesResult = await ensureCommentSuggestionTables(authResult.value.env.STALLS_DB);
      if (Result.isError(ensureTablesResult)) {
        throw ensureTablesResult.error;
      }

      const listResult = await listApprovedCommentSourceStalls(authResult.value.env.STALLS_DB, {
        includeArchived: data.includeArchived,
        limit: data.limit,
      });
      if (Result.isError(listResult)) {
        throw listResult.error;
      }

      return listResult.value;
    }
  );

export const getPublicCommentSourceStalls = createServerFn()
  .inputValidator((input: unknown) => listApprovedInputSchema.parse(input ?? {}))
  .handler(
    async ({ context, data }: { context: unknown; data: z.infer<typeof listApprovedInputSchema> }) => {
      const envResult = getWorkerEnvFromServerContext(context);
      if (Result.isError(envResult)) {
        throw envResult.error;
      }

      const ensureTablesResult = await ensureCommentSuggestionTables(envResult.value.STALLS_DB);
      if (Result.isError(ensureTablesResult)) {
        throw ensureTablesResult.error;
      }

      const listResult = await listApprovedCommentSourceStalls(envResult.value.STALLS_DB, {
        includeArchived: data.includeArchived,
        limit: data.limit,
      });
      if (Result.isError(listResult)) {
        throw listResult.error;
      }

      return listResult.value;
    }
  );
