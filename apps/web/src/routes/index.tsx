import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
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
  getStallArea,
  timeCategoryLabels,
  countryLabels,
} from "../data/stalls";
import { getFavorites, getVisited, toggleFavorite, toggleVisited } from "../lib/preferences";

const ALL_FILTER_VALUE = "__all__";
const sortLabelByValue: Record<string, string> = {
  "rating-desc": "Highest Rated",
  "rating-asc": "Lowest Rated",
  "price-asc": "Cheapest First",
  "price-desc": "Priciest First",
  "episode-asc": "Episode Order",
};

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [country, setCountry] = useState("");
  const [timeCategory, setTimeCategory] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [hideVisited, setHideVisited] = useState(false);
  const [sortBy, setSortBy] = useState("rating-desc");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [favoriteSet, setFavoriteSet] = useState<Set<string>>(() => new Set<string>());
  const [visitedSet, setVisitedSet] = useState<Set<string>>(() => new Set<string>());
  const filterSelectTriggerClass =
    "h-11 w-full border-warm-700/50 bg-surface-raised text-ink data-[placeholder]:text-ink-faint";

  useEffect(() => {
    setFavoriteSet(getFavorites());
    setVisitedSet(getVisited());
  }, []);

  const {
    filtered,
    areaOptions,
    cuisineOptions,
    countryOptions,
    timeCategoryOptions,
  } = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matchesSearchAndToggles = (stall: (typeof stalls)[number]) => {
      if (query) {
        const haystack =
          `${stall.name} ${stall.dishName} ${stall.address} ${stall.cuisineLabel}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (favoritesOnly && !favoriteSet.has(stall.slug)) return false;
      if (hideVisited && visitedSet.has(stall.slug)) return false;

      return true;
    };

    const matchesArea = (stall: (typeof stalls)[number], selectedArea: string) => {
      if (!selectedArea) return true;

      if (selectedArea === "Other") {
        return getStallArea(stall) === "Other";
      }

      if (stall.address.toLowerCase().includes(selectedArea.toLowerCase())) return true;

      return getStallArea(stall) === selectedArea;
    };

    const matchesFilters = (
      stall: (typeof stalls)[number],
      overrides?: {
        area?: string;
        cuisine?: string;
        country?: string;
        timeCategory?: string;
      },
    ) => {
      const nextArea = overrides?.area ?? area;
      const nextCuisine = overrides?.cuisine ?? cuisine;
      const nextCountry = overrides?.country ?? country;
      const nextTimeCategory = overrides?.timeCategory ?? timeCategory;

      if (!matchesSearchAndToggles(stall)) return false;
      if (!matchesArea(stall, nextArea)) return false;
      if (nextCuisine && stall.cuisine !== nextCuisine) return false;
      if (nextCountry && stall.country !== nextCountry) return false;
      if (
        nextTimeCategory &&
        !stall.timeCategories.includes(nextTimeCategory as (typeof stall.timeCategories)[number])
      ) {
        return false;
      }

      return true;
    };

    const nextAreas = getAreas(stalls.filter((stall) => matchesFilters(stall, { area: "" })));
    const nextCuisines = getCuisines(
      stalls.filter((stall) => matchesFilters(stall, { cuisine: "" })),
    );
    const nextCountries = getCountries(
      stalls.filter((stall) => matchesFilters(stall, { country: "" })),
    );
    const nextTimeCategories = getAllTimeCategories(
      stalls.filter((stall) => matchesFilters(stall, { timeCategory: "" })),
    );
    const next = stalls.filter((stall) => matchesFilters(stall));

    const score = (v: number | null) => (v === null ? -1 : v);

    if (sortBy === "rating-asc")
      next.sort((a, b) => score(a.ratingModerated) - score(b.ratingModerated));
    else if (sortBy === "price-asc") next.sort((a, b) => a.price - b.price);
    else if (sortBy === "price-desc") next.sort((a, b) => b.price - a.price);
    else if (sortBy === "episode-asc")
      next.sort((a, b) => (a.episodeNumber ?? 9999) - (b.episodeNumber ?? 9999));
    else next.sort((a, b) => score(b.ratingModerated) - score(a.ratingModerated));

    return {
      filtered: next,
      areaOptions: nextAreas,
      cuisineOptions: nextCuisines,
      countryOptions: nextCountries,
      timeCategoryOptions: nextTimeCategories,
    };
  }, [
    search,
    area,
    cuisine,
    country,
    timeCategory,
    favoritesOnly,
    hideVisited,
    sortBy,
    favoriteSet,
    visitedSet,
  ]);

  useEffect(() => {
    if (area && !areaOptions.includes(area)) {
      setArea("");
    }
  }, [area, areaOptions]);

  useEffect(() => {
    if (cuisine && !cuisineOptions.some((item) => item.id === cuisine)) {
      setCuisine("");
    }
  }, [cuisine, cuisineOptions]);

  useEffect(() => {
    if (country && !countryOptions.includes(country as (typeof countryOptions)[number])) {
      setCountry("");
    }
  }, [country, countryOptions]);

  useEffect(() => {
    if (
      timeCategory &&
      !timeCategoryOptions.includes(timeCategory as (typeof timeCategoryOptions)[number])
    ) {
      setTimeCategory("");
    }
  }, [timeCategory, timeCategoryOptions]);

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
          <div className="isolate grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="min-w-0">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stalls, dishes, areas..."
                className="border-warm-700/50 bg-surface-raised relative z-0 min-h-11 w-full rounded-lg border px-3 text-base sm:text-sm"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsFiltersOpen(true)}
              className="border-warm-700/50 bg-surface-raised text-ink-muted hover:border-flame-500/40 hover:text-flame-400 relative z-20 inline-flex min-h-11 flex-none touch-manipulation items-center gap-1.5 rounded-lg border px-3 text-sm"
            >
              <span className="i-ph-sliders-horizontal text-sm" />
              Filters
            </button>

            <ResponsiveDialog open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
              <ResponsiveDialogContent className="sm:max-w-2xl">
                <ResponsiveDialogHeader className="border-warm-800/50 border-b pb-3">
                  <ResponsiveDialogTitle className="font-display text-lg font-bold">
                    Filters
                  </ResponsiveDialogTitle>
                </ResponsiveDialogHeader>

                <div className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 sm:px-0">
                  <label className="text-ink-faint space-y-1 text-xs">
                    <span>Area</span>
                    <Select
                      value={area || ALL_FILTER_VALUE}
                      onValueChange={(value) =>
                        setArea(!value || value === ALL_FILTER_VALUE ? "" : value)
                      }
                    >
                      <SelectTrigger aria-label="Area" className={filterSelectTriggerClass}>
                        <SelectValue>
                          {(value) => {
                            const stringValue = typeof value === "string" ? value : "";
                            if (!stringValue || stringValue === ALL_FILTER_VALUE) {
                              return "All Areas";
                            }

                            return areaOptions.includes(stringValue) ? stringValue : "All Areas";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent align="start" className="max-h-72">
                        <SelectItem value={ALL_FILTER_VALUE}>All Areas</SelectItem>
                        {areaOptions.map((item) => (
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
                        <SelectValue>
                          {(value) => {
                            const stringValue = typeof value === "string" ? value : "";
                            if (!stringValue || stringValue === ALL_FILTER_VALUE) {
                              return "All Cuisines";
                            }

                            const option = cuisineOptions.find((item) => item.id === stringValue);
                            return option ? `${option.label} (${option.count})` : "All Cuisines";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent align="start" className="max-h-72">
                        <SelectItem value={ALL_FILTER_VALUE}>All Cuisines</SelectItem>
                        {cuisineOptions.map((item) => (
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
                        <SelectValue>
                          {(value) => {
                            const stringValue = typeof value === "string" ? value : "";
                            if (!stringValue || stringValue === ALL_FILTER_VALUE) {
                              return "All Countries";
                            }

                            return countryLabels[stringValue as keyof typeof countryLabels] ??
                              "All Countries";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent align="start" className="max-h-72">
                        <SelectItem value={ALL_FILTER_VALUE}>All Countries</SelectItem>
                        {countryOptions.map((item) => (
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
                        <SelectValue>
                          {(value) => {
                            const stringValue = typeof value === "string" ? value : "";
                            if (!stringValue || stringValue === ALL_FILTER_VALUE) {
                              return "All Hours";
                            }

                            return timeCategoryLabels[
                              stringValue as keyof typeof timeCategoryLabels
                            ] ?? "All Hours";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent align="start" className="max-h-72">
                        <SelectItem value={ALL_FILTER_VALUE}>All Hours</SelectItem>
                        {timeCategoryOptions.map((item) => (
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
                        <SelectValue>
                          {(value) => {
                            const stringValue = typeof value === "string" ? value : "";
                            return sortLabelByValue[stringValue] ?? sortLabelByValue["rating-desc"];
                          }}
                        </SelectValue>
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

                <div className="mt-4 space-y-2 px-4 pb-4 sm:px-0 sm:pb-0">
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
