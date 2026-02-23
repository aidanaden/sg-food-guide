import { Link, createFileRoute } from '@tanstack/react-router';

import { getPublicCommentSourceStalls } from '../../server/comment-suggestions/admin.functions';

export const Route = createFileRoute('/community/stalls')({
  loader: async () => {
    const stalls = await getPublicCommentSourceStalls({
      data: {
        includeArchived: false,
        limit: 500,
      },
    });

    return {
      stalls,
      generatedAt: new Date().toISOString(),
    };
  },
  component: CommunityStallsPage,
});

function CommunityStallsPage() {
  const { stalls, generatedAt } = Route.useLoaderData();
  const generatedAtDisplay = generatedAt.replace('T', ' ').slice(0, 16);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-border bg-surface border-b px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <Link to="/" className="text-sm text-foreground-faint hover:text-primary">
            ← Back to main stalls
          </Link>
          <h1 className="font-display mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Community Suggestions
          </h1>
          <p className="text-foreground-muted mt-2 text-sm sm:text-base">
            Admin-approved stalls discovered from YouTube comments. Last refreshed {generatedAtDisplay} UTC.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <p className="text-foreground-faint mb-4 text-xs">
          Showing {stalls.length} approved community-sourced stalls in a separate source set.
        </p>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {stalls.map((stall) => (
            <article key={stall.id} className="border-border bg-surface-card rounded-xl border p-4">
              <header className="mb-3">
                <h2 className="font-display text-lg font-bold">{stall.name}</h2>
                <p className="text-foreground-faint text-xs">{stall.country}</p>
              </header>

              <dl className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-foreground-faint">Confidence</dt>
                  <dd className="font-semibold">{Math.round(stall.confidenceScore)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-foreground-faint">Support</dt>
                  <dd className="font-semibold">{stall.supportCount} comments</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-foreground-faint">Top likes</dt>
                  <dd className="font-semibold">{stall.topLikeCount}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-foreground-faint">Approved</dt>
                  <dd className="font-semibold">{stall.approvedAt.slice(0, 10)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
