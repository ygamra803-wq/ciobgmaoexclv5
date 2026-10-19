/**
 * Search Utilities for CIOB GMAO Light
 * High-performance, zero-dependency search, fuzzy filtering, and multi-token matching.
 */

/**
 * Normalizes text for accent-insensitive and case-insensitive comparison
 */
export function normalizeSearchString(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Multi-token search: all search words must be found in at least one of the item's target fields
 * @param {Object} item - The object to test
 * @param {string[]} fields - The keys of the item to inspect
 * @param {string} query - The raw search query string
 * @returns {boolean} True if all query tokens match
 */
export function multiTokenSearch(item, fields, query) {
  if (!query || !query.trim()) return true;
  if (!item) return false;

  const normalizedQuery = normalizeSearchString(query);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) return true;

  // Build combined searchable string from target fields
  const combined = fields
    .map((field) => normalizeSearchString(item[field]))
    .join(' ');

  return tokens.every((token) => combined.includes(token));
}

/**
 * Fuzzy search match algorithm: checks if pattern characters appear sequentially
 * @param {string} text - The haystack
 * @param {string} pattern - The needle
 * @returns {boolean} True if pattern matches
 */
export function fuzzyMatch(text, pattern) {
  if (!pattern) return true;
  if (!text) return false;

  const normText = normalizeSearchString(text);
  const normPattern = normalizeSearchString(pattern);

  let patternIdx = 0;
  for (let i = 0; i < normText.length && patternIdx < normPattern.length; i++) {
    if (normText[i] === normPattern[patternIdx]) {
      patternIdx++;
    }
  }

  return patternIdx === normPattern.length;
}
