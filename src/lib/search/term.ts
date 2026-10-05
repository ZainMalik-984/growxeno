/**
 * Pure search-term rules (no database, no `server-only`) so the cost limits are
 * unit-testable: a term shorter than MIN_TERM_LENGTH is refused rather than
 * scanning a table for a one-letter match; a term longer than MAX_TERM_LENGTH is
 * refused rather than sent to the database; and results per category are capped.
 */
export const MIN_TERM_LENGTH = 2;
export const MAX_TERM_LENGTH = 80;
export const PER_CATEGORY_LIMIT = 5;

/** Trimmed, whitespace-collapsed term, or null when it is too short/long to search. */
export function normalizeSearchTerm(raw: string): string | null {
  const term = raw.replace(/\s+/g, " ").trim();
  if (term.length < MIN_TERM_LENGTH || term.length > MAX_TERM_LENGTH) return null;
  return term;
}
