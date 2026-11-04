import { describe, expect, it } from "vitest";

import { aggregateProgress } from "@/lib/orders/progress";

describe("aggregateProgress", () => {
  it("returns null when there are no metric items", () => {
    expect(aggregateProgress([])).toBeNull();
    expect(aggregateProgress([{ targetCount: null, currentCount: null, startingCount: null }])).toBeNull();
    expect(aggregateProgress([{ targetCount: 0, currentCount: 0, startingCount: 0 }])).toBeNull();
  });

  it("matches the example from the request: 1000 starting + 5000 required, no work done yet -> 0%, not current/target", () => {
    expect(aggregateProgress([{ targetCount: 6000, currentCount: 1000, startingCount: 1000 }])).toEqual({
      current: 0,
      target: 5000,
      percent: 0,
    });
  });

  it("measures the delta from the starting baseline once work has happened: 1000 starting, now at 1500, target 6000 -> 500/5000", () => {
    expect(aggregateProgress([{ targetCount: 6000, currentCount: 1500, startingCount: 1000 }])).toEqual({
      current: 500,
      target: 5000,
      percent: 10,
    });
  });

  it("falls back to current/target for a legacy item with no recorded starting count", () => {
    expect(aggregateProgress([{ targetCount: 6000, currentCount: 1500, startingCount: null }])).toEqual({
      current: 1500,
      target: 6000,
      percent: 25,
    });
  });

  it("sums deltas across multiple metric items", () => {
    expect(
      aggregateProgress([
        { targetCount: 1000, currentCount: 500, startingCount: 0 },
        { targetCount: 2000, currentCount: 1200, startingCount: 200 },
      ]),
    ).toEqual({ current: 1500, target: 2800, percent: 54 });
  });

  it("ignores non-metric items mixed in with metric ones", () => {
    expect(
      aggregateProgress([
        { targetCount: null, currentCount: null, startingCount: null },
        { targetCount: 100, currentCount: 50, startingCount: 0 },
      ]),
    ).toEqual({ current: 50, target: 100, percent: 50 });
  });

  it("excludes an item whose required amount is zero (nothing asked for beyond the starting point)", () => {
    expect(
      aggregateProgress([
        { targetCount: 1000, currentCount: 1000, startingCount: 1000 },
        { targetCount: 2000, currentCount: 1500, startingCount: 1000 },
      ]),
    ).toEqual({ current: 500, target: 1000, percent: 50 });
  });

  it("clamps an over-delivered item at its own required amount so it cannot push the aggregate past 100%", () => {
    expect(
      aggregateProgress([
        { targetCount: 1000, currentCount: 1000, startingCount: 0 },
        { targetCount: 1000, currentCount: 5000, startingCount: 0 },
      ]),
    ).toEqual({ current: 2000, target: 2000, percent: 100 });
  });

  it("clamps a current count that dips below the starting baseline at 0, never negative", () => {
    expect(aggregateProgress([{ targetCount: 1000, currentCount: 50, startingCount: 100 }])).toEqual({
      current: 0,
      target: 900,
      percent: 0,
    });
  });

  it("treats a null currentCount as no progress reported yet, never a negative delta", () => {
    expect(aggregateProgress([{ targetCount: 100, currentCount: null, startingCount: 20 }])).toEqual({
      current: 0,
      target: 80,
      percent: 0,
    });
  });
});
