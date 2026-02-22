import { useEffect, useState } from 'react';
import { Link, createFileRoute, notFound } from '@tanstack/react-router';
import { Button } from '@sg-food-guide/ui';
import { z } from 'zod';

import {
  formatStallTimestamp,
  getGoogleMapsUrl,
  getYouTubeEmbedUrl,
  getYouTubeSearchUrl,
  getYouTubeWatchUrl,
  normalizeYouTubeVideoId,
  getStallArea,
  getRatingLabel,
  getRatingVariant,
} from '../../lib/stall-utils';
import { getFavorites, getVisited, markVisited, toggleFavorite, toggleVisited } from '../../lib/preferences';
import { getStallBySlug } from '../../server/stalls/read.functions';

const paramsSchema = z.object({ slug: z.string().min(1) });

export const Route = createFileRoute('/stall/$slug')({
  loader: async ({ params }) => {
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) throw notFound();

    const stall = await getStallBySlug({ data: { slug: parsed.data.slug } });
    if (!stall) throw notFound();

    return { stall };
  },
  component: StallPage,
});

function StallPage() {
  const { stall } = Route.useLoaderData();
  const [favoriteSet, setFavoriteSet] = useState<Set<string>>(() => new Set<string>());
  const [visitedSet, setVisitedSet] = useState<Set<string>>(() => new Set<string>());

  useEffect(() => {
    setFavoriteSet(getFavorites());
  }, []);

  useEffect(() => {
    setVisitedSet(markVisited(stall.slug));
  }, [stall.slug]);

  const isFavorite = favoriteSet.has(stall.slug);
  const isVisited = visitedSet.has(stall.slug);

  const normalizedRating = stall.ratingModerated === null ? null : Math.min(Math.max(stall.ratingModerated, 0), 3);
  const ratingLabel = getRatingLabel(normalizedRating);
  const ratingVariant = getRatingVariant(normalizedRating);
  const area = getStallArea(stall);
  const mapsUrl = getGoogleMapsUrl(stall.googleMapsName, stall.address);
  const youtubeQuery = stall.youtubeTitle || `${stall.name} review`;
  const youtubeVideoId = normalizeYouTubeVideoId(stall.youtubeVideoId ?? stall.youtubeVideoUrl);
  const youtubeWatchUrl =
    getYouTubeWatchUrl(stall.youtubeVideoUrl) ?? getYouTubeWatchUrl(stall.youtubeVideoId);
  const youtubeUrl = youtubeWatchUrl ?? getYouTubeSearchUrl(youtubeQuery);
  const youtubeEmbedUrl = youtubeVideoId ? getYouTubeEmbedUrl(youtubeVideoId) : null;
  const addedAt = formatStallTimestamp(stall.addedAt);
  const lastScrapedAt = formatStallTimestamp(stall.lastScrapedAt);
  const mapsEmbedQuery = encodeURIComponent(`${stall.googleMapsName} ${stall.address}`);
  const mapsSearchEmbedUrl = `https://maps.google.com/maps?q=${mapsEmbedQuery}&output=embed`;

  return (
    <div className="min-h-screen">
      <nav className="border-b border-border-hover">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <Link to="/" className="text-sm text-foreground-faint hover:text-primary">← All stalls</Link>
          <Link to="/cuisine/$cuisine" params={{ cuisine: stall.cuisine }} className="text-sm text-foreground-faint hover:text-primary">
            {stall.cuisineLabel}
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <h1 className="font-display text-3xl font-black leading-tight sm:text-4xl">{stall.name}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <p className={`text-base font-semibold ${ratingVariant}`}>{normalizedRating === null ? 'Unrated' : `${normalizedRating}/3 ${ratingLabel}`}</p>
          <p className="font-mono text-2xl font-bold text-primary">${stall.price.toFixed(stall.price % 1 ? 1 : 0)}</p>
          <p className="text-sm text-foreground-faint">{area}</p>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setVisitedSet(toggleVisited(stall.slug))}
            className="border-border bg-transparent px-3 py-2 text-sm"
          >
            <span className={isVisited ? 'iconify ph--check-circle-fill text-success-text' : 'iconify ph--eye'} />
            {isVisited ? 'Visited' : 'Mark visited'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setFavoriteSet(toggleFavorite(stall.slug))}
            className="border-border bg-transparent px-3 py-2 text-sm"
          >
            <span className={isFavorite ? 'iconify ph--heart-fill text-primary' : 'iconify ph--heart'} />
            Favourite
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoCard title="Dish" icon="iconify ph--bowl-food" value={stall.dishName} />
          <InfoCard title="Area" icon="iconify ph--map-trifold" value={area} />
          <InfoCard title="Address" icon="iconify ph--map-pin" value={stall.address} />
          <InfoCard title="Opening Times" icon="iconify ph--clock" value={stall.openingTimes} />
          <InfoCard title="Added" icon="iconify ph--calendar-plus" value={addedAt} />
          <InfoCard title="Last Scraped" icon="iconify ph--arrow-clockwise" value={lastScrapedAt} />
        </div>

        {stall.hits.length > 0 ? (
          <section className="mt-6 rounded-xl border border-success bg-success-surface p-4">
            <h2 className="mb-2 text-sm font-semibold text-success-text">Hits</h2>
            <ul className="space-y-1 text-sm text-foreground-muted">
              {stall.hits.map((item: string) => (
                <li key={item} className="flex items-start gap-2"><span className="iconify ph--check text-success mt-0.5 text-xs" />{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {stall.misses.length > 0 ? (
          <section className="mt-4 rounded-xl border border-destructive bg-destructive-surface p-4">
            <h2 className="mb-2 text-sm font-semibold text-destructive-text">Misses</h2>
            <ul className="space-y-1 text-sm text-foreground-muted">
              {stall.misses.map((item: string) => (
                <li key={item} className="flex items-start gap-2"><span className="iconify ph--x text-destructive-text mt-0.5 text-xs" />{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="mb-3 font-display text-sm font-bold">Location</h2>
          <div className="overflow-hidden rounded-xl border border-border">
            <iframe
              src={mapsSearchEmbedUrl}
              width="100%"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`Map showing ${stall.name}`}
              className="h-64 w-full"
            />
          </div>
          <a href={mapsUrl} target="_blank" rel="noopener" className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:text-primary">
            <span className="iconify ph--arrow-square-out text-xs" />
            Open in Google Maps
          </a>
        </section>

        {stall.youtubeTitle || stall.youtubeVideoId || stall.youtubeVideoUrl ? (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-sm font-bold">Video Review</h2>
            {youtubeEmbedUrl ? (
              <div className="aspect-video overflow-hidden rounded-xl border border-border bg-surface-card">
                <iframe
                  src={`${youtubeEmbedUrl}?rel=0`}
                  width="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  title={`YouTube review for ${stall.name}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-surface-card p-6 text-sm text-foreground-muted">
                In-app preview unavailable for this stall.
              </div>
            )}
            <a href={youtubeUrl} target="_blank" rel="noopener" className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:text-primary">
              <span className="iconify ph--arrow-square-out text-xs" />
              Open on YouTube
            </a>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function InfoCard({ title, icon, value }: { title: string; icon: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className={`${icon} text-primary`} />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-faint">{title}</h3>
      </div>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
