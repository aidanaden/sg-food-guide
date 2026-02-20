import { useMemo, useState } from 'react';
import { Link, createFileRoute, notFound } from '@tanstack/react-router';
import { z } from 'zod';

import { StallCard } from '../../components/StallCard';
import { getFavorites, getVisited, toggleFavorite, toggleVisited } from '../../lib/preferences';
import {
  getStallsByCuisine,
  getAreas,
  getCountries,
  timeCategoryLabels,
  countryLabels,
} from '../../data/stalls';

const paramsSchema = z.object({ cuisine: z.string().min(1) });

export const Route = createFileRoute('/cuisine/$cuisine')({
  loader: ({ params }) => {
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      throw notFound();
    }

    const cuisineStalls = getStallsByCuisine(parsed.data.cuisine);
    if (cuisineStalls.length === 0) {
      throw notFound();
    }
    const firstStall = cuisineStalls[0];
    if (!firstStall) {
      throw notFound();
    }

    return {
      cuisineId: parsed.data.cuisine,
      cuisineLabel: firstStall.cuisineLabel,
      cuisineStalls,
    };
  },
  component: CuisinePage,
});

function CuisinePage() {
  const { cuisineLabel, cuisineStalls } = Route.useLoaderData();

  const areas = useMemo(() => getAreas(cuisineStalls), [cuisineStalls]);
  const countries = useMemo(() => getCountries(cuisineStalls), [cuisineStalls]);
  const timeCategories = useMemo(
    () => [...new Set(cuisineStalls.flatMap((stall) => stall.timeCategories))],
    [cuisineStalls]
  );

  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [country, setCountry] = useState('');
  const [timeCategory, setTimeCategory] = useState('');
  const [favoriteSet, setFavoriteSet] = useState<Set<string>>(() => getFavorites());
  const [visitedSet, setVisitedSet] = useState<Set<string>>(() => getVisited());

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const selectedTimeCategory = timeCategories.find((item) => item === timeCategory);
    return cuisineStalls.filter((stall) => {
      if (query) {
        const haystack = `${stall.name} ${stall.dishName} ${stall.address}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (area && getAreas([stall])[0] !== area) return false;
      if (country && stall.country !== country) return false;
      if (selectedTimeCategory && !stall.timeCategories.includes(selectedTimeCategory)) return false;

      return true;
    });
  }, [search, area, country, timeCategory, timeCategories, cuisineStalls]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-warm-800/60 px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <Link to="/" className="text-sm text-ink-faint hover:text-flame-400">← All stalls</Link>
          <h1 className="mt-2 font-display text-3xl font-black">Best <span className="text-flame-400">{cuisineLabel}</span> in Singapore</h1>
          <p className="text-ink-muted">{cuisineStalls.length} stalls reviewed and ranked.</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="mb-6 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stalls or dishes..."
            className="w-full min-h-11 rounded-lg border border-warm-700/50 bg-surface-raised px-3 text-base sm:text-sm"
          />

          <select value={area} onChange={(e) => setArea(e.target.value)} className="min-h-11 rounded-lg border border-warm-700/50 bg-surface-raised px-3 text-sm">
            <option value="">All Areas</option>
            {areas.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <select value={country} onChange={(e) => setCountry(e.target.value)} className="min-h-11 rounded-lg border border-warm-700/50 bg-surface-raised px-3 text-sm">
            <option value="">All Countries</option>
            {countries.map((item) => (
              <option key={item} value={item}>{countryLabels[item]}</option>
            ))}
          </select>

          <select value={timeCategory} onChange={(e) => setTimeCategory(e.target.value)} className="min-h-11 rounded-lg border border-warm-700/50 bg-surface-raised px-3 text-sm">
            <option value="">All Hours</option>
            {timeCategories.map((item) => (
              <option key={item} value={item}>{timeCategoryLabels[item]}</option>
            ))}
          </select>
        </section>

        <p className="mb-4 text-xs text-ink-faint">Showing {filtered.length} stalls</p>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((stall) => (
            <StallCard
              key={stall.slug}
              stall={stall}
              isFavorite={favoriteSet.has(stall.slug)}
              isVisited={visitedSet.has(stall.slug)}
              onToggleFavorite={(slug) => setFavoriteSet(toggleFavorite(slug))}
              onToggleVisited={(slug) => setVisitedSet(toggleVisited(slug))}
            />
          ))}
        </section>
      </main>
    </div>
  );
}
