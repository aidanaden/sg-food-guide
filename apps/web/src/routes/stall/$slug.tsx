import { useEffect, useState } from 'react';
import { Link, createFileRoute, notFound } from '@tanstack/react-router';
import { z } from 'zod';

import {
  stalls,
  getGoogleMapsUrl,
  getYouTubeEmbedUrl,
  getYouTubeSearchUrl,
  normalizeYouTubeVideoId,
  getStallArea,
  getRatingLabel,
  getRatingVariant,
} from '../../data/stalls';
import { getFavorites, getVisited, markVisited, toggleFavorite, toggleVisited } from '../../lib/preferences';

const paramsSchema = z.object({ slug: z.string().min(1) });

export const Route = createFileRoute('/stall/$slug')({
  loader: ({ params }) => {
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) throw notFound();

    const stall = stalls.find((item) => item.slug === parsed.data.slug);
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
  const youtubeUrl = getYouTubeSearchUrl(youtubeQuery);
  const youtubeVideoId = normalizeYouTubeVideoId(stall.youtubeVideoId);
  const youtubeEmbedUrl = youtubeVideoId ? getYouTubeEmbedUrl(youtubeVideoId) : null;
  const mapsEmbedQuery = encodeURIComponent(`${stall.googleMapsName} ${stall.address}`);
  const mapsSearchEmbedUrl = `https://maps.google.com/maps?q=${mapsEmbedQuery}&output=embed`;

  return (
    <div className="min-h-screen">
      <nav className="border-b border-warm-800/40">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <Link to="/" className="text-sm text-ink-faint hover:text-flame-400">← All stalls</Link>
          <Link to="/cuisine/$cuisine" params={{ cuisine: stall.cuisine }} className="text-sm text-ink-faint hover:text-flame-400">
            {stall.cuisineLabel}
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <h1 className="font-display text-3xl font-black leading-tight sm:text-4xl">{stall.name}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <p className={`text-base font-semibold ${ratingVariant}`}>{normalizedRating === null ? 'Unrated' : `${normalizedRating}/3 ${ratingLabel}`}</p>
          <p className="font-mono text-2xl font-bold text-flame-400">${stall.price.toFixed(stall.price % 1 ? 1 : 0)}</p>
          <p className="text-sm text-ink-faint">{area}</p>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setVisitedSet(toggleVisited(stall.slug))}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-warm-700/50 px-3 py-2 text-sm"
          >
            <span className={isVisited ? 'i-ph-check-circle-fill text-jade-400' : 'i-ph-eye'} />
            {isVisited ? 'Visited' : 'Mark visited'}
          </button>
          <button
            type="button"
            onClick={() => setFavoriteSet(toggleFavorite(stall.slug))}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-warm-700/50 px-3 py-2 text-sm"
          >
            <span className={isFavorite ? 'i-ph-heart-fill text-flame-400' : 'i-ph-heart'} />
            Favourite
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoCard title="Dish" icon="i-ph-bowl-food" value={stall.dishName} />
          <InfoCard title="Area" icon="i-ph-map-trifold" value={area} />
          <InfoCard title="Address" icon="i-ph-map-pin" value={stall.address} />
          <InfoCard title="Opening Times" icon="i-ph-clock" value={stall.openingTimes} />
        </div>

        {stall.hits.length > 0 ? (
          <section className="mt-6 rounded-xl border border-jade-500/20 bg-jade-500/5 p-4">
            <h2 className="mb-2 text-sm font-semibold text-jade-400">Hits</h2>
            <ul className="space-y-1 text-sm text-ink-muted">
              {stall.hits.map((item) => (
                <li key={item} className="flex items-start gap-2"><span className="i-ph-check text-jade-500/70 mt-0.5 text-xs" />{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {stall.misses.length > 0 ? (
          <section className="mt-4 rounded-xl border border-flame-500/20 bg-flame-500/5 p-4">
            <h2 className="mb-2 text-sm font-semibold text-flame-400">Misses</h2>
            <ul className="space-y-1 text-sm text-ink-muted">
              {stall.misses.map((item) => (
                <li key={item} className="flex items-start gap-2"><span className="i-ph-x text-flame-500/70 mt-0.5 text-xs" />{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="mb-3 font-display text-sm font-bold">Location</h2>
          <div className="overflow-hidden rounded-xl border border-warm-800/50">
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
          <a href={mapsUrl} target="_blank" rel="noopener" className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-warm-700/50 px-3 py-2 text-sm hover:text-flame-400">
            <span className="i-ph-arrow-square-out text-xs" />
            Open in Google Maps
          </a>
        </section>

        {stall.youtubeTitle || stall.youtubeVideoId ? (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-sm font-bold">Video Review</h2>
            {youtubeEmbedUrl ? (
              <div className="aspect-video overflow-hidden rounded-xl border border-warm-800/50 bg-surface-card">
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
              <div className="rounded-xl border border-warm-800/50 bg-surface-card p-6 text-sm text-ink-muted">
                In-app preview unavailable for this stall.
              </div>
            )}
            <a href={youtubeUrl} target="_blank" rel="noopener" className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-warm-700/50 px-3 py-2 text-sm hover:text-flame-400">
              <span className="i-ph-arrow-square-out text-xs" />
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
    <div className="rounded-xl border border-warm-800/50 bg-surface-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className={`${icon} text-flame-400`} />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{title}</h3>
      </div>
      <p className="text-sm text-ink">{value}</p>
    </div>
  );
}
