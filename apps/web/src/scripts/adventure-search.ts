type ActivityType = 'horse_riding' | 'dirt_biking';

interface ActivityOption {
  id: string;
  activity: ActivityType;
  label: string;
  address: string;
  lat: number;
  lng: number;
  mapsUrl: string;
  source: 'nominatim';
}

interface ActivityGroup {
  activity: ActivityType;
  label: string;
  options: ActivityOption[];
}

interface AdventureSuccess {
  status: 'ok';
  query: {
    city: string;
    country: string;
    activities: ActivityType[];
    limit: number;
  };
  groups: ActivityGroup[];
  warnings: string[];
}

interface AdventureError {
  status: 'error';
  error: string;
}

type StatusTone = 'info' | 'error' | 'success';

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function clearChildren(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function setStatus(el: HTMLElement, message: string, tone: StatusTone = 'info'): void {
  el.textContent = message;
  el.classList.remove('hidden', 'text-ink-faint', 'text-flame-300', 'text-jade-400');
  if (tone === 'error') {
    el.classList.add('text-flame-300');
    return;
  }
  if (tone === 'success') {
    el.classList.add('text-jade-400');
    return;
  }
  el.classList.add('text-ink-faint');
}

function hideStatus(el: HTMLElement): void {
  el.textContent = '';
  el.classList.add('hidden');
}

function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function createResultCard(option: ActivityOption): HTMLElement {
  const card = document.createElement('article');
  card.className =
    'rounded-xl border border-warm-700/50 bg-surface-card p-4 flex flex-col gap-2';

  const title = document.createElement('h3');
  title.className = 'font-display text-base text-ink leading-tight';
  title.textContent = option.label;

  const address = document.createElement('p');
  address.className = 'text-sm text-ink-muted leading-relaxed';
  address.textContent = option.address || 'Address not available';

  const meta = document.createElement('div');
  meta.className = 'text-xs text-ink-faint flex flex-wrap items-center gap-2';
  meta.textContent = `Source: Nominatim | ${formatCoords(option.lat, option.lng)}`;

  const actions = document.createElement('div');
  actions.className = 'mt-1';

  const mapLink = document.createElement('a');
  mapLink.href = option.mapsUrl;
  mapLink.target = '_blank';
  mapLink.rel = 'noopener noreferrer';
  mapLink.className =
    'inline-flex min-h-11 items-center rounded-lg border border-flame-500/40 bg-flame-500/10 px-3 py-2 text-xs font-medium text-flame-400 hover:bg-flame-500/20 transition-colors';
  mapLink.textContent = 'Open in Google Maps';

  actions.appendChild(mapLink);
  card.append(title, address, meta, actions);
  return card;
}

function renderGroups(container: HTMLElement, groups: ActivityGroup[]): number {
  clearChildren(container);
  let total = 0;

  for (const group of groups) {
    const section = document.createElement('section');
    section.className = 'rounded-2xl border border-warm-700/60 bg-surface-raised p-4 sm:p-5';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between gap-3 mb-3';

    const heading = document.createElement('h2');
    heading.className = 'font-display text-xl text-ink';
    heading.textContent = group.label;

    const count = document.createElement('span');
    count.className = 'text-xs text-ink-faint';
    count.textContent = `${group.options.length} result${group.options.length === 1 ? '' : 's'}`;

    header.append(heading, count);
    section.appendChild(header);

    if (!group.options.length) {
      const empty = document.createElement('p');
      empty.className = 'text-sm text-ink-faint';
      empty.textContent = 'No matches found for this activity.';
      section.appendChild(empty);
      container.appendChild(section);
      continue;
    }

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 lg:grid-cols-2 gap-3';
    for (const option of group.options) {
      grid.appendChild(createResultCard(option));
      total += 1;
    }
    section.appendChild(grid);
    container.appendChild(section);
  }

  return total;
}

function parsePayload(value: unknown): AdventureSuccess | AdventureError | null {
  if (!value || typeof value !== 'object') return null;
  const status = (value as { status?: string }).status;
  if (status !== 'ok' && status !== 'error') return null;
  return value as AdventureSuccess | AdventureError;
}

export function initAdventureSearch(): void {
  const form = byId<HTMLFormElement>('adventure-search-form');
  const fieldset = byId<HTMLFieldSetElement>('adventure-search-fieldset');
  const cityInput = byId<HTMLInputElement>('adventure-city');
  const countryInput = byId<HTMLInputElement>('adventure-country');
  const horseCheckbox = byId<HTMLInputElement>('adventure-horse-riding');
  const dirtCheckbox = byId<HTMLInputElement>('adventure-dirt-biking');
  const limitSelect = byId<HTMLSelectElement>('adventure-limit');
  const status = byId<HTMLElement>('adventure-status');
  const warnings = byId<HTMLElement>('adventure-warnings');
  const results = byId<HTMLElement>('adventure-results');

  if (
    !form ||
    !fieldset ||
    !cityInput ||
    !countryInput ||
    !horseCheckbox ||
    !dirtCheckbox ||
    !limitSelect ||
    !status ||
    !warnings ||
    !results
  ) {
    return;
  }

  const setBusy = (busy: boolean): void => {
    fieldset.disabled = busy;
  };

  const getSelectedActivities = (): ActivityType[] => {
    const selected: ActivityType[] = [];
    if (horseCheckbox.checked) selected.push('horse_riding');
    if (dirtCheckbox.checked) selected.push('dirt_biking');
    return selected;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const city = cityInput.value.trim();
    const country = countryInput.value.trim();
    const activities = getSelectedActivities();
    const limit = limitSelect.value || '8';

    clearChildren(warnings);
    clearChildren(results);

    if (!city || !country) {
      setStatus(status, 'City and country are required.', 'error');
      return;
    }

    if (!activities.length) {
      setStatus(status, 'Select at least one activity type.', 'error');
      return;
    }

    setBusy(true);
    setStatus(status, 'Researching activity options...');

    try {
      const params = new URLSearchParams({
        city,
        country,
        activities: activities.join(','),
        limit,
      });
      const response = await fetch(`/api/adventure/search?${params.toString()}`, {
        headers: { accept: 'application/json' },
      });

      const payload = parsePayload(await response.json());
      if (!payload) {
        throw new Error('Unexpected API response.');
      }
      if (payload.status === 'error') {
        throw new Error(payload.error || 'Search failed.');
      }

      const total = renderGroups(results, payload.groups);

      for (const warning of payload.warnings) {
        const item = document.createElement('li');
        item.className = 'text-sm text-ink-faint';
        item.textContent = warning;
        warnings.appendChild(item);
      }

      if (payload.warnings.length) {
        warnings.classList.remove('hidden');
      } else {
        warnings.classList.add('hidden');
      }

      setStatus(
        status,
        `Found ${total} option${total === 1 ? '' : 's'} in ${payload.query.city}, ${payload.query.country}.`,
        'success'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to complete research.';
      setStatus(status, message, 'error');
    } finally {
      setBusy(false);
    }
  });

  hideStatus(status);
}
