import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';

import { StallCard } from '../components/StallCard';
import { getFavorites, getVisited, toggleFavorite, toggleVisited } from '../lib/preferences';
import {
  stalls,
  getAreas,
  getAllTimeCategories,
  getCuisines,
  getCountries,
  timeCategoryLabels,
  countryLabels,
} from '../data/stalls';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const areas = useMemo(() => getAreas(), []);
  const cuisines = useMemo(() => getCuisines(), []);
  const countries = useMemo(() => getCountries(), []);
  const timeCategories = useMemo(() => getAllTimeCategories(), []);

  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [country, setCountry] = useState('');
  const [timeCategory, setTimeCategory] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [hideVisited, setHideVisited] = useState(false);
  const [sortBy, setSortBy] = useState('rating-desc');
  const [favoriteSet, setFavoriteSet] = useState<Set<string>>(() => getFavorites());
  const [visitedSet, setVisitedSet] = useState<Set<string>>(() => getVisited());

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const selectedTimeCategory = timeCategories.find((item) => item === timeCategory);

    const next = stalls.filter((stall) => {
      if (query) {
        const haystack = `${stall.name} ${stall.dishName} ${stall.address} ${stall.cuisineLabel}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (area && area !== 'all' && !stall.address.toLowerCase().includes(area.toLowerCase()) && area !== 'Other') {
        // Keep legacy area behavior close enough by matching derived area label when available.
        // This intentionally stays permissive to avoid over-filtering.
        const areaMatch = getAreas([stall])[0];
        if (areaMatch !== area) return false;
      }

      if (cuisine && stall.cuisine !== cuisine) return false;
      if (country && stall.country !== country) return false;
      if (selectedTimeCategory && !stall.timeCategories.includes(selectedTimeCategory)) return false;
      if (favoritesOnly && !favoriteSet.has(stall.slug)) return false;
      if (hideVisited && visitedSet.has(stall.slug)) return false;

      return true;
    });

    const score = (v: number | null) => (v === null ? -1 : v);

    if (sortBy === 'rating-asc') next.sort((a, b) => score(a.ratingModerated) - score(b.ratingModerated));
    else if (sortBy === 'price-asc') next.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price-desc') next.sort((a, b) => b.price - a.price);
    else if (sortBy === 'episode-asc') next.sort((a, b) => (a.episodeNumber ?? 9999) - (b.episodeNumber ?? 9999));
    else next.sort((a, b) => score(b.ratingModerated) - score(a.ratingModerated));

    return next;
  }, [search, area, cuisine, country, timeCategory, timeCategories, favoritesOnly, hideVisited, sortBy, favoriteSet, visitedSet]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-warm-800/60 bg-surface/90 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-display text-4xl font-black tracking-tight">
            <span className="text-flame-400">SG</span> Food Guide
          </h1>
          <p className="mt-2 text-ink-muted">{stalls.length} stalls ranked, mapped, and reviewed.</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="mb-6 grid grid-cols-1 gap-2 md:grid-cols-3 lg:grid-cols-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stalls, dishes, areas..."
            className="w-full min-h-11 rounded-lg border border-warm-700/50 bg-surface-raised px-3 text-base sm:text-sm"
          />

          <select value={area} onChange={(e) => setArea(e.target.value)} className="min-h-11 rounded-lg border border-warm-700/50 bg-surface-raised px-3 text-sm">
            <option value="">All Areas</option>
            {areas.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} className="min-h-11 rounded-lg border border-warm-700/50 bg-surface-raised px-3 text-sm">
            <option value="">All Cuisines</option>
            {cuisines.map((item) => (
              <option key={item.id} value={item.id}>{item.label} ({item.count})</option>
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

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="min-h-11 rounded-lg border border-warm-700/50 bg-surface-raised px-3 text-sm">
            <option value="rating-desc">Highest Rated</option>
            <option value="rating-asc">Lowest Rated</option>
            <option value="price-asc">Cheapest First</option>
            <option value="price-desc">Priciest First</option>
            <option value="episode-asc">Episode Order</option>
          </select>

          <label className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-warm-700/50 bg-surface-raised px-3 text-sm">
            <input type="checkbox" checked={favoritesOnly} onChange={(e) => setFavoritesOnly(e.target.checked)} />
            Favourites only
          </label>

          <label className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-warm-700/50 bg-surface-raised px-3 text-sm">
            <input type="checkbox" checked={hideVisited} onChange={(e) => setHideVisited(e.target.checked)} />
            Hide visited
          </label>
        </section>

        <p className="mb-4 text-xs text-ink-faint">Showing {filtered.length} stalls</p>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((stall) => (
            <StallCard
              key={stall.slug}
              stall={stall}
              showCuisine
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
