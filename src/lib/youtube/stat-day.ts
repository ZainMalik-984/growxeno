/**
 * Which day a YouTube reading belongs to (owner request, 2026-11-13): one
 * history row per item per day, by Pakistan time (UTC+5, no daylight saving).
 *
 * - A reading during the day (Refresh, the periodic refresh, opening the
 *   order) belongs to that Pakistan day and updates its row.
 * - The end-of-day reading runs at 00:00 PKT and belongs to the day that just
 *   ended: read at 00:00 on 2 January, it is the final count for 1 January.
 *   It counts back to the previous day for anything before 12:00 PKT, so a
 *   cron that runs a little late still lands on the right day. It's stored at
 *   23:59:59 of that day, so the row's time shows it as the day's close.
 *
 * Pure, so it is unit-tested.
 */

const PKT_OFFSET_MS = 5 * 3_600_000;
const DAY_MS = 86_400_000;

export type StatDay = { start: Date; end: Date };

/** The Pakistan day (as a UTC range) that `at` falls in. */
export function pktDay(at: Date): StatDay {
  const local = at.getTime() + PKT_OFFSET_MS;
  const startLocal = local - (((local % DAY_MS) + DAY_MS) % DAY_MS);
  const start = new Date(startLocal - PKT_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** The day a reading taken at `at` is recorded under. */
export function statDayFor(at: Date, dayEnd: boolean): StatDay {
  return dayEnd ? pktDay(new Date(at.getTime() - 12 * 3_600_000)) : pktDay(at);
}

/** When to store a reading: as taken, or the last second of the day for the end-of-day reading. */
export function statTakenAt(at: Date, dayEnd: boolean): Date {
  return dayEnd ? new Date(statDayFor(at, true).end.getTime() - 1000) : at;
}

/** True for a reading stored as the close of its day (23:59:59 PKT). */
export function isDayEndReading(takenAt: Date): boolean {
  const local = (takenAt.getTime() + PKT_OFFSET_MS) % DAY_MS;
  return local >= DAY_MS - 1000;
}
