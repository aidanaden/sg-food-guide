import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import { z } from "zod";

import { requireCloudflareAccessAdmin } from "../auth/cloudflare-access";
import { getWorkerEnvFromServerContext } from "../cloudflare/runtime";
import {
  ensureCommentSuggestionTables,
  getDraftStatusCounts,
  listApprovedCommentSourceStalls,
  listCommentSuggestionDrafts,
  reviewDraftSuggestion,
} from "./repository";

const draftStatusValues = ["new", "reviewed", "approved", "rejected"] as const;
const extractionMethodValues = ["rules", "llm", "mixed"] as const;
const moderationFlagValues = ["spam", "profanity", "self-promo", "insufficient-signal"] as const;
const sortFieldValues = [
  "normalizedName",
  "country",
  "status",
  "extractionMethod",
  "confidenceScore",
  "supportCount",
  "topLikeCount",
  "createdAt",
  "updatedAt",
  "firstSeenAt",
  "lastSeenAt",
  "lastSyncedAt",
] as const;

const sortRuleSchema = z.object({
  field: z.enum(sortFieldValues),
  direction: z.enum(["asc", "desc"]),
});

const listDraftsInputSchema = z.object({
  status: z.enum(["all", ...draftStatusValues]).optional(),
  statuses: z.array(z.enum(draftStatusValues)).max(4).optional(),
  countries: z.array(z.string().trim().max(8)).max(20).optional(),
  extractionMethods: z.array(z.enum(extractionMethodValues)).max(3).optional(),
  moderationFlags: z.array(z.enum(moderationFlagValues)).max(4).optional(),
  moderationFlagMode: z.enum(["all", "any", "none"]).optional(),
  hasMapsUrls: z.boolean().optional(),
  hasReviewNote: z.boolean().optional(),
  hasRejectedReason: z.boolean().optional(),
  minConfidenceScore: z.number().finite().optional(),
  maxConfidenceScore: z.number().finite().optional(),
  minSupportCount: z.number().int().min(0).optional(),
  maxSupportCount: z.number().int().min(0).optional(),
  minTopLikeCount: z.number().int().min(0).optional(),
  maxTopLikeCount: z.number().int().min(0).optional(),
  query: z.string().max(200).optional(),
  logicMode: z.enum(["all", "any"]).optional(),
  sort: z.array(sortRuleSchema).max(3).optional(),
  cursor: z.string().max(1200).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const reviewDraftInputSchema = z.object({
  draftId: z.string().min(1),
  action: z.enum(["review", "approve", "reject"]),
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
    async ({
      context,
      data,
    }: {
      context: unknown;
      data: z.infer<typeof listDraftsInputSchema>;
    }) => {
      const authResult = await requireCloudflareAccessAdmin(context);
      if (Result.isError(authResult)) {
        throw authResult.error;
      }

      const ensureTablesResult = await ensureCommentSuggestionTables(
        authResult.value.env.STALLS_DB,
      );
      if (Result.isError(ensureTablesResult)) {
        throw ensureTablesResult.error;
      }

      const [draftsResult, countsResult] = await Promise.all([
        listCommentSuggestionDrafts(authResult.value.env.STALLS_DB, {
          status: data.status ?? "all",
          statuses: data.statuses,
          countries: data.countries,
          extractionMethods: data.extractionMethods,
          moderationFlags: data.moderationFlags,
          moderationFlagMode: data.moderationFlagMode,
          hasMapsUrls: data.hasMapsUrls,
          hasReviewNote: data.hasReviewNote,
          hasRejectedReason: data.hasRejectedReason,
          minConfidenceScore: data.minConfidenceScore,
          maxConfidenceScore: data.maxConfidenceScore,
          minSupportCount: data.minSupportCount,
          maxSupportCount: data.maxSupportCount,
          minTopLikeCount: data.minTopLikeCount,
          maxTopLikeCount: data.maxTopLikeCount,
          query: data.query,
          logicMode: data.logicMode,
          sort: data.sort,
          cursor: data.cursor,
          limit: data.limit,
        }),
        getDraftStatusCounts(authResult.value.env.STALLS_DB),
      ]);

      if (Result.isError(draftsResult)) {
        throw draftsResult.error;
      }

      if (Result.isError(countsResult)) {
        throw countsResult.error;
      }

      return {
        adminEmail: authResult.value.email,
        drafts: draftsResult.value.items,
        nextCursor: draftsResult.value.nextCursor,
        totalCount: draftsResult.value.totalCount,
        counts: countsResult.value,
      };
    },
  );

export const reviewCommentSuggestionDraft = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => reviewDraftInputSchema.parse(input))
  .handler(
    async ({
      context,
      data,
    }: {
      context: unknown;
      data: z.infer<typeof reviewDraftInputSchema>;
    }) => {
      const authResult = await requireCloudflareAccessAdmin(context);
      if (Result.isError(authResult)) {
        throw authResult.error;
      }

      const ensureTablesResult = await ensureCommentSuggestionTables(
        authResult.value.env.STALLS_DB,
      );
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
        new Date().toISOString(),
      );

      if (Result.isError(reviewResult)) {
        throw reviewResult.error;
      }

      return reviewResult.value;
    },
  );

export const getApprovedCommentSourceStalls = createServerFn()
  .inputValidator((input: unknown) => listApprovedInputSchema.parse(input ?? {}))
  .handler(
    async ({
      context,
      data,
    }: {
      context: unknown;
      data: z.infer<typeof listApprovedInputSchema>;
    }) => {
      const authResult = await requireCloudflareAccessAdmin(context);
      if (Result.isError(authResult)) {
        throw authResult.error;
      }

      const ensureTablesResult = await ensureCommentSuggestionTables(
        authResult.value.env.STALLS_DB,
      );
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
    },
  );

export const getPublicCommentSourceStalls = createServerFn()
  .inputValidator((input: unknown) => listApprovedInputSchema.parse(input ?? {}))
  .handler(
    async ({
      context,
      data,
    }: {
      context: unknown;
      data: z.infer<typeof listApprovedInputSchema>;
    }) => {
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
    },
  );
