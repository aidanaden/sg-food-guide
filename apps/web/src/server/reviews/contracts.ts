import { Result } from "better-result";
import * as z from "zod/mini";

export interface CanonicalReview {
  id: string;
  stallId: string;
  authorId: string | null;
  authorName: string;
  rating: number;
  commentText: string;
  status: "pending" | "approved" | "rejected";
  moderationNote: string;
  moderatedBy: string | null;
  moderatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const dbReviewRowSchema = z.object({
  id: z.string(),
  stall_id: z.string(),
  author_id: z.optional(z.union([z.string(), z.null()])),
  author_name: z.string(),
  rating: z.union([z.number(), z.string()]),
  comment_text: z.string(),
  status: z.union([z.literal("pending"), z.literal("approved"), z.literal("rejected")]),
  moderation_note: z.string(),
  moderated_by: z.optional(z.union([z.string(), z.null()])),
  moderated_at: z.optional(z.union([z.string(), z.null()])),
  created_at: z.string(),
  updated_at: z.string(),
});

export function mapDbRowToReview(row: unknown): Result<CanonicalReview, Error> {
  const parsed = dbReviewRowSchema.safeParse(row);
  if (!parsed.success) {
    return Result.err(new Error("Invalid review row returned from database."));
  }

  const rowValue = parsed.data;
  const rating = Number(rowValue.rating);

  return Result.ok({
    id: rowValue.id,
    stallId: rowValue.stall_id,
    authorId: rowValue.author_id ?? null,
    authorName: rowValue.author_name,
    rating: Number.isFinite(rating) ? rating : 0,
    commentText: rowValue.comment_text,
    status: rowValue.status,
    moderationNote: rowValue.moderation_note,
    moderatedBy: rowValue.moderated_by ?? null,
    moderatedAt: rowValue.moderated_at ?? null,
    createdAt: rowValue.created_at,
    updatedAt: rowValue.updated_at,
  });
}
