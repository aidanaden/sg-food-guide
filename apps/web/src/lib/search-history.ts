const SEARCH_HISTORY_KEY = "sg-food-guide-search-history";
const MAX_HISTORY_ITEMS = 10;

/**
 * Get search history from localStorage
 */
export function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Add a search query to history
 */
export function addToSearchHistory(query: string): void {
  if (typeof window === "undefined") return;
  if (!query.trim()) return;

  try {
    const history = getSearchHistory();
    // Remove if already exists (to move to top)
    const filtered = history.filter((h) => h.toLowerCase() !== query.toLowerCase());
    // Add to front
    const updated = [query.trim(), ...filtered].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail if localStorage is not available
  }
}

/**
 * Clear all search history
 */
export function clearSearchHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    // Silently fail
  }
}

/**
 * Remove a single item from search history
 */
export function removeFromSearchHistory(query: string): void {
  if (typeof window === "undefined") return;
  try {
    const history = getSearchHistory();
    const filtered = history.filter((h) => h.toLowerCase() !== query.toLowerCase());
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
  } catch {
    // Silently fail
  }
}
