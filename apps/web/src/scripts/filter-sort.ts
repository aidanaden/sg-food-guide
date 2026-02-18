/**
 * Shared filter, sort, and search logic for stall listing pages.
 * Used by both index.astro and cuisine/[cuisine].astro.
 */
import { Result } from 'better-result';
import * as z from 'zod/mini';
import { fuzzyMatch, highlightText } from './search';
import { lookupSgArea, normalizeAreaLikeQuery } from '../data/sg-areas';

const FILTER_STATE_KEY = 'sgfg-filter-state-v2';

interface CardCache {
  el: HTMLElement;
  nameEl: HTMLElement | null;
  dishEl: HTMLElement | null;
  nameText: string;
  dishText: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

interface GeocodeSuccessPayload {
  status: 'ok';
  source: 'onemap' | 'nominatim';
  lat: number;
  lng: number;
  label: string;
}

interface PersistedFilterState {
  q?: string;
  rating?: string;
  area?: string;
  time?: string;
  cuisine?: string;
  country?: string;
  fav?: '1' | '0';
  hideVisited?: '1' | '0';
  sort?: string;
  near?: '1' | '0';
  radius?: string;
  locq?: string;
}

interface LocationState {
  enabled: boolean;
  mode: 'off' | 'locating' | 'geolocation' | 'manual-query';
  center: Coordinates | null;
  radiusKm: number;
  query: string;
  debounceTimer: number | null;
  requestSeq: number;
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
  nearbyToggle: HTMLButtonElement | null;
  locationControls: HTMLElement | null;
  locationRadius: HTMLSelectElement | null;
  locationQueryWrap: HTMLElement | null;
  locationQueryInput: HTMLInputElement | null;
  locationStatus: HTMLElement | null;
  grid: HTMLElement;
  resultCount: HTMLElement;
  emptyState: HTMLElement;
  activeFiltersContainer: HTMLElement;
  activeFiltersSummary: HTMLElement;
  activeFiltersClearBtn: HTMLButtonElement | null;
  emptyStateClearBtn: HTMLButtonElement | null;
}

const persistedFilterStateSchema = z.object({
  q: z.optional(z.string()),
  rating: z.optional(z.string()),
  area: z.optional(z.string()),
  time: z.optional(z.string()),
  cuisine: z.optional(z.string()),
  country: z.optional(z.string()),
  fav: z.optional(z.string()),
  hideVisited: z.optional(z.string()),
  sort: z.optional(z.string()),
  near: z.optional(z.string()),
  radius: z.optional(z.string()),
  locq: z.optional(z.string()),
});
const geocodeSuccessSchema = z.object({
  status: z.literal('ok'),
  source: z.enum(['onemap', 'nominatim']),
  lat: z.union([z.number(), z.string()]),
  lng: z.union([z.number(), z.string()]),
  label: z.optional(z.string()),
});

function coercePersistedState(value: unknown): PersistedFilterState {
  const parsed = persistedFilterStateSchema.safeParse(value);
  if (!parsed.success) return {};

  const data = parsed.data;
  return {
    q: data.q,
    rating: data.rating,
    area: data.area,
    time: data.time,
    cuisine: data.cuisine,
    country: data.country,
    fav: data.fav === '1' || data.fav === '0' ? data.fav : undefined,
    hideVisited: data.hideVisited === '1' || data.hideVisited === '0' ? data.hideVisited : undefined,
    sort: data.sort,
    near: data.near === '1' || data.near === '0' ? data.near : undefined,
    radius: data.radius,
    locq: data.locq,
  };
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
    nearbyToggle: document.getElementById('filter-nearby-toggle') as HTMLButtonElement | null,
    locationControls: document.getElementById('filter-location-controls') as HTMLElement | null,
    locationRadius: document.getElementById('filter-location-radius') as HTMLSelectElement | null,
    locationQueryWrap: document.getElementById('filter-location-query-wrap') as HTMLElement | null,
    locationQueryInput: document.getElementById('filter-location-query') as HTMLInputElement | null,
    locationStatus: document.getElementById('filter-location-status') as HTMLElement | null,
    grid: document.getElementById('stall-grid') as HTMLElement,
    resultCount: document.getElementById('result-count') as HTMLElement,
    emptyState: document.getElementById('empty-state') as HTMLElement,
    activeFiltersContainer: document.getElementById('active-filters') as HTMLElement,
    activeFiltersSummary: document.getElementById('active-filters-summary') as HTMLElement,
    activeFiltersClearBtn: document.getElementById('active-filters-clear') as HTMLButtonElement | null,
    emptyStateClearBtn: document.getElementById('clear-filters') as HTMLButtonElement | null,
  };
}

