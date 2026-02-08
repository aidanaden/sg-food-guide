/**
 * User preferences — favorites and visited stalls stored in localStorage.
 */

const FAVORITES_KEY = 'sgfg-favorites';
const VISITED_KEY = 'sgfg-visited';

function getSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSet(key: string, set: Set<string>): void {
  localStorage.setItem(key, JSON.stringify([...set]));
}

// ─── Favorites ─────────────────────────────────────────

export function getFavorites(): Set<string> {
  return getSet(FAVORITES_KEY);
}

export function toggleFavorite(slug: string): boolean {
  const favs = getFavorites();
  const isFav = favs.has(slug);
  if (isFav) {
    favs.delete(slug);
  } else {
    favs.add(slug);
  }
  saveSet(FAVORITES_KEY, favs);
  return !isFav; // new state
}

export function isFavorite(slug: string): boolean {
  return getFavorites().has(slug);
}

// ─── Visited ───────────────────────────────────────────

export function getVisited(): Set<string> {
  return getSet(VISITED_KEY);
}

export function markVisited(slug: string): void {
  const visited = getVisited();
  visited.add(slug);
  saveSet(VISITED_KEY, visited);
}

export function isVisited(slug: string): boolean {
  return getVisited().has(slug);
}

export function toggleVisited(slug: string): boolean {
  const visited = getVisited();
  const was = visited.has(slug);
  if (was) {
    visited.delete(slug);
  } else {
    visited.add(slug);
  }
  saveSet(VISITED_KEY, visited);
  return !was;
}
