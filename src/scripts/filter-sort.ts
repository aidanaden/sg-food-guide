/**
 * Shared filter, sort, and search logic for stall listing pages.
 * Used by both index.astro and cuisine/[cuisine].astro.
 */
import { fuzzyMatch, highlightText } from './search';

interface CardCache {
  el: HTMLElement;
  nameEl: HTMLElement | null;
  dishEl: HTMLElement | null;
  nameText: string;
  dishText: string;
}

interface FilterElements {
  searchInput: HTMLInputElement;
  ratingFilter: HTMLSelectElement;
  areaFilter: HTMLSelectElement;
  timeFilter: HTMLSelectElement;
  cuisineFilter: HTMLSelectElement | null;
  countryFilter: HTMLSelectElement | null;
  favoritesFilter: HTMLInputElement | null;
  hideVisitedFilter: HTMLInputElement | null;
  sortBy: HTMLSelectElement;
  grid: HTMLElement;
  resultCount: HTMLElement;
  emptyState: HTMLElement;
  activeFiltersContainer: HTMLElement;
  clearFiltersBtn: HTMLButtonElement;
}

function getElements(): FilterElements {
  return {
    searchInput: document.getElementById('search') as HTMLInputElement,
    ratingFilter: document.getElementById('filter-rating') as HTMLSelectElement,
    areaFilter: document.getElementById('filter-area') as HTMLSelectElement,
    timeFilter: document.getElementById('filter-time') as HTMLSelectElement,
    cuisineFilter: document.getElementById('filter-cuisine') as HTMLSelectElement | null,
    countryFilter: document.getElementById('filter-country') as HTMLSelectElement | null,
    favoritesFilter: document.getElementById('filter-favorites') as HTMLInputElement | null,
    hideVisitedFilter: document.getElementById('filter-hide-visited') as HTMLInputElement | null,
    sortBy: document.getElementById('sort-by') as HTMLSelectElement,
    grid: document.getElementById('stall-grid') as HTMLElement,
    resultCount: document.getElementById('result-count') as HTMLElement,
    emptyState: document.getElementById('empty-state') as HTMLElement,
    activeFiltersContainer: document.getElementById('active-filters') as HTMLElement,
    clearFiltersBtn: document.getElementById('clear-filters') as HTMLButtonElement,
  };
}

function getCards(grid: HTMLElement): HTMLElement[] {
  return Array.from(grid.querySelectorAll('.stall-card')) as HTMLElement[];
}

function buildCache(grid: HTMLElement): CardCache[] {
  return getCards(grid).map((card) => {
    const el = card.closest('[data-name]') as HTMLElement || card;
    const nameEl = el.querySelector('h2');
    const dishEl = el.querySelector('p.text-ink-faint.text-xs') as HTMLElement | null;
    return {
      el,
      nameEl,
      dishEl,
      nameText: nameEl?.textContent || '',
      dishText: dishEl?.textContent || '',
    };
  });
}

function applyFilters(els: FilterElements, cache: CardCache[]): void {
  const query = els.searchInput.value.toLowerCase().trim();
  const rating = els.ratingFilter.value;
  const area = els.areaFilter.value;
  const time = els.timeFilter.value;
  const cuisine = els.cuisineFilter?.value || '';
  const country = els.countryFilter?.value || '';
  const onlyFavs = els.favoritesFilter?.checked || false;
  const hideVisited = els.hideVisitedFilter?.checked || false;
  let visible = 0;

  cache.forEach(({ el, nameEl, dishEl, nameText, dishText }) => {
    const name = el.dataset.name || '';
    const dish = el.dataset.dish || '';
    const address = el.dataset.address || '';
    const cardRating = el.dataset.rating || '';
    const cardArea = el.dataset.area || '';
    const cardTime = el.dataset.time || '';
    const cardCuisine = el.dataset.cuisine || '';
    const cardCountry = el.dataset.country || '';
    const cardFav = el.dataset.fav === 'true';
    const cardVisited = el.dataset.visited === 'true';

    const show =
      fuzzyMatch(query, [name, dish, address]) &&
      (!rating || cardRating === rating) &&
      (!area || cardArea === area) &&
      (!time || cardTime.split(',').includes(time)) &&
      (!cuisine || cardCuisine === cuisine) &&
      (!country || cardCountry === country) &&
      (!onlyFavs || cardFav) &&
      (!hideVisited || !cardVisited);

    (el.closest('.stall-card') as HTMLElement || el).style.display = show ? '' : 'none';
    if (show) visible++;

    // Search highlighting
    if (nameEl) nameEl.innerHTML = highlightText(nameText, query);
    if (dishEl) dishEl.innerHTML = highlightText(dishText, query);
  });

  els.resultCount.textContent = `Showing ${visible} of ${cache.length} stalls`;
  els.emptyState.classList.toggle('hidden', visible > 0);
  els.grid.classList.toggle('hidden', visible === 0);

  // Active filter chips
  const chips: string[] = [];
  if (query) chips.push(`Search: "${query}"`);
  if (rating) chips.push(`Rating: ${rating === 'unrated' ? 'Unrated' : rating + '/3'}`);
  if (area) chips.push(`Area: ${area}`);
  if (time) chips.push(`Hours: ${time}`);
  if (cuisine) chips.push(`Cuisine: ${cuisine}`);
  if (country) chips.push(`Country: ${country}`);

  if (chips.length) {
    els.activeFiltersContainer.classList.remove('hidden');
    els.activeFiltersContainer.classList.add('flex');
    els.activeFiltersContainer.innerHTML = chips
      .map((c) => `<span class="inline-flex items-center gap-1 rounded-full bg-warm-800/60 px-2.5 py-1 text-xs text-ink-muted">${c}</span>`)
      .join('');
  } else {
    els.activeFiltersContainer.classList.add('hidden');
    els.activeFiltersContainer.classList.remove('flex');
  }
}