function getCards(grid: HTMLElement): HTMLElement[] {
  return Array.from(grid.querySelectorAll('.stall-card')) as HTMLElement[];
}

function buildCache(grid: HTMLElement): CardCache[] {
  return getCards(grid).map((card) => {
    const el = (card.closest('[data-name]') as HTMLElement) || card;
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

function matchesRatingFilter(selectedRating: string, cardRating: string): boolean {
  if (!selectedRating) return true;
  if (selectedRating === '1') {
    // "Skip" should include explicit 0/3 and 1/3 ratings.
    return cardRating === '0' || cardRating === '1';
  }
  return cardRating === selectedRating;
}

function hasValidCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

function haversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function setSelectValue(selectEl: HTMLSelectElement | null, value: string): void {
  if (!selectEl || !value) return;
  const hasOption = Array.from(selectEl.options).some((opt) => opt.value === value);
  if (hasOption) selectEl.value = value;
}

function parseBool(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

function safeRadius(value: string | undefined, fallback: number): number {
  const radius = Number(value);
  if (!Number.isFinite(radius) || radius <= 0) return fallback;
  return Math.max(0.5, Math.min(30, radius));
}

function getDefaultCountry(els: FilterElements): string {
  return els.countryFilter?.dataset.default || '';
}

function getDefaultRadius(els: FilterElements): number {
  const fromSelect = els.locationRadius?.dataset.default;
  const fromBtn = els.nearbyToggle?.dataset.defaultRadius;
  const selected = fromSelect || fromBtn;
  return safeRadius(selected, 3);
}

function setLocationStatus(els: FilterElements, message: string, error = false): void {
  if (!els.locationStatus) return;
  const text = message.trim();
  if (!text) {
    els.locationStatus.textContent = '';
    els.locationStatus.classList.add('hidden');
    els.locationStatus.classList.remove('text-flame-300', 'text-ink-faint');
    els.locationStatus.classList.add('text-ink-faint');
    return;
  }

  els.locationStatus.textContent = text;
  els.locationStatus.classList.remove('hidden');
  els.locationStatus.classList.remove('text-flame-300', 'text-ink-faint');
  els.locationStatus.classList.add(error ? 'text-flame-300' : 'text-ink-faint');
}

function syncLocationUi(els: FilterElements, state: LocationState): void {
  if (!els.nearbyToggle) return;

  const active = state.enabled;
  els.nearbyToggle.classList.toggle('border-flame-500/50', active);
  els.nearbyToggle.classList.toggle('text-flame-400', active);
  els.nearbyToggle.classList.toggle('bg-flame-500/10', active);

  if (els.locationControls) {
    els.locationControls.classList.toggle('hidden', !active);
    els.locationControls.classList.toggle('flex', active);
  }

  if (els.locationRadius) {
    els.locationRadius.value = String(state.radiusKm);
  }

  const showManualInput = active && state.mode === 'manual-query';
  if (els.locationQueryWrap) {
    els.locationQueryWrap.classList.toggle('hidden', !showManualInput);
    els.locationQueryWrap.classList.toggle('flex', showManualInput);
  }
}

function applyFilters(els: FilterElements, cache: CardCache[], locationState: LocationState): void {
  const query = els.searchInput.value.toLowerCase().trim();
  const rating = els.ratingFilter.value;
  const area = els.areaFilter.value;
  const time = els.timeFilter.value;
  const cuisine = els.cuisineFilter?.value || '';
  const country = els.countryFilter?.value || '';
  const defaultCountry = getDefaultCountry(els);
  const onlyFavs = els.favoritesFilter?.checked || false;
  const hideVisited = els.hideVisitedFilter?.checked || false;
  const hasLocationFilter = locationState.enabled && !!locationState.center;
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
    const cardLat = Number(el.dataset.lat || '0');
    const cardLng = Number(el.dataset.lng || '0');

    let withinRadius = true;
    if (hasLocationFilter && locationState.center) {
      withinRadius =
        hasValidCoords(cardLat, cardLng) &&
        haversineKm(locationState.center, { lat: cardLat, lng: cardLng }) <= locationState.radiusKm;
    }

    const show =
      fuzzyMatch(query, [name, dish, address]) &&
      matchesRatingFilter(rating, cardRating) &&
      (!area || cardArea === area) &&
      (!time || cardTime.split(',').includes(time)) &&
      (!cuisine || cardCuisine === cuisine) &&
      (!country || cardCountry === country) &&
      (!onlyFavs || cardFav) &&
      (!hideVisited || !cardVisited) &&
      withinRadius;

    ((el.closest('.stall-card') as HTMLElement) || el).style.display = show ? '' : 'none';
    if (show) visible++;

    if (nameEl) nameEl.innerHTML = highlightText(nameText, query);
    if (dishEl) dishEl.innerHTML = highlightText(dishText, query);
  });

  els.resultCount.textContent = `Showing ${visible} of ${cache.length} stalls`;
  els.emptyState.classList.toggle('hidden', visible > 0);
  els.grid.classList.toggle('hidden', visible === 0);

  let activeFilterCount = 0;
  if (query) activeFilterCount++;
  if (rating) activeFilterCount++;
  if (area) activeFilterCount++;
  if (time) activeFilterCount++;
  if (cuisine) activeFilterCount++;
  if (country && country !== defaultCountry) activeFilterCount++;
  if (onlyFavs) activeFilterCount++;
  if (hideVisited) activeFilterCount++;
  if (locationState.enabled) activeFilterCount++;

  if (activeFilterCount > 0) {
    els.activeFiltersContainer.classList.remove('hidden');
    els.activeFiltersContainer.classList.add('flex');
    els.activeFiltersSummary.textContent = `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`;
  } else {
    els.activeFiltersContainer.classList.add('hidden');
    els.activeFiltersContainer.classList.remove('flex');
    els.activeFiltersSummary.textContent = '';
  }
}

function applySorting(els: FilterElements): void {
  const cards = getCards(els.grid);
  const sort = els.sortBy.value;

  cards.sort((a, b) => {
    const el = (c: HTMLElement) => (c.closest('[data-rating]') as HTMLElement) || c;
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
      case 'rating-desc':
        return bR - aR || bA - aA;
      case 'rating-asc':
        return aR - bR;
      case 'price-asc':
        return aP - bP;
      case 'price-desc':
        return bP - aP;
      case 'episode-asc':
        return aE - bE;
      default:
        return 0;
    }
  });

  cards.forEach((card) => {
    const wrapper = (card.closest('.stall-card') as HTMLElement) || card;
    els.grid.appendChild(wrapper);
  });
}

function collectState(els: FilterElements, locationState: LocationState): PersistedFilterState {
  return {
    q: els.searchInput.value.trim() || undefined,
    rating: els.ratingFilter.value || undefined,
    area: els.areaFilter.value || undefined,
    time: els.timeFilter.value || undefined,
    cuisine: els.cuisineFilter?.value || undefined,
    country: (() => {
      const val = els.countryFilter?.value || '';
      return val && val !== getDefaultCountry(els) ? val : undefined;
    })(),
    fav: els.favoritesFilter?.checked ? '1' : undefined,
    hideVisited: els.hideVisitedFilter?.checked ? '1' : undefined,
    sort: els.sortBy.value !== 'rating-desc' ? els.sortBy.value : undefined,
    near: locationState.enabled ? '1' : undefined,
    radius: locationState.enabled ? String(locationState.radiusKm) : undefined,
    locq: locationState.query || undefined,
  };
}

function persistState(els: FilterElements, locationState: LocationState): void {
  const state = collectState(els, locationState);
  Result.try(() => sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify(state)));

  const params = new URLSearchParams();
  Object.entries(state).forEach(([key, value]) => {
    if (!value) return;
    params.set(key, value);
  });

  const qs = params.toString();
  const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', nextUrl);
}

