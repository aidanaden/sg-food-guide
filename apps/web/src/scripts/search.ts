/**
 * Lightweight fuzzy search + highlight utilities.
 *
 * fuzzyMatch: checks if all query terms appear (as substrings) in any of the
 * target fields.  Allows 1-char typos for terms >= 4 chars via Levenshtein
 * distance on individual words.
 *
 * highlightText: wraps matched substrings in <mark> tags.
 */

/** Simple Levenshtein distance (bounded — returns early if > maxDist). */
function levenshtein(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Check if a query term fuzzy-matches any word in the target string. */
function termMatchesField(term: string, field: string): boolean {
  // Exact substring match (fast path)
  if (field.includes(term)) return true;

  // For short terms, only do substring match
  if (term.length < 4) return false;

  // Fuzzy: check individual words with edit distance <= 1
  const words = field.split(/\s+/);
  for (const word of words) {
    if (levenshtein(term, word, 1) <= 1) return true;
    // Also check if term is a fuzzy prefix of a longer word
    if (word.length > term.length && levenshtein(term, word.slice(0, term.length), 1) <= 1) return true;
  }
  return false;
}

/**
 * Returns true if all space-separated query terms match at least one of the
 * provided fields (name, dish, address). Fields should be lowercase.
 */
export function fuzzyMatch(query: string, fields: string[]): boolean {
  if (!query) return true;
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return terms.every((term) => fields.some((field) => termMatchesField(term, field)));
}

/** Escape HTML special characters */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Wrap matched query substrings in <mark> tags. Non-destructive — preserves
 * original casing. Returns an HTML string.
 */
export function highlightText(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return escapeHtml(text);

  // Build a regex that matches any of the terms
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

  return escapeHtml(text).replace(regex, '<mark class="bg-flame-400/25 text-ink rounded-sm px-0.5">$1</mark>');
}
