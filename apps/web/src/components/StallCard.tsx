import { Link } from '@tanstack/react-router';
import { Button } from '@sg-food-guide/ui';

import { type Stall, getRatingLabel, getRatingVariant, getStallArea } from '../lib/stall-utils';

type StallCardProps = {
  stall: Stall;
  showCuisine?: boolean;
  isFavorite: boolean;
  isVisited: boolean;
  onToggleFavorite: (slug: string) => void;
  onToggleVisited: (slug: string) => void;
};

export function StallCard({
  stall,
  showCuisine = false,
  isFavorite,
  isVisited,
  onToggleFavorite,
  onToggleVisited,
}: StallCardProps) {
  const rating = stall.ratingModerated;
  const ratingVariant = getRatingVariant(rating);
  const ratingLabel = getRatingLabel(rating);

  return (
    <article className="group relative rounded-xl border border-warm-800/60 bg-surface-card p-4 shadow-sm">
      <Link
        to="/stall/$slug"
        params={{ slug: stall.slug }}
        aria-label={`View details for ${stall.name}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:ring-flame-400 focus-visible:outline-none"
      />

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg leading-tight transition-colors group-hover:text-flame-400">
            {stall.name}
          </h3>
          <p className="mt-1 text-xs text-ink-faint">{getStallArea(stall)}</p>
          {showCuisine ? <p className="text-xs text-ink-faint">{stall.cuisineLabel}</p> : null}
        </div>

        <div className="text-right">
          <p className={`text-sm font-semibold ${ratingVariant}`}>{rating === null ? 'N/A' : `${rating}/3`}</p>
          <p className="text-xs text-ink-faint">{ratingLabel}</p>
          <p className="mt-1 text-sm font-mono text-flame-400">${stall.price.toFixed(stall.price % 1 ? 1 : 0)}</p>
        </div>
      </div>

      <p className="mb-3 text-sm text-ink-muted">{stall.dishName}</p>

      <div className="relative z-20 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onToggleVisited(stall.slug)}
          className="min-h-10 border-warm-700/50 bg-transparent text-ink-muted hover:border-flame-500/40 hover:text-flame-400"
        >
          <span className={isVisited ? 'i-ph-check-circle-fill text-jade-400' : 'i-ph-eye'} />
          {isVisited ? 'Visited' : 'Mark visited'}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onToggleFavorite(stall.slug)}
          className="min-h-10 border-warm-700/50 bg-transparent text-ink-muted hover:border-flame-500/40 hover:text-flame-400"
        >
          <span className={isFavorite ? 'i-ph-heart-fill text-flame-400' : 'i-ph-heart'} />
          {isFavorite ? 'Favourite' : 'Favourite'}
        </Button>
      </div>
    </article>
  );
}
