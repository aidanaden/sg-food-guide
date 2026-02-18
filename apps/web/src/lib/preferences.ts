import { Result } from 'better-result';
import { z } from 'zod';

const favoritesKey = 'sg-food-guide:favorites';
const visitedKey = 'sg-food-guide:visited';

const slugArraySchema = z.array(z.string().min(1));

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readSet(key: string): Set<string> {
  if (!canUseStorage()) return new Set<string>();

  const rawResult = Result.try(() => window.localStorage.getItem(key));
  if (Result.isError(rawResult) || !rawResult.value) return new Set<string>();

  const parseJsonResult = Result.try(() => JSON.parse(rawResult.value as string));
  if (Result.isError(parseJsonResult)) return new Set<string>();

  const parsed = slugArraySchema.safeParse(parseJsonResult.value);
  if (!parsed.success) return new Set<string>();

  return new Set(parsed.data);
}

function writeSet(key: string, values: Set<string>): void {
  if (!canUseStorage()) return;

  const payload = JSON.stringify([...values]);
  const writeResult = Result.try(() => window.localStorage.setItem(key, payload));
  if (Result.isError(writeResult)) {
    console.error(writeResult.error);
  }
}

export function getFavorites(): Set<string> {
  return readSet(favoritesKey);
}

export function getVisited(): Set<string> {
  return readSet(visitedKey);
}

export function toggleFavorite(slug: string): Set<string> {
  const next = getFavorites();
  if (next.has(slug)) next.delete(slug);
  else next.add(slug);
  writeSet(favoritesKey, next);
  return next;
}

export function toggleVisited(slug: string): Set<string> {
  const next = getVisited();
  if (next.has(slug)) next.delete(slug);
  else next.add(slug);
  writeSet(visitedKey, next);
  return next;
}

export function markVisited(slug: string): Set<string> {
  const next = getVisited();
  next.add(slug);
  writeSet(visitedKey, next);
  return next;
}
