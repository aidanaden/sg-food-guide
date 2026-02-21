import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sg-food-guide/ui";

import { StallCard } from "../components/StallCard";
import {
  stalls,
  getAreas,
  getAllTimeCategories,
  getCuisines,
  getCountries,
  timeCategoryLabels,
  countryLabels,
} from "../data/stalls";
import { getFavorites, getVisited, toggleFavorite, toggleVisited } from "../lib/preferences";

const ALL_FILTER_VALUE = "__all__";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const areas = useMemo(() => getAreas(), []);
  const cuisines = useMemo(() => getCuisines(), []);
  const countries = useMemo(() => getCountries(), []);
  const timeCategories = useMemo(() => getAllTimeCategories(), []);

  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [country, setCountry] = useState("");
  const [timeCategory, setTimeCategory] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [hideVisited, setHideVisited] = useState(false);
  const [sortBy, setSortBy] = useState("rating-desc");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [favoriteSet, setFavoriteSet] = useState<Set<string>>(() => getFavorites());
  const [visitedSet, setVisitedSet] = useState<Set<string>>(() => getVisited());
  const filterSelectTriggerClass =
    "h-11 w-full border-warm-700/50 bg-surface-raised text-ink data-[placeholder]:text-ink-faint";

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const selectedTimeCategory = timeCategories.find((item) => item === timeCategory);

    const next = stalls.filter((stall) => {
      if (query) {
        const haystack =
          `${stall.name} ${stall.dishName} ${stall.address} ${stall.cuisineLabel}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (
        area &&
        area !== "all" &&
        !stall.address.toLowerCase().includes(area.toLowerCase()) &&
        area !== "Other"
      ) {
        // Keep legacy area behavior close enough by matching derived area label when available.
        // This intentionally stays permissive to avoid over-filtering.
        const areaMatch = getAreas([stall])[0];
        if (areaMatch !== area) return false;
      }

      if (cuisine && stall.cuisine !== cuisine) return false;
      if (country && stall.country !== country) return false;
      if (selectedTimeCategory && !stall.timeCategories.includes(selectedTimeCategory))
        return false;
      if (favoritesOnly && !favoriteSet.has(stall.slug)) return false;
      if (hideVisited && visitedSet.has(stall.slug)) return false;

      return true;
    });

    const score = (v: number | null) => (v === null ? -1 : v);

    if (sortBy === "rating-asc")
      next.sort((a, b) => score(a.ratingModerated) - score(b.ratingModerated));
    else if (sortBy === "price-asc") next.sort((a, b) => a.price - b.price);
    else if (sortBy === "price-desc") next.sort((a, b) => b.price - a.price);
    else if (sortBy === "episode-asc")
      next.sort((a, b) => (a.episodeNumber ?? 9999) - (b.episodeNumber ?? 9999));
    else next.sort((a, b) => score(b.ratingModerated) - score(a.ratingModerated));

    return next;
  }, [
    search,
    area,
    cuisine,
    country,
    timeCategory,
    timeCategories,
    favoritesOnly,
    hideVisited,
    sortBy,
    favoriteSet,
    visitedSet,
  ]);

  return (
    <div className="min-h-screen">
      <header className="border-warm-800/60 bg-surface/90 border-b px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-display text-4xl font-black tracking-tight">
            <span className="text-flame-400">SG</span> Food Guide
          </h1>
          <p className="text-ink-muted mt-2">
            {stalls.length} stalls ranked, mapped, and reviewed.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="mb-6">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stalls, dishes, areas..."
              className="border-warm-700/50 bg-surface-raised min-h-11 w-full rounded-lg border px-3 text-base sm:text-sm"
            />

            <ResponsiveDialog open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
              <ResponsiveDialogTrigger className="border-warm-700/50 bg-surface-raised text-ink-muted hover:border-flame-500/40 hover:text-flame-400 inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm">
                <span className="i-ph-sliders-horizontal text-sm" />
                Filters
              </ResponsiveDialogTrigger>

              <ResponsiveDialogContent className="sm:max-w-2xl">
                <ResponsiveDialogHeader className="border-warm-800/50 border-b pb-3">
                  <ResponsiveDialogTitle className="font-display text-lg font-bold">
                    Filters
                  </ResponsiveDialogTitle>
                </ResponsiveDialogHeader>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-ink-faint space-y-1 text-xs">
                    <span>Area</span>
                    <Select
                      value={area || ALL_FILTER_VALUE}
                      onValueChange={(value) =>
                        setArea(!value || value === ALL_FILTER_VALUE ? "" : value)
                      }
                    >
                      <SelectTrigger aria-label="Area" className={filterSelectTriggerClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start" className="max-h-72">
                        <SelectItem value={ALL_FILTER_VALUE}>All Areas</SelectItem>
                        {areas.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>

                  <label className="text-ink-faint space-y-1 text-xs">
                    <span>Cuisine</span>
                    <Select
                      value={cuisine || ALL_FILTER_VALUE}
                      onValueChange={(value) =>
                        setCuisine(!value || value === ALL_FILTER_VALUE ? "" : value)
                      }
                    >
                      <SelectTrigger aria-label="Cuisine" className={filterSelectTriggerClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start" className="max-h-72">
                        <SelectItem value={ALL_FILTER_VALUE}>All Cuisines</SelectItem>
                        {cuisines.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.label} ({item.count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>

                  <label className="text-ink-faint space-y-1 text-xs">
                    <span>Country</span>
                    <Select
                      value={country || ALL_FILTER_VALUE}
                      onValueChange={(value) =>
                        setCountry(!value || value === ALL_FILTER_VALUE ? "" : value)
                      }
                    >
                      <SelectTrigger aria-label="Country" className={filterSelectTriggerClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start" className="max-h-72">
                        <SelectItem value={ALL_FILTER_VALUE}>All Countries</SelectItem>
                        {countries.map((item) => (
                          <SelectItem key={item} value={item}>
                            {countryLabels[item]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>

                  <label className="text-ink-faint space-y-1 text-xs">
                    <span>Hours</span>
                    <Select
                      value={timeCategory || ALL_FILTER_VALUE}
                      onValueChange={(value) =>
                        setTimeCategory(!value || value === ALL_FILTER_VALUE ? "" : value)
                      }
                    >
                      <SelectTrigger aria-label="Hours" className={filterSelectTriggerClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start" className="max-h-72">
                        <SelectItem value={ALL_FILTER_VALUE}>All Hours</SelectItem>
                        {timeCategories.map((item) => (
                          <SelectItem key={item} value={item}>
                            {timeCategoryLabels[item]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>

                  <label className="text-ink-faint space-y-1 text-xs sm:col-span-2">
                    <span>Sort</span>
                    <Select
                      value={sortBy}
                      onValueChange={(value) => {
                        if (!value) return;
                        setSortBy(value);
                      }}
                    >
                      <SelectTrigger aria-label="Sort" className={filterSelectTriggerClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start" className="max-h-72">
                        <SelectItem value="rating-desc">Highest Rated</SelectItem>
                        <SelectItem value="rating-asc">Lowest Rated</SelectItem>
                        <SelectItem value="price-asc">Cheapest First</SelectItem>
                        <SelectItem value="price-desc">Priciest First</SelectItem>
                        <SelectItem value="episode-asc">Episode Order</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="border-warm-700/50 bg-surface-raised inline-flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={favoritesOnly}
                      onChange={(e) => setFavoritesOnly(e.target.checked)}
                    />
                    Favourites only
                  </label>

                  <label className="border-warm-700/50 bg-surface-raised inline-flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={hideVisited}
                      onChange={(e) => setHideVisited(e.target.checked)}
                    />
                    Hide visited
                  </label>
                </div>
              </ResponsiveDialogContent>
            </ResponsiveDialog>
          </div>
        </section>

        <p className="text-ink-faint mb-4 text-xs">Showing {filtered.length} stalls</p>

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
