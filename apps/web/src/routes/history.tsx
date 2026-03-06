import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@sg-food-guide/ui";

import { StallCard } from "../components/StallCard";
import type { Stall } from "../data/shared";
import { getVisited, getVisitStats, exportVisitData } from "../lib/preferences";
import { loadHomeRouteData } from "../lib/route-loaders";
import { getStallArea } from "../lib/stall-utils";

export const Route = createFileRoute("/history")({
  loader: async () => loadHomeRouteData(),
  component: HistoryPage,
});

function HistoryPage() {
  const { stalls, generatedAt } = Route.useLoaderData();
  const [visitedSet, setVisitedSet] = useState<Set<string>>(() => new Set<string>());

  useEffect(() => {
    setVisitedSet(getVisited());
  }, []);

  const visitedStalls = useMemo(() => {
    return stalls.filter((stall) => visitedSet.has(stall.slug));
  }, [stalls, visitedSet]);

  const stats = useMemo(() => {
    return getVisitStats(stalls);
  }, [stalls, visitedSet]);

  const handleExport = () => {
    const data = exportVisitData(stalls);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sg-food-guide-visits-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen">
      <header className="border-border bg-surface border-b px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-foreground-faint hover:text-primary text-sm">
              ← All stalls
            </Link>
          </div>
          <h1 className="font-display text-4xl font-black tracking-tight mt-2">
            Visit History
          </h1>
          <p className="text-foreground-muted mt-2">
            Track your food journey and discover your dining preferences.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Statistics Section */}
        <section className="mb-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon="iconify ph--check-circle"
              label="Total Visits"
              value={stats.totalVisits.toString()}
              color="text-primary"
            />
            <StatCard
              icon="iconify ph--map-pin"
              label="Unique Stalls"
              value={stats.uniqueStalls.toString()}
              color="text-secondary"
            />
            <StatCard
              icon="iconify ph--bowl-food"
              label="Top Cuisine"
              value={stats.cuisineBreakdown[0]?.cuisineLabel ?? "—"}
              color="text-accent"
            />
            <StatCard
              icon="iconify ph--map-trifold"
              label="Top Area"
              value={stats.areaBreakdown[0]?.area ?? "—"}
              color="text-success-text"
            />
          </div>
        </section>

        {/* Cuisine Breakdown */}
        {stats.cuisineBreakdown.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-lg font-bold mb-4">Cuisine Breakdown</h2>
            <div className="flex flex-wrap gap-2">
              {stats.cuisineBreakdown.map((item) => (
                <Link
                  key={item.cuisine}
                  to="/cuisine/$cuisine"
                  params={{ cuisine: item.cuisine }}
                  className="border-border bg-surface-raised hover:border-primary inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
                >
                  <span className="text-foreground-faint">{item.cuisineLabel}</span>
                  <span className="bg-primary/10 text-primary font-mono text-xs px-2 py-0.5 rounded-full">
                    {item.count}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Area Breakdown */}
        {stats.areaBreakdown.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-lg font-bold mb-4">Area Breakdown</h2>
            <div className="flex flex-wrap gap-2">
              {stats.areaBreakdown.map((item) => (
                <span
                  key={item.area}
                  className="border-border bg-surface-raised inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="text-foreground-faint">{item.area}</span>
                  <span className="bg-success-text/10 text-success-text font-mono text-xs px-2 py-0.5 rounded-full">
                    {item.count}
                  </span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Export Button */}
        {visitedStalls.length > 0 && (
          <section className="mb-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleExport}
              className="border-border bg-transparent"
            >
              <span className="iconify ph--download-simple mr-2" />
              Export Visit Data
            </Button>
          </section>
        )}

        {/* Visited Stalls List */}
        <section>
          <h2 className="font-display text-lg font-bold mb-4">
            Visited Stalls ({visitedStalls.length})
          </h2>
          {visitedStalls.length === 0 ? (
            <div className="border-border bg-surface-raised rounded-xl border p-8 text-center">
              <span className="iconify ph--plate text-foreground-faint text-4xl mb-4 block mx-auto" />
              <p className="text-foreground-muted">No stalls visited yet.</p>
              <Link
                to="/"
                className="text-primary hover:underline mt-2 inline-block text-sm"
              >
                Browse stalls to start tracking your visits
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {visitedStalls.map((stall: Stall) => (
                <StallCard
                  key={stall.slug}
                  stall={stall}
                  showCuisine
                  isFavorite={false}
                  isVisited={true}
                  relativeNow={generatedAt}
                  onToggleFavorite={() => {}}
                  onToggleVisited={() => {}}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="border-border bg-surface-card rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`${icon} ${color} text-lg`} />
        <span className="text-foreground-faint text-xs font-semibold tracking-wider uppercase">
          {label}
        </span>
      </div>
      <p className={`font-display text-2xl font-bold truncate ${color}`}>{value}</p>
    </div>
  );
}
