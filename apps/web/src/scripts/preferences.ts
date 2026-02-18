/**
 * User preferences — favorites and visited stalls stored in localStorage.
 */
import { Result } from 'better-result';
import * as z from 'zod/mini';

const FAVORITES_KEY = 'sgfg-favorites';
const VISITED_KEY = 'sgfg-visited';
const stringSetSchema = z.array(z.string());

function getSet(key: string): Set<string> {
  const storedResult = Result.try(() => localStorage.getItem(key));
  if (Result.isError(storedResult)) return new Set();

  const stored = storedResult.value;
  if (!stored) return new Set();

  const parsedResult = Result.try(() => JSON.parse(stored));
  if (Result.isError(parsedResult)) return new Set();

  const parsedSet = stringSetSchema.safeParse(parsedResult.value);
  if (!parsedSet.success) return new Set();

  return new Set(parsedSet.data);
}

function saveSet(key: string, set: Set<string>): void {
  Result.try(() => localStorage.setItem(key, JSON.stringify([...set])));
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