function readPersistedState(): PersistedFilterState {
  const sessionGetResult = Result.try(() => sessionStorage.getItem(FILTER_STATE_KEY));
  const sessionRaw = Result.isOk(sessionGetResult) ? sessionGetResult.value : null;
  const sessionParseResult = sessionRaw
    ? Result.try(() => JSON.parse(sessionRaw))
    : null;
  const sessionState = sessionParseResult && Result.isOk(sessionParseResult)
    ? coercePersistedState(sessionParseResult.value)
    : {};

  const fromUrl = coercePersistedState(
    Object.fromEntries(new URLSearchParams(window.location.search).entries())
  );
  return { ...sessionState, ...fromUrl };
}

function clearFilters(els: FilterElements, cache: CardCache[], locationState: LocationState): void {
  els.searchInput.value = '';
  els.ratingFilter.value = '';
  els.areaFilter.value = '';
  els.timeFilter.value = '';
  if (els.cuisineFilter) els.cuisineFilter.value = '';
  if (els.countryFilter) {
    els.countryFilter.value = getDefaultCountry(els);
  }
  if (els.favoritesFilter) els.favoritesFilter.checked = false;
  if (els.hideVisitedFilter) els.hideVisitedFilter.checked = false;
  els.sortBy.value = 'rating-desc';

  locationState.requestSeq += 1;
  if (locationState.debounceTimer !== null) {
    window.clearTimeout(locationState.debounceTimer);
    locationState.debounceTimer = null;
  }
  locationState.enabled = false;
  locationState.mode = 'off';
  locationState.center = null;
  locationState.query = '';
  locationState.radiusKm = getDefaultRadius(els);
  if (els.locationQueryInput) els.locationQueryInput.value = '';
  setLocationStatus(els, '');
  syncLocationUi(els, locationState);

  applyFilters(els, cache, locationState);
  applySorting(els);
  persistState(els, locationState);
}

