import { describe, expect, it } from "vitest";

import { lastNDaysRangeUtc, resolveStatsRange } from "@/lib/daily-stats/date-ranges";

const NOW = new Date("2026-09-16T14:32:00Z");

describe("lastNDaysRangeUtc", () => {
  it("spans exactly N days ending at the start of tomorrow", () => {
    const { start, end } = lastNDaysRangeUtc(7, NOW);
    expect(end.toISOString()).toBe("2026-09-17T00:00:00.000Z");
    expect(start.toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });
});

describe("resolveStatsRange", () => {
  it("resolves 'today' to the current UTC day", () => {
    const { start, end } = resolveStatsRange("today", {}, NOW);
    expect(start.toISOString()).toBe("2026-09-16T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-17T00:00:00.000Z");
  });

  it("resolves '30d' and '90d' to the matching window", () => {
    expect(resolveStatsRange("30d", {}, NOW).start.toISOString()).toBe("2026-08-18T00:00:00.000Z");
    expect(resolveStatsRange("90d", {}, NOW).start.toISOString()).toBe("2026-06-19T00:00:00.000Z");
  });

  it("resolves a custom range inclusively", () => {
    const { start, end } = resolveStatsRange("custom", { from: "2026-09-01", to: "2026-09-05" }, NOW);
    expect(start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    // Inclusive of the "to" day: end is the start of the day AFTER it.
    expect(end.toISOString()).toBe("2026-09-06T00:00:00.000Z");
  });

  it("falls back to a 7-day window for 'custom' with no 'from'", () => {
    const { start } = resolveStatsRange("custom", {}, NOW);
    expect(start.toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });

  it("falls back to a 7-day window for an unrecognised or missing preset", () => {
    expect(resolveStatsRange(undefined, {}, NOW).start.toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });
});
