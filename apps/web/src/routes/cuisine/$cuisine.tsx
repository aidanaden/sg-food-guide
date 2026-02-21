import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

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

import { StallCard } from "../../components/StallCard";
import {
  getStallsByCuisine,
  getAreas,
  getAllTimeCategories,
  getCountries,
  getStallArea,
  timeCategoryLabels,
  countryLabels,
} from "../../data/stalls";
import { getFavorites, getVisited, toggleFavorite, toggleVisited } from "../../lib/preferences";

const ALL_FILTER_VALUE = "__all__";

const paramsSchema = z.object({ cuisine: z.string().min(1) });

export const Route = createFileRoute("/cuisine/$cuisine")({
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

  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [country, setCountry] = useState("");
  const [timeCategory, setTimeCategory] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [favoriteSet, setFavoriteSet] = useState<Set<string>>(() => new Set<string>());
  const [visitedSet, setVisitedSet] = useState<Set<string>>(() => new Set<string>());
  const filterSelectTriggerClass =
    "h-11 w-full border-warm-700/50 bg-surface-raised text-ink data-[placeholder]:text-ink-faint";

  useEffect(() => {
    setFavoriteSet(getFavorites());
    setVisitedSet(getVisited());
  }, []);

  const { filtered, areaOptions, countryOptions, timeCategoryOptions } = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matchesArea = (stall: (typeof cuisineStalls)[number], selectedArea: string) => {
      if (!selectedArea) return true;

      if (selectedArea === "Other") {
        return getStallArea(stall) === "Other";
      }

      if (stall.address.toLowerCase().includes(selectedArea.toLowerCase())) return true;

      return getStallArea(stall) === selectedArea;
    };

    const matchesFilters = (
      stall: (typeof cuisineStalls)[number],
      overrides?: {
        area?: string;
        country?: string;
        timeCategory?: string;
      },
    ) => {
      const nextArea = overrides?.area ?? area;
      const nextCountry = overrides?.country ?? country;
      const nextTimeCategory = overrides?.timeCategory ?? timeCategory;

      if (query) {
        const haystack = `${stall.name} ${stall.dishName} ${stall.address}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (!matchesArea(stall, nextArea)) return false;
      if (nextCountry && stall.country !== nextCountry) return false;
      if (
        nextTimeCategory &&
        !stall.timeCategories.includes(nextTimeCategory as (typeof stall.timeCategories)[number])
      ) {
        return false;
      }

      return true;
    };

    const nextAreas = getAreas(
      cuisineStalls.filter((stall) => matchesFilters(stall, { area: "" })),
    );
    const nextCountries = getCountries(
      cuisineStalls.filter((stall) => matchesFilters(stall, { country: "" })),
    );
    const nextTimeCategories = getAllTimeCategories(
      cuisineStalls.filter((stall) => matchesFilters(stall, { timeCategory: "" })),
    );

    return {
      filtered: cuisineStalls.filter((stall) => matchesFilters(stall)),
      areaOptions: nextAreas,
      countryOptions: nextCountries,
      timeCategoryOptions: nextTimeCategories,
    };
  }, [search, area, country, timeCategory, cuisineStalls]);

  useEffect(() => {
    if (area && !areaOptions.includes(area)) {
      setArea("");
    }
  }, [area, areaOptions]);

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
      <header className="border-warm-800/60 border-b px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <Link to="/" className="text-ink-faint hover:text-flame-400 text-sm">
            ← All stalls
          </Link>
          <h1 className="font-display mt-2 text-3xl font-black">
            Best <span className="text-flame-400">{cuisineLabel}</span> in Singapore
          </h1>
          <p className="text-ink-muted">{cuisineStalls.length} stalls reviewed and ranked.</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="mb-6">
          <div className="isolate grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stalls or dishes..."
              className="border-warm-700/50 bg-surface-raised relative z-0 min-h-11 min-w-0 w-full rounded-lg border px-3 text-base sm:text-sm"
            />

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

                <div className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2 sm:px-0 sm:pb-0">
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

                  <label className="text-ink-faint space-y-1 text-xs sm:col-span-2">
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