function getCountryBias(els: FilterElements): string {
  const selected = els.countryFilter?.value || getDefaultCountry(els);
  return selected || 'SG';
}

async function geocodeLocation(query: string, country: string): Promise<GeocodeSuccessPayload | null> {
  const normalizedQuery = normalizeAreaLikeQuery(query);
  if (country === 'SG') {
    const sgArea = lookupSgArea(normalizedQuery);
    if (sgArea) {
      return {
        status: 'ok',
        source: 'nominatim',
        lat: sgArea.lat,
        lng: sgArea.lng,
        label: sgArea.label,
      };
    }
  }

  const params = new URLSearchParams({
    q: normalizedQuery,
    country,
  });

  const responseResult = await Result.tryPromise(() => fetch(`/api/geocode/search?${params.toString()}`, {
    headers: { accept: 'application/json' },
  }));
  if (Result.isError(responseResult)) return null;

  const response = responseResult.value;
  if (!response.ok) return null;

  const payloadResult = await Result.tryPromise(() => response.json());
  if (Result.isError(payloadResult)) return null;

  const payload = geocodeSuccessSchema.safeParse(payloadResult.value);
  if (!payload.success) return null;

  const lat = Number(payload.data.lat);
  const lng = Number(payload.data.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    status: 'ok',
    source: payload.data.source,
    lat,
    lng,
    label: String(payload.data.label || query).trim() || query,
  };
}

