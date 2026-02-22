import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import {
  Button,
  Input,
  ResponsiveDialog,
  ResponsiveDialogClose,
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
import type { Stall } from "../../data/shared";
import {
  getAreas,
  getAllTimeCategories,
  getCountries,
  getStallArea,
  timeCategoryLabels,
  countryLabels,
} from "../../lib/stall-utils";
import { getFavorites, getVisited, toggleFavorite, toggleVisited } from "../../lib/preferences";
import { getStallsByCuisine as getStallsByCuisineServer } from "../../server/stalls/read.functions";

const ALL_FILTER_VALUE = "__all__";

const paramsSchema = z.object({ cuisine: z.string().min(1) });

export const Route = createFileRoute("/cuisine/$cuisine")({
  loader: async ({ params }) => {
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      throw notFound();
    }

    const cuisineStalls = await getStallsByCuisineServer({ data: { cuisine: parsed.data.cuisine } });
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
      generatedAt: new Date().toISOString(),
    };
  },
  component: CuisinePage,
});

function CuisinePage() {
  const { cuisineLabel, cuisineStalls, generatedAt } = Route.useLoaderData();

  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [country, setCountry] = useState("");
  const [selectedTimeCategories, setSelectedTimeCategories] = useState<string[]>([]);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [favoriteSet, setFavoriteSet] = useState<Set<string>>(() => new Set<string>());
  const [visitedSet, setVisitedSet] = useState<Set<string>>(() => new Set<string>());
  const filterSelectTriggerClass =
    "h-11 w-full border-border bg-surface-raised text-foreground data-[placeholder]:text-foreground-faint";
  const filterButtonClass =
    "border-border bg-surface-raised text-foreground-muted hover:border-primary hover:text-primary relative z-20 h-11 flex-none touch-manipulation px-3 text-base sm:text-sm";

  useEffect(() => {
    setFavoriteSet(getFavorites());
    setVisitedSet(getVisited());
  }, []);

  const { filtered, areaOptions, countryOptions, timeCategoryOptions } = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matchesArea = (stall: Stall, selectedArea: string) => {
      if (!selectedArea) return true;

      if (selectedArea === "Other") {
        return getStallArea(stall) === "Other";
      }

      if (stall.address.toLowerCase().includes(selectedArea.toLowerCase())) return true;

      return getStallArea(stall) === selectedArea;
    };

    const matchesFilters = (
      stall: Stall,
      overrides?: {
        area?: string;
        country?: string;
        timeCategories?: string[];
      },
    ) => {
      const nextArea = overrides?.area ?? area;
      const nextCountry = overrides?.country ?? country;
      const nextTimeCategories = overrides?.timeCategories ?? selectedTimeCategories;

      if (query) {
        const haystack = `${stall.name} ${stall.dishName} ${stall.address}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (!matchesArea(stall, nextArea)) return false;
      if (nextCountry && stall.country !== nextCountry) return false;
      if (
        nextTimeCategories.length > 0 &&
        !nextTimeCategories.some((category) =>
          stall.timeCategories.includes(category as (typeof stall.timeCategories)[number]),
        )
      ) {
        return false;
      }

      return true;
    };

    const nextAreas = getAreas(
      cuisineStalls.filter((stall: Stall) => matchesFilters(stall, { area: "" })),
    );
    const nextCountries = getCountries(
      cuisineStalls.filter((stall: Stall) => matchesFilters(stall, { country: "" })),
    );
    const nextTimeCategories = getAllTimeCategories(
      cuisineStalls.filter((stall: Stall) => matchesFilters(stall, { timeCategories: [] })),
    );

    return {
      filtered: cuisineStalls.filter((stall: Stall) => matchesFilters(stall)),
      areaOptions: nextAreas,
      countryOptions: nextCountries,
      timeCategoryOptions: nextTimeCategories,
    };
  }, [search, area, country, selectedTimeCategories, cuisineStalls]);

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
    setSelectedTimeCategories((current) => {
      const next = current.filter((item) =>
        timeCategoryOptions.includes(item as (typeof timeCategoryOptions)[number]),
      );
      return next.length === current.length ? current : next;
    });
  }, [timeCategoryOptions]);

  const hasAreaOptions = areaOptions.length > 0;
  const hasCountryOptions = countryOptions.length > 0;
  const hasTimeCategoryOptions = timeCategoryOptions.length > 0;

  return (
    <div className="min-h-screen">
      <header className="border-border border-b px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <Link to="/" className="text-foreground-faint hover:text-primary text-sm">
            ← All stalls
          </Link>
          <h1 className="font-display mt-2 text-3xl font-black">
            Best <span className="text-primary">{cuisineLabel}</span> in Singapore
          </h1>
          <p className="text-foreground-muted">{cuisineStalls.length} stalls reviewed and ranked.</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="mb-6">
          <div className="isolate grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stalls or dishes..."
              className="border-border bg-surface-raised relative z-0 h-11 min-w-0 w-full px-3 text-base sm:text-sm"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFiltersOpen(true)}
              className={filterButtonClass}
            >
              <span className="iconify ph--sliders-horizontal text-sm" />
              Filters
            </Button>

            <ResponsiveDialog open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
              <ResponsiveDialogContent showCloseButton={false} className="pt-0 sm:max-w-2xl sm:gap-0">
                <ResponsiveDialogHeader className="border-border -mx-4 border-b px-4 pb-3 sm:pt-3 sm:pb-2">
                  <div className="flex items-center justify-between">
                    <ResponsiveDialogTitle className="font-display text-lg font-bold">
                      Filters
                    </ResponsiveDialogTitle>
                    <ResponsiveDialogClose aria-label="Close filters">
                      <span aria-hidden="true" className="iconify ph--x-bold text-foreground-muted size-4 shrink-0" />
                    </ResponsiveDialogClose>
                  </div>
                </ResponsiveDialogHeader>

                <div className="grid grid-cols-1 gap-3 px-4 pt-3 pb-4 sm:grid-cols-2 sm:px-0 sm:pt-3 sm:pb-0">
                  <label className="text-foreground-faint space-y-1 text-xs">
                    <span>Area</span>
                    <Select
                      disabled={!hasAreaOptions}
                      value={area || ALL_FILTER_VALUE}
                      onValueChange={(value) =>
                        setArea(!value || value === ALL_FILTER_VALUE ? "" : value)
                      }
                    >
                      <SelectTrigger
                        disabled={!hasAreaOptions}
                        aria-label="Area"
                        className={filterSelectTriggerClass}
                      >
                        <SelectValue>
                          {(value) => {
                            if (!hasAreaOptions) {
                              return "No options";
                            }

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

                  <label className="text-foreground-faint space-y-1 text-xs">
                    <span>Country</span>
                    <Select
                      disabled={!hasCountryOptions}
                      value={country || ALL_FILTER_VALUE}
                      onValueChange={(value) =>
                        setCountry(!value || value === ALL_FILTER_VALUE ? "" : value)
                      }
                    >
                      <SelectTrigger
                        disabled={!hasCountryOptions}
                        aria-label="Country"
                        className={filterSelectTriggerClass}
                      >
                        <SelectValue>
                          {(value) => {
                            if (!hasCountryOptions) {
                              return "No options";
                            }

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

                  <label className="text-foreground-faint space-y-1 text-xs sm:col-span-2">
                    <span>Hours</span>
                    <Select
                      disabled={!hasTimeCategoryOptions}
                      multiple
                      value={selectedTimeCategories}
                      onValueChange={(value) => {
                        if (!hasTimeCategoryOptions) {
                          setSelectedTimeCategories([]);
                          return;
                        }

                        if (!Array.isArray(value)) {
                          setSelectedTimeCategories([]);
                          return;
                        }
                        setSelectedTimeCategories(
                          value.filter((item): item is string => typeof item === "string"),
                        );
                      }}
                    >
                      <SelectTrigger
                        disabled={!hasTimeCategoryOptions}
                        aria-label="Hours"
                        className={filterSelectTriggerClass}
                      >
                        <SelectValue>
                          {(value) => {
                            if (!hasTimeCategoryOptions) {
                              return "No options";
                            }

                            const values = Array.isArray(value)
                              ? value.filter((item): item is string => typeof item === "string")
                              : [];
                            if (values.length === 0) {
                              return "All Hours";
                            }

                            const labels = values
                              .map(
                                (item) =>
                                  timeCategoryLabels[item as keyof typeof timeCategoryLabels],
                              )
                              .filter((item): item is string => Boolean(item));

                            if (labels.length === 0) {
                              return "All Hours";
                            }

                            if (labels.length <= 2) {
                              return labels.join(", ");
                            }

                            return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent align="start" className="max-h-72">
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

        <p className="text-foreground-faint mb-4 text-xs">Showing {filtered.length} stalls</p>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((stall: Stall) => (
            <StallCard
              key={stall.slug}
              stall={stall}
              isFavorite={favoriteSet.has(stall.slug)}
              isVisited={visitedSet.has(stall.slug)}
              relativeNow={generatedAt}
              onToggleFavorite={(slug) => setFavoriteSet(toggleFavorite(slug))}
              onToggleVisited={(slug) => setVisitedSet(toggleVisited(slug))}
            />
          ))}
        </section>
      </main>
    </div>
  );
}
