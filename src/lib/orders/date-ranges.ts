/**
 * Day-boundary helpers for "due today" / "due this week" filters
 * (specification Section 28).
 *
 * Pure. Uses UTC pending a configurable `business_timezone` system setting
 * (docs/ARCHITECTURE.md §10's documented default) — there is no Settings UI
 * yet to change it, so this is the one place to update when there is.
 */

export function todayRangeUtc(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Monday 00:00 through the following Monday 00:00, UTC. */
export function thisWeekRangeUtc(now: Date = new Date()): { start: Date; end: Date } {
  const { start: todayStart } = todayRangeUtc(now);
  const daysSinceMonday = (todayStart.getUTCDay() + 6) % 7;
  const start = new Date(todayStart.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}
