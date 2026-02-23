import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@sg-food-guide/ui';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { Result } from 'better-result';
import { useEffect, useMemo, useState } from 'react';

import {
  getCommentSuggestionAdminData,
  reviewCommentSuggestionDraft,
} from '../../server/comment-suggestions/admin.functions';
import type { CommentSuggestionDraft } from '../../server/comment-suggestions/contracts';

type DraftStatusFilter = 'all' | 'new' | 'reviewed' | 'approved' | 'rejected';

interface DraftEditState {
  editedName: string;
  editedCountry: string;
  reviewNote: string;
  rejectedReason: string;
}

const statusLabels: Record<DraftStatusFilter, string> = {
  all: 'All',
  new: 'New',
  reviewed: 'Reviewed',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const Route = createFileRoute('/admin/comment-drafts')({
  loader: async () => {
    const dataResult = await Result.tryPromise(() =>
      getCommentSuggestionAdminData({
        data: {
          status: 'all',
          limit: 500,
        },
      })
    );

    if (Result.isError(dataResult)) {
      return {
        authorized: false,
        error: dataResult.error instanceof Error ? dataResult.error.message : String(dataResult.error),
      } as const;
    }

    return {
      authorized: true,
      payload: dataResult.value,
    } as const;
  },
  component: AdminCommentDraftsPage,
});

function AdminCommentDraftsPage() {
  const loaderData = Route.useLoaderData();
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState<DraftStatusFilter>('all');
  const [query, setQuery] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [pendingDraftId, setPendingDraftId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, DraftEditState>>({});

  useEffect(() => {
    if (!loaderData.authorized) {
      return;
    }

    const nextEdits: Record<string, DraftEditState> = {};
    for (const draft of loaderData.payload.drafts) {
      nextEdits[draft.id] = {
        editedName: draft.displayName,
        editedCountry: draft.country,
        reviewNote: draft.reviewNote,
        rejectedReason: draft.rejectedReason ?? '',
      };
    }

    setEdits(nextEdits);
  }, [loaderData]);

  const filteredDrafts = useMemo(() => {
    if (!loaderData.authorized) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    return loaderData.payload.drafts.filter((draft: CommentSuggestionDraft) => {
      if (statusFilter !== 'all' && draft.status !== statusFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = `${draft.displayName} ${draft.normalizedName}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [loaderData, query, statusFilter]);

  if (!loaderData.authorized) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="border-border bg-surface-card mx-auto max-w-2xl rounded-xl border p-6">
          <h1 className="font-display text-2xl font-black">Admin Access Required</h1>
          <p className="text-foreground-muted mt-3 text-sm">
            Cloudflare Access admin identity was not accepted. Ensure you are authenticated through Access and that
            your email is listed in `CLOUDFLARE_ACCESS_ADMIN_EMAILS`.
          </p>
          <p className="text-destructive-text mt-3 text-xs">{loaderData.error}</p>
          <div className="mt-4">
            <Link to="/" className="text-primary text-sm hover:underline">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function runDraftAction(draftId: string, action: 'review' | 'approve' | 'reject'): Promise<void> {
    const edit = edits[draftId];
    if (!edit) {
      return;
    }

    setPendingDraftId(draftId);
    setActionMessage('');

    const actionResult = await Result.tryPromise(() =>
      reviewCommentSuggestionDraft({
        data: {
          draftId,
          action,
          reviewNote: edit.reviewNote,
          editedName: edit.editedName,
          editedCountry: edit.editedCountry,
          rejectedReason: edit.rejectedReason,
        },
      })
    );

    if (Result.isError(actionResult)) {
      setActionMessage(
        `Failed to ${action} draft: ${actionResult.error instanceof Error ? actionResult.error.message : String(actionResult.error)}`
      );
      setPendingDraftId(null);
      return;
    }

    setActionMessage(`Draft ${action} action completed.`);
    setPendingDraftId(null);
    await router.invalidate();
  }

  const counts = loaderData.payload.counts;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-border bg-surface border-b px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-black">Comment Draft Queue</h1>
              <p className="text-foreground-faint mt-1 text-xs">
                Signed in as {loaderData.payload.adminEmail}. Admin-only Cloudflare Access route.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/community/stalls" className="text-primary text-sm hover:underline">
                View approved source route
              </Link>
              <Link to="/" className="text-foreground-faint text-sm hover:text-primary">
                Main app
              </Link>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <StatusPill label="New" count={counts.new} />
            <StatusPill label="Reviewed" count={counts.reviewed} />
            <StatusPill label="Approved" count={counts.approved} />
            <StatusPill label="Rejected" count={counts.rejected} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-[220px_minmax(0,1fr)]">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter((value as DraftStatusFilter) || 'all')}>
            <SelectTrigger className="border-border bg-surface-raised">
              <SelectValue>{(value) => statusLabels[(value as DraftStatusFilter) || 'all']}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search draft name"
            className="border-border bg-surface-raised"
          />
        </section>

        {actionMessage ? <p className="mb-3 text-sm text-primary">{actionMessage}</p> : null}

        <section className="space-y-3">
          {filteredDrafts.map((draft: CommentSuggestionDraft) => {
            const edit = edits[draft.id] ?? {
              editedName: draft.displayName,
              editedCountry: draft.country,
              reviewNote: draft.reviewNote,
              rejectedReason: draft.rejectedReason ?? '',
            };

            const isPending = pendingDraftId === draft.id;

            return (
              <article key={draft.id} className="border-border bg-surface-card rounded-xl border p-4">
                <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-bold">{draft.displayName}</h2>
                    <p className="text-foreground-faint text-xs">status: {draft.status}</p>
                  </div>

                  <div className="text-right text-xs">
                    <p className="text-foreground-faint">confidence</p>
                    <p className="font-semibold">{Math.round(draft.confidenceScore)}</p>
                  </div>
                </header>

                <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <Input
                    value={edit.editedName}
                    onChange={(event) =>
                      setEdits((current) => ({
                        ...current,
                        [draft.id]: {
                          ...edit,
                          editedName: event.target.value,
                        },
                      }))
                    }
                    placeholder="Approved stall name"
                    className="border-border bg-surface-raised"
                  />

                  <Input
                    value={edit.editedCountry}
                    onChange={(event) =>
                      setEdits((current) => ({
                        ...current,
                        [draft.id]: {
                          ...edit,
                          editedCountry: event.target.value.toUpperCase(),
                        },
                      }))
                    }
                    placeholder="Country code"
                    className="border-border bg-surface-raised"
                  />

                  <Input
                    value={edit.reviewNote}
                    onChange={(event) =>
                      setEdits((current) => ({
                        ...current,
                        [draft.id]: {
                          ...edit,
                          reviewNote: event.target.value,
                        },
                      }))
                    }
                    placeholder="Review note"
                    className="border-border bg-surface-raised md:col-span-2"
                  />

                  <Input
                    value={edit.rejectedReason}
                    onChange={(event) =>
                      setEdits((current) => ({
                        ...current,
                        [draft.id]: {
                          ...edit,
                          rejectedReason: event.target.value,
                        },
                      }))
                    }
                    placeholder="Reject reason"
                    className="border-border bg-surface-raised md:col-span-2"
                  />
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <Metric label="Support" value={`${draft.supportCount}`} />
                  <Metric label="Top likes" value={`${draft.topLikeCount}`} />
                  <Metric label="Comments" value={`${draft.evidenceCommentIds.length}`} />
                  <Metric label="Videos" value={`${draft.evidenceVideoIds.length}`} />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => runDraftAction(draft.id, 'review')}
                    className="border-border bg-surface-raised"
                  >
                    Mark Reviewed
                  </Button>

                  <Button
                    type="button"
                    disabled={isPending}
                    onClick={() => runDraftAction(draft.id, 'approve')}
                    className="bg-primary text-primary-foreground"
                  >
                    Approve
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => runDraftAction(draft.id, 'reject')}
                    className="border-destructive text-destructive-text hover:bg-destructive-surface"
                  >
                    Reject
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}

function StatusPill({ label, count }: { label: string; count: number }) {
  return (
    <span className="border-border bg-surface-raised rounded-md border px-2 py-1">
      {label}: {count}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-surface-raised rounded-md border px-2 py-1">
      <p className="text-foreground-faint">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
