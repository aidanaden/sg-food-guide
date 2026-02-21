import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";

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

import { StallCard } from "../../components/StallCard";
import {
  getStallsByCuisine,
  getAreas,
  getCountries,
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

  const areas = useMemo(() => getAreas(cuisineStalls), [cuisineStalls]);
  const countries = useMemo(() => getCountries(cuisineStalls), [cuisineStalls]);
  const timeCategories = useMemo(
    () => [...new Set(cuisineStalls.flatMap((stall) => stall.timeCategories))],
    [cuisineStalls],
  );

  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [country, setCountry] = useState("");
  const [timeCategory, setTimeCategory] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [favoriteSet, setFavoriteSet] = useState<Set<string>>(() => getFavorites());
  const [visitedSet, setVisitedSet] = useState<Set<string>>(() => getVisited());
  const filterSelectTriggerClass =
    "h-11 w-full border-warm-700/50 bg-surface-raised text-ink data-[placeholder]:text-ink-faint";

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
      if (selectedTimeCategory && !stall.timeCategories.includes(selectedTimeCategory))
        return false;

      return true;
    });
  }, [search, area, country, timeCategory, timeCategories, cuisineStalls]);

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
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stalls or dishes..."
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

                  <label className="text-ink-faint space-y-1 text-xs sm:col-span-2">
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
