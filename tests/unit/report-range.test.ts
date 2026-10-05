import { describe, expect, it } from "vitest";

import { chooseBucket, clampRange, MAX_RANGE_DAYS } from "@/lib/reports/range";

const day = 24 * 60 * 60 * 1000;
const at = (offsetDays: number) => new Date(Date.UTC(2026, 8, 1) + offsetDays * day);

describe("clampRange", () => {
  it("leaves a range within the cap untouched", () => {
    const result = clampRange({ start: at(0), end: at(30) });
    expect(result.clamped).toBe(false);
    expect(result.start).toEqual(at(0));
  });

  it("clamps an oversized range to its most recent MAX_RANGE_DAYS", () => {
    const result = clampRange({ start: at(-2000), end: at(0) });
    expect(result.clamped).toBe(true);
    expect(result.end).toEqual(at(0));
    expect((result.end.getTime() - result.start.getTime()) / day).toBe(MAX_RANGE_DAYS);
  });
});

describe("chooseBucket", () => {
  it("never returns a year of daily rows", () => {
    expect(chooseBucket({ start: at(0), end: at(7) })).toBe("day");
    expect(chooseBucket({ start: at(0), end: at(31) })).toBe("day");
    expect(chooseBucket({ start: at(0), end: at(90) })).toBe("week");
    expect(chooseBucket({ start: at(0), end: at(365) })).toBe("month");
  });
});
