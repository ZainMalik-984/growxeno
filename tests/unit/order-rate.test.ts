import { describe, expect, it } from "vitest";

import { computeAssignmentCost } from "@/lib/orders/rate";

describe("computeAssignmentCost", () => {
  it("returns null when no rate is configured", () => {
    expect(computeAssignmentCost({ metricType: "SUBSCRIBERS", targetCount: 6000, startingCount: 1000 }, null)).toBeNull();
  });

  it("matches the example from the request: 500 required subscribers at 3.5 PKR each = 1750", () => {
    expect(
      computeAssignmentCost(
        { metricType: "SUBSCRIBERS", targetCount: 1500, startingCount: 1000 },
        { rate: "3.5", currency: "PKR" },
      ),
    ).toEqual({ cost: "1750.00", currency: "PKR" });
  });

  it("charges only for the required count, not the full target (starting count already existed)", () => {
    expect(
      computeAssignmentCost(
        { metricType: "VIEWS", targetCount: 6000, startingCount: 1000 },
        { rate: "2", currency: "USD" },
      ),
    ).toEqual({ cost: "10000.00", currency: "USD" });
  });

  it("is a flat rate for a non-metric service, regardless of target/starting counts", () => {
    expect(
      computeAssignmentCost({ metricType: null, targetCount: null, startingCount: null }, { rate: "150.00", currency: "PKR" }),
    ).toEqual({ cost: "150.00", currency: "PKR" });
  });

  it("treats a null starting count as zero", () => {
    expect(
      computeAssignmentCost({ metricType: "WATCH_HOURS", targetCount: 500, startingCount: null }, { rate: "1.25", currency: "USD" }),
    ).toEqual({ cost: "625.00", currency: "USD" });
  });

  it("never goes negative when starting exceeds target (clamped to zero required units)", () => {
    expect(
      computeAssignmentCost({ metricType: "VIEWS", targetCount: 100, startingCount: 500 }, { rate: "5", currency: "PKR" }),
    ).toEqual({ cost: "0.00", currency: "PKR" });
  });
});