function applySorting(els: FilterElements): void {
  const cards = getCards(els.grid);
  const sort = els.sortBy.value;

  cards.sort((a, b) => {
    const el = (c: HTMLElement) => c.closest('[data-rating]') as HTMLElement || c;
    const ratingA = el(a).dataset.rating || '0';
    const ratingB = el(b).dataset.rating || '0';
    const aR = ratingA === 'unrated' ? -1 : Number(ratingA);
    const bR = ratingB === 'unrated' ? -1 : Number(ratingB);
    const aP = Number(el(a).dataset.price);
    const bP = Number(el(b).dataset.price);
    const aE = Number(el(a).dataset.episode);
    const bE = Number(el(b).dataset.episode);
    const aA = el(a).dataset.awards === 'true' ? 1 : 0;
    const bA = el(b).dataset.awards === 'true' ? 1 : 0;

    switch (sort) {
      case 'rating-desc': return bR - aR || bA - aA;
      case 'rating-asc': return aR - bR;
      case 'price-asc': return aP - bP;
      case 'price-desc': return bP - aP;
      case 'episode-asc': return aE - bE;
      default: return 0;
    }
  });

  cards.forEach((card) => {
    const wrapper = card.closest('.stall-card') as HTMLElement || card;
    els.grid.appendChild(wrapper);
  });
}

function clearFilters(els: FilterElements, cache: CardCache[]): void {
  els.searchInput.value = '';
  els.ratingFilter.value = '';
  els.areaFilter.value = '';
  els.timeFilter.value = '';
  if (els.cuisineFilter) els.cuisineFilter.value = '';
  if (els.countryFilter) els.countryFilter.value = '';
  els.sortBy.value = 'rating-desc';
  applyFilters(els, cache);
  applySorting(els);
}

/**
 * Initialize filter/sort behavior for a stall listing page.
 * Call this from a <script> block on any page with the standard filter bar + stall grid.
 */
export function initFilterSort(): void {
  const els = getElements();

  // Apply default country filter
  if (els.countryFilter) {
    const defaultCountry = els.countryFilter.dataset.default || '';
    if (defaultCountry) els.countryFilter.value = defaultCountry;
  }

  const cache = buildCache(els.grid);

  // Event listeners
  els.searchInput.addEventListener('input', () => applyFilters(els, cache));
  els.ratingFilter.addEventListener('change', () => { applyFilters(els, cache); applySorting(els); });
  els.areaFilter.addEventListener('change', () => applyFilters(els, cache));
  els.timeFilter.addEventListener('change', () => applyFilters(els, cache));
  els.cuisineFilter?.addEventListener('change', () => applyFilters(els, cache));
  els.countryFilter?.addEventListener('change', () => applyFilters(els, cache));
  els.favoritesFilter?.addEventListener('change', () => applyFilters(els, cache));
  els.hideVisitedFilter?.addEventListener('change', () => applyFilters(els, cache));
  els.sortBy.addEventListener('change', () => applySorting(els));
  els.clearFiltersBtn.addEventListener('click', () => clearFilters(els, cache));

  // Initial render
  applyFilters(els, cache);
  applySorting(els);
}
