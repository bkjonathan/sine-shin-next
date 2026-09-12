// Query-string helpers for list endpoints (AUDIT.md F-26).

/**
 * A whole number from a query-string value, clamped to [min, max]; `fallback`
 * when the value is missing or isn't a finite number. Number() alone let
 * "abc" through as NaN, which drizzle drops from LIMIT (so every row came back),
 * and let "1e308" or "2.5" reach Postgres as an invalid LIMIT or OFFSET.
 */
export function intParam(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null || value.trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * An ILIKE pattern matching `term` anywhere in the value, with the term's own
 * %, _ and \ matched as themselves instead of as wildcards (\ is Postgres's
 * default LIKE escape character).
 */
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`;
}
