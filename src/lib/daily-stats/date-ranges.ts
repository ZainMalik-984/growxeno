import { todayRangeUtc } from "@/lib/orders/date-ranges";

/**
 * Range presets for the Daily Statistics dashboard (specification Section
 * 55: Today / 7 Days / 30 Days / 90 Days / Custom range).
 *
 * Pure — see the reasoning in `src/lib/orders/date-ranges.ts`, which this
 * builds on rather than duplicating the UTC day-boundary logic.
 */

export type RangePreset = "today" | "7d" | "30d" | "90d" | "custom";

export function lastNDaysRangeUtc(days: number, now: Date = new Date()): { start: Date; end: Date } {
  const { end } = todayRangeUtc(now);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Resolves a preset (or an explicit `from`/`to` pair for "custom") to a
 * concrete `[start, end)` UTC range. Falls back to "7d" for an unrecognised
 * or missing preset rather than silently showing everything.
 */
export function resolveStatsRange(
  preset: RangePreset | undefined,
  custom: { from?: string; to?: string },
  now: Date = new Date(),
): { start: Date; end: Date } {
  if (preset === "today") return todayRangeUtc(now);
  if (preset === "30d") return lastNDaysRangeUtc(30, now);
  if (preset === "90d") return lastNDaysRangeUtc(90, now);
  if (preset === "custom" && custom.from) {
    const start = new Date(`${custom.from}T00:00:00.000Z`);
    const end = custom.to ? new Date(`${custom.to}T00:00:00.000Z`) : todayRangeUtc(now).end;
    return { start, end: new Date(end.getTime() + 24 * 60 * 60 * 1000) };
  }
  return lastNDaysRangeUtc(7, now);
}
