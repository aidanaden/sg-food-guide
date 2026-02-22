import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
  Button,
  Checkbox,
  Input,
  Label,
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

import { StallCard } from "../components/StallCard";
import type { Stall } from "../data/shared";
import {
  getAreas,
  getAllTimeCategories,
  getCuisines,
  getCountries,
  getStallArea,
  timeCategoryLabels,
  countryLabels,
} from "../lib/stall-utils";
import { getFavorites, getVisited, toggleFavorite, toggleVisited } from "../lib/preferences";
import { getAllStalls } from "../server/stalls/read.functions";

const ALL_FILTER_VALUE = "__all__";
const sortLabelByValue: Record<string, string> = {
  "rating-desc": "Highest Rated",
  "rating-asc": "Lowest Rated",
  "price-asc": "Cheapest First",
  "price-desc": "Priciest First",
  "episode-asc": "Episode Order",
};

export const Route = createFileRoute("/")({
  loader: async () => {
    const loadedStalls = await getAllStalls();
    return { stalls: loadedStalls, generatedAt: new Date().toISOString() };
  },
  component: HomePage,
});

function HomePage() {
  const { stalls, generatedAt } = Route.useLoaderData();
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [country, setCountry] = useState("");
  const [selectedTimeCategories, setSelectedTimeCategories] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [hideVisited, setHideVisited] = useState(false);
  const [sortBy, setSortBy] = useState("rating-desc");
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

  const {
    filtered,
    areaOptions,
    cuisineOptions,
    countryOptions,
    timeCategoryOptions,
  } = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matchesSearchAndToggles = (stall: Stall) => {
      if (query) {
        const haystack =
          `${stall.name} ${stall.dishName} ${stall.address} ${stall.cuisineLabel}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (favoritesOnly && !favoriteSet.has(stall.slug)) return false;
      if (hideVisited && visitedSet.has(stall.slug)) return false;

      return true;
    };

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
        cuisine?: string;
        country?: string;
        timeCategories?: string[];
      },
    ) => {
      const nextArea = overrides?.area ?? area;
      const nextCuisine = overrides?.cuisine ?? cuisine;
      const nextCountry = overrides?.country ?? country;
      const nextTimeCategories = overrides?.timeCategories ?? selectedTimeCategories;

      if (!matchesSearchAndToggles(stall)) return false;
      if (!matchesArea(stall, nextArea)) return false;
      if (nextCuisine && stall.cuisine !== nextCuisine) return false;
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

    const nextAreas = getAreas(stalls.filter((stall: Stall) => matchesFilters(stall, { area: "" })));
    const nextCuisines = getCuisines(
      stalls.filter((stall: Stall) => matchesFilters(stall, { cuisine: "" })),
    );
    const nextCountries = getCountries(
      stalls.filter((stall: Stall) => matchesFilters(stall, { country: "" })),
    );
    const nextTimeCategories = getAllTimeCategories(
      stalls.filter((stall: Stall) => matchesFilters(stall, { timeCategories: [] })),
    );
    const next = stalls.filter((stall: Stall) => matchesFilters(stall));

    const score = (v: number | null) => (v === null ? -1 : v);

    if (sortBy === "rating-asc")
      next.sort((a: Stall, b: Stall) => score(a.ratingModerated) - score(b.ratingModerated));
    else if (sortBy === "price-asc") next.sort((a: Stall, b: Stall) => a.price - b.price);
    else if (sortBy === "price-desc") next.sort((a: Stall, b: Stall) => b.price - a.price);
    else if (sortBy === "episode-asc")
      next.sort((a: Stall, b: Stall) => (a.episodeNumber ?? 9999) - (b.episodeNumber ?? 9999));
    else next.sort((a: Stall, b: Stall) => score(b.ratingModerated) - score(a.ratingModerated));

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
    selectedTimeCategories,
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
    setSelectedTimeCategories((current) => {
      const next = current.filter((item) =>
        timeCategoryOptions.includes(item as (typeof timeCategoryOptions)[number]),
      );
      return next.length === current.length ? current : next;
    });
  }, [timeCategoryOptions]);

  const hasAreaOptions = areaOptions.length > 0;
  const hasCuisineOptions = cuisineOptions.length > 0;
  const hasCountryOptions = countryOptions.length > 0;
  const hasTimeCategoryOptions = timeCategoryOptions.length > 0;

  return (
    <div className="min-h-screen">
      <header className="border-border bg-surface border-b px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-display text-4xl font-black tracking-tight">
            <span className="text-primary">SG</span> Food Guide
          </h1>
          <p className="text-foreground-muted mt-2">
            {stalls.length} stalls ranked, mapped, and reviewed.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="mb-6">
          <div className="isolate grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="min-w-0">
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stalls, dishes, areas..."
                className="border-border bg-surface-raised relative z-0 h-11 w-full px-3 text-base sm:text-sm"
              />
            </div>

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

                <div className="grid grid-cols-1 gap-3 px-4 pt-3 sm:grid-cols-2 sm:px-0 sm:pt-3">
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
                    <span>Cuisine</span>
                    <Select
                      disabled={!hasCuisineOptions}
                      value={cuisine || ALL_FILTER_VALUE}
                      onValueChange={(value) =>
                        setCuisine(!value || value === ALL_FILTER_VALUE ? "" : value)
                      }
                    >
                      <SelectTrigger
                        disabled={!hasCuisineOptions}
                        aria-label="Cuisine"
                        className={filterSelectTriggerClass}
                      >
                        <SelectValue>
                          {(value) => {
                            if (!hasCuisineOptions) {
                              return "No options";
                            }

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

                  <label className="text-foreground-faint space-y-1 text-xs">
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

                  <label className="text-foreground-faint space-y-1 text-xs sm:col-span-2">
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
                  <Label className="border-border bg-surface-raised min-h-11 w-full rounded-lg border px-3 text-sm font-normal">
                    <Checkbox
                      variant="tick"
                      checked={favoritesOnly}
                      onCheckedChange={(checked) => setFavoritesOnly(checked)}
                    />
                    Favourites only
                  </Label>

                  <Label className="border-border bg-surface-raised min-h-11 w-full rounded-lg border px-3 text-sm font-normal">
                    <Checkbox
                      variant="tick"
                      checked={hideVisited}
                      onCheckedChange={(checked) => setHideVisited(checked)}
                    />
                    Hide visited
                  </Label>
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
              showCuisine
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
