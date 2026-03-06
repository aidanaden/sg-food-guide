import { Link, createFileRoute, useSearch } from "@tanstack/react-router";
import { MapPin, Utensils, Store, Search, X } from "lucide-react";
import clsx from "clsx";

import { search, getSearchResultPath, type SearchResultItem, type SearchResultType } from "#/lib/search-index";
import { addToSearchHistory } from "#/lib/search-history";
import { stalls as allStalls, type Stall } from "#/data/stalls";
import { getRatingLabel, getRatingVariant } from "#/data/stalls";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      q: (search.q as string) || "",
    };
  },
  loader: ({ search }) => {
    const query = search.q as string;
    if (!query || query.length < 2) {
      return { results: [], query: "" };
    }
    const results = search(query, { limit: 20 });
    return { results, query };
  },
  component: SearchPage,
});

const typeIcons: Record<SearchResultType, React.ReactNode> = {
  stall: <Store className="h-5 w-5" />,
  cuisine: <Utensils className="h-5 w-5" />,
  location: <MapPin className="h-5 w-5" />,
};

const typeLabels: Record<SearchResultType, string> = {
  stall: "Stall",
  cuisine: "Cuisine",
  location: "Location",
};

function SearchPage() {
  const { results, query } = Route.useLoaderData<typeof Route>();
  const searchParams = useSearch({ from: Route.fullPath });
  const currentQuery = searchParams.q || "";

  // Group results by type
  const stalls = results.filter((r) => r.type === "stall");
  const cuisines = results.filter((r) => r.type === "cuisine");
  const locations = results.filter((r) => r.type === "location");

  // Get full stall data for stall results
  const stallMap = new Map(allStalls.map((s) => [s.slug, s]));
  const stallResults: Stall[] = stalls.map((r) => stallMap.get(r.slug)).filter(Boolean) as Stall[];

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newQuery = formData.get("q") as string;
    if (newQuery.trim()) {
      addToSearchHistory(newQuery.trim());
      window.location.href = `/search?q=${encodeURIComponent(newQuery.trim())}`;
    }
  };

  return (
    <div className="bg-background min-h-screen pb-20 md:pb-0">
      <header className="border-border bg-surface border-b px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <Link to="/" className="text-foreground-faint hover:text-primary text-sm">
            ← Back to main stalls
          </Link>

          <form onSubmit={handleSearch} className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground-faint" />
              <input
                type="text"
                name="q"
                defaultValue={currentQuery}
                placeholder="Search stalls, cuisines, locations..."
                className="w-full rounded-lg border border-border bg-surface-card py-3 pl-10 pr-4 text-foreground placeholder:text-foreground-faint focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary/90"
            >
              Search
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {!currentQuery ? (
          <div className="py-12 text-center">
            <Search className="mx-auto h-12 w-12 text-foreground-faint" />
            <p className="mt-4 text-lg text-foreground-faint">
              Enter a search term to find food stalls, cuisines, or locations
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="py-12 text-center">
            <X className="mx-auto h-12 w-12 text-foreground-faint" />
            <p className="mt-4 text-lg text-foreground">
              No results found for "{currentQuery}"
            </p>
            <p className="mt-2 text-sm text-foreground-faint">
              Try searching for a different term or browse by cuisine
            </p>
            <Link
              to="/community/stalls"
              className="mt-4 inline-block rounded-lg border border-primary px-4 py-2 text-primary hover:bg-primary-surface"
            >
              Browse All Stalls
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-foreground-faint">
              Found {results.length} results for "{currentQuery}"
            </p>

            {/* Stalls Section */}
            {stallResults.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Store className="h-5 w-5 text-primary" />
                  Stalls ({stallResults.length})
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {stallResults.map((stall) => (
                    <Link
                      key={stall.slug}
                      to={`/stall/${stall.slug}`}
                      className="group border-border bg-surface-card hover:border-primary rounded-xl border p-4 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display text-base font-bold group-hover:text-primary truncate">
                            {stall.name}
                          </h3>
                          <p className="text-sm text-foreground-faint truncate">
                            {stall.cuisineLabel} • {stall.address}
                          </p>
                        </div>
                        {stall.ratingModerated !== null && (
                          <span
                            className={clsx(
                              "ml-2 shrink-0 rounded px-2 py-0.5 text-xs font-semibold",
                              getRatingVariant(stall.ratingModerated) === "rating-3" &&
                                "bg-rating-3 text-white",
                              getRatingVariant(stall.ratingModerated) === "rating-2" &&
                                "bg-rating-2 text-white",
                              getRatingVariant(stall.ratingModerated) === "rating-1" &&
                                "bg-rating-1 text-white",
                              getRatingVariant(stall.ratingModerated) === "rating-0" &&
                                "bg-rating-0 text-white"
                            )}
                          >
                            {getRatingLabel(stall.ratingModerated)}
                          </span>
                        )}
                      </div>
                      {stall.dishName && (
                        <p className="mt-2 text-sm text-foreground-faint">
                          <span className="font-medium">Try:</span> {stall.dishName}
                        </p>
                      )}
                      {stall.price > 0 && (
                        <p className="mt-1 text-sm text-foreground-faint">
                          ~${stall.price.toFixed(2)}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Cuisines Section */}
            {cuisines.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Utensils className="h-5 w-5 text-primary" />
                  Cuisines ({cuisines.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                  {cuisines.map((cuisine) => (
                    <Link
                      key={cuisine.id}
                      to={`/community/stalls?cuisine=${cuisine.slug}`}
                      className="group border-border bg-surface-card hover:border-primary rounded-lg border px-4 py-2 text-sm transition-colors"
                    >
                      <span className="group-hover:text-primary font-medium">
                        {cuisine.title}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Locations Section */}
            {locations.length > 0 && (
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <MapPin className="h-5 w-5 text-primary" />
                  Locations ({locations.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                  {locations.map((location) => (
                    <Link
                      key={location.id}
                      to={`/community/stalls?area=${location.slug}`}
                      className="group border-border bg-surface-card hover:border-primary rounded-lg border px-4 py-2 text-sm transition-colors"
                    >
                      <span className="group-hover:text-primary font-medium">
                        {location.title}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
