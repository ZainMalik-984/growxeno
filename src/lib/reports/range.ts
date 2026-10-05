/**
 * Pure range rules for Reports (specification Section 75: "Do not run huge
 * expensive report queries unnecessarily"). No database, no `server-only`.
 *
 * Every report takes a bounded `[start, end)` range: a custom range wider than
 * MAX_RANGE_DAYS is clamped to its most recent MAX_RANGE_DAYS rather than run
 * unbounded, and time-series reports pick a bucket size from the range so a
 * year is never returned as 365 daily rows.
 */
export const MAX_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Bucket = "day" | "week" | "month";

export function clampRange(range: { start: Date; end: Date }): { start: Date; end: Date; clamped: boolean } {
  const maxMs = MAX_RANGE_DAYS * DAY_MS;
  if (range.end.getTime() - range.start.getTime() <= maxMs) return { ...range, clamped: false };
  return { start: new Date(range.end.getTime() - maxMs), end: range.end, clamped: true };
}

export function chooseBucket(range: { start: Date; end: Date }): Bucket {
  const days = (range.end.getTime() - range.start.getTime()) / DAY_MS;
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}