/**
 * Initialize filter/sort behavior for a stall listing page.
 * Call this from a <script> block on any page with the standard filter bar + stall grid.
 */
export function initFilterSort(): void {
  const els = getElements();

  if (els.countryFilter) {
    const defaultCountry = getDefaultCountry(els);
    if (defaultCountry) els.countryFilter.value = defaultCountry;
  }
  if (els.locationRadius) {
    els.locationRadius.value = String(getDefaultRadius(els));
  }

  const locationState: LocationState = {
    enabled: false,
    mode: 'off',
    center: null,
    radiusKm: getDefaultRadius(els),
    query: '',
    debounceTimer: null,
    requestSeq: 0,
  };
  const cache = buildCache(els.grid);
  let hydrating = false;

  const render = (resort = false): void => {
    applyFilters(els, cache, locationState);
    if (resort) applySorting(els);
    if (!hydrating) persistState(els, locationState);
  };

  const invalidateLocationRequests = (): void => {
    locationState.requestSeq += 1;
    if (locationState.debounceTimer !== null) {
      window.clearTimeout(locationState.debounceTimer);
      locationState.debounceTimer = null;
    }
  };

  const runManualGeocode = (): void => {
    const raw = els.locationQueryInput?.value.trim() || '';
    locationState.query = raw;
    locationState.mode = 'manual-query';
    locationState.enabled = true;
    syncLocationUi(els, locationState);
    invalidateLocationRequests();

    if (raw.length < 2) {
      locationState.center = null;
      setLocationStatus(els, raw ? 'Enter at least 2 characters for location search.' : 'Enter an area name for fallback location search.');
      render();
      return;
    }

    setLocationStatus(els, 'Searching location...');
    const seq = locationState.requestSeq;
    locationState.debounceTimer = window.setTimeout(async () => {
      const result = await geocodeLocation(raw, getCountryBias(els));
      if (
        seq !== locationState.requestSeq ||
        !locationState.enabled ||
        locationState.mode !== 'manual-query'
      ) {
        return;
      }

      if (!result) {
        locationState.center = null;
        setLocationStatus(els, 'Location not found. Try a broader area name.', true);
        render();
        return;
      }

      locationState.center = { lat: result.lat, lng: result.lng };
      const sourceLabel = result.source === 'onemap' ? 'OneMap' : 'Nominatim';
      setLocationStatus(els, `Using ${result.label} (${sourceLabel})`);
      render();
    }, 350);
  };

  const startNearMe = (): void => {
    if (!els.nearbyToggle) return;

    invalidateLocationRequests();
    locationState.enabled = true;
    locationState.query = '';
    if (els.locationQueryInput) els.locationQueryInput.value = '';

    if (!('geolocation' in navigator)) {
      locationState.mode = 'manual-query';
      locationState.center = null;
      syncLocationUi(els, locationState);
      setLocationStatus(els, 'Geolocation unavailable. Enter an area name instead.', true);
      render();
      return;
    }

    locationState.mode = 'locating';
    locationState.center = null;
    syncLocationUi(els, locationState);
    setLocationStatus(els, 'Locating...');
    render();
    const seq = locationState.requestSeq;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (
          seq !== locationState.requestSeq ||
          !locationState.enabled ||
          locationState.mode !== 'locating'
        ) {
          return;
        }
        locationState.mode = 'geolocation';
        locationState.center = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        syncLocationUi(els, locationState);
        setLocationStatus(els, 'Using current location');
        render();
      },
      () => {
        if (
          seq !== locationState.requestSeq ||
          !locationState.enabled ||
          locationState.mode !== 'locating'
        ) {
          return;
        }
        locationState.mode = 'manual-query';
        locationState.center = null;
        syncLocationUi(els, locationState);
        setLocationStatus(els, 'Location denied/unavailable. Enter an area name.', true);
        render();
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 120000,
      }
    );
  };

  const stopNearMe = (): void => {
    invalidateLocationRequests();
    locationState.enabled = false;
    locationState.mode = 'off';
    locationState.center = null;
    locationState.query = '';
    if (els.locationQueryInput) els.locationQueryInput.value = '';
    setLocationStatus(els, '');
    syncLocationUi(els, locationState);
    render();
  };

  const hydrate = (): void => {
    hydrating = true;
    const state = readPersistedState();

    if (typeof state.q === 'string') els.searchInput.value = state.q;
    if (typeof state.rating === 'string') setSelectValue(els.ratingFilter, state.rating);
    if (typeof state.area === 'string') setSelectValue(els.areaFilter, state.area);
    if (typeof state.time === 'string') setSelectValue(els.timeFilter, state.time);
    if (typeof state.cuisine === 'string') setSelectValue(els.cuisineFilter, state.cuisine);
    if (typeof state.country === 'string') setSelectValue(els.countryFilter, state.country);
    if (els.favoritesFilter) els.favoritesFilter.checked = parseBool(state.fav);
    if (els.hideVisitedFilter) els.hideVisitedFilter.checked = parseBool(state.hideVisited);
    if (typeof state.sort === 'string') setSelectValue(els.sortBy, state.sort);

    const nearEnabled = parseBool(state.near);
    if (nearEnabled && els.nearbyToggle) {
      locationState.enabled = true;
      locationState.radiusKm = safeRadius(state.radius, getDefaultRadius(els));
      if (els.locationRadius) setSelectValue(els.locationRadius, String(locationState.radiusKm));

      if (typeof state.locq === 'string' && state.locq.trim()) {
        locationState.mode = 'manual-query';
        locationState.query = state.locq.trim();
        if (els.locationQueryInput) els.locationQueryInput.value = locationState.query;
        syncLocationUi(els, locationState);
        setLocationStatus(els, 'Restored manual location filter');
      } else {
        locationState.mode = 'off';
        syncLocationUi(els, locationState);
      }
    } else {
      syncLocationUi(els, locationState);
      setLocationStatus(els, '');
    }

    applyFilters(els, cache, locationState);
    applySorting(els);
    hydrating = false;

    if (nearEnabled && locationState.query) {
      runManualGeocode();
    } else if (nearEnabled) {
      startNearMe();
    }
  };

  els.searchInput.addEventListener('input', () => render());
  els.ratingFilter.addEventListener('change', () => render(true));
  els.areaFilter.addEventListener('change', () => render());
  els.timeFilter.addEventListener('change', () => render());
  els.cuisineFilter?.addEventListener('change', () => render());
  els.countryFilter?.addEventListener('change', () => {
    if (locationState.enabled && locationState.mode === 'manual-query' && locationState.query) {
      runManualGeocode();
      return;
    }
    render();
  });
  els.favoritesFilter?.addEventListener('change', () => render());
  els.hideVisitedFilter?.addEventListener('change', () => render());
  els.sortBy.addEventListener('change', () => {
    applySorting(els);
    if (!hydrating) persistState(els, locationState);
  });

  els.nearbyToggle?.addEventListener('click', () => {
    if (locationState.enabled) {
      stopNearMe();
    } else {
      startNearMe();
    }
  });
  els.locationRadius?.addEventListener('change', () => {
    locationState.radiusKm = safeRadius(els.locationRadius?.value, getDefaultRadius(els));
    render();
  });
  els.locationQueryInput?.addEventListener('input', () => runManualGeocode());

  els.activeFiltersClearBtn?.addEventListener('click', () => clearFilters(els, cache, locationState));
  els.emptyStateClearBtn?.addEventListener('click', () => clearFilters(els, cache, locationState));

  hydrate();
}
