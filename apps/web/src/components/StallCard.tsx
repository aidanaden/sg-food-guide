import { Link } from '@tanstack/react-router';
import { Button } from '@sg-food-guide/ui';

import {
  type Stall,
  formatRelativeStallTimestamp,
  formatStallTimestamp,
  getRatingLabel,
  getRatingVariant,
  getStallArea,
} from '../lib/stall-utils';

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
  const addedAt = formatStallTimestamp(stall.addedAt);
  const lastScrapedAt = formatRelativeStallTimestamp(stall.lastScrapedAt, { now: relativeNow });

  return (
    <article className="group relative rounded-xl border border-border bg-surface-card p-4 shadow-sm">
      <Link
        to="/stall/$slug"
        params={{ slug: stall.slug }}
        aria-label={`View details for ${stall.name}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      />

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg leading-tight transition-colors group-hover:text-primary">
            {stall.name}
          </h3>
          <p className="mt-1 text-xs text-foreground-faint">{getStallArea(stall)}</p>
          {showCuisine ? <p className="text-xs text-foreground-faint">{stall.cuisineLabel}</p> : null}
        </div>

        <div className="text-right">
          <p className={`text-sm font-semibold ${ratingVariant}`}>{rating === null ? 'N/A' : `${rating}/3`}</p>
          <p className="text-xs text-foreground-faint">{ratingLabel}</p>
          <p className="mt-1 text-sm font-mono text-primary">${stall.price.toFixed(stall.price % 1 ? 1 : 0)}</p>
        </div>
      </div>

      <p className="mb-3 text-sm text-foreground-muted">{stall.dishName}</p>
      <p className="mb-3 text-xs text-foreground-faint">Added {addedAt} · Last scraped {lastScrapedAt}</p>

      <div className="relative z-20 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onToggleVisited(stall.slug)}
          className="min-h-10 border-border bg-transparent text-foreground-muted hover:border-primary hover:text-primary"
        >
          <span className={isVisited ? 'iconify ph--check-circle-fill text-success-text' : 'iconify ph--eye'} />
          {isVisited ? 'Visited' : 'Mark visited'}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onToggleFavorite(stall.slug)}
          className="min-h-10 border-border bg-transparent text-foreground-muted hover:border-primary hover:text-primary"
        >
          <span className={isFavorite ? 'iconify ph--heart-fill text-primary' : 'iconify ph--heart'} />
          {isFavorite ? 'Favourite' : 'Favourite'}
        </Button>
      </div>
    </article>
  );
}
