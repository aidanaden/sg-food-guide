import { Link } from "@tanstack/react-router";

import { Button } from "@sg-food-guide/ui";

import {
  countryLabels,
  type Stall,
  formatRelativeStallTimestamp,
  getRatingLabel,
  getRatingVariant,
  getStallArea,
} from "../lib/stall-utils";

type StallCardProps = {
  stall: Stall;
  showCuisine?: boolean;
  isFavorite: boolean;
  isVisited: boolean;
  relativeNow: string;
  onToggleFavorite: (slug: string) => void;
  onToggleVisited: (slug: string) => void;
};

export function StallCard({
  stall,
  showCuisine = false,
  isFavorite,
  isVisited,
  relativeNow,
  onToggleFavorite,
  onToggleVisited,
}: StallCardProps) {
  const rating = stall.ratingModerated;
  const ratingVariant = getRatingVariant(rating);
  const ratingLabel = getRatingLabel(rating);
  const lastUpdatedAt = formatRelativeStallTimestamp(stall.lastScrapedAt, { now: relativeNow });
  const countryLabel = countryLabels[stall.country];
  const locationLabel =
    stall.country === "SG" ? `${getStallArea(stall)} | ${countryLabel}` : countryLabel;

  return (
    <article className="group border-border bg-surface-card relative rounded-xl border p-4 shadow-sm">
      <Link
        to="/stall/$slug"
        params={{ slug: stall.slug }}
        aria-label={`View details for ${stall.name}`}
        className="focus-visible:ring-primary absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:outline-none"
      />

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display group-hover:text-primary text-lg leading-tight transition-colors">
            {stall.name}
          </h3>
          <p className="text-foreground-faint mt-1 text-xs">{locationLabel}</p>
          {showCuisine ? (
            <p className="text-foreground-faint text-xs">{stall.cuisineLabel}</p>
          ) : null}
        </div>

        <div className="text-right">
          <p className={`text-sm font-semibold ${ratingVariant}`}>
            {rating === null ? "N/A" : `${rating}/3`}
          </p>
          <p className="text-foreground-faint text-xs">{ratingLabel}</p>
          <p className="text-primary mt-1 font-mono text-sm">
            ${stall.price.toFixed(stall.price % 1 ? 1 : 0)}
          </p>
        </div>
      </div>

      <p className="text-foreground-muted mb-3 text-sm">{stall.dishName}</p>
      <p className="text-foreground-faint mb-3 text-xs">Last updated {lastUpdatedAt}</p>

      <div className="relative z-20 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onToggleVisited(stall.slug)}
          className="border-border text-foreground-muted hover:border-primary hover:text-primary min-h-10 bg-transparent"
        >
          <span
            className={
              isVisited ? "iconify ph--check-circle-fill text-success-text" : "iconify ph--eye"
            }
          />
          {isVisited ? "Visited" : "Mark visited"}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onToggleFavorite(stall.slug)}
          className="border-border text-foreground-muted hover:border-primary hover:text-primary min-h-10 bg-transparent"
        >
          <span
            className={isFavorite ? "iconify ph--heart-fill text-primary" : "iconify ph--heart"}
          />
          {isFavorite ? "Favourite" : "Favourite"}
        </Button>
      </div>
    </article>
  );
}
