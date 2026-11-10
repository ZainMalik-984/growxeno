import { describe, expect, it } from "vitest";

import { normalizeRate } from "@/lib/outsourced-workers/rate-input";

describe("normalizeRate", () => {
  it.each([
    [".4", "0.4"],
    ["0.4", "0.4"],
    ["25.23", "25.23"],
    ["25.", "25"],
    ["3.5", "3.5"],
    ["007", "7"],
    ["0", "0"],
    [" 12.05 ", "12.05"],
    [".05", "0.05"],
  ])("accepts %j as %j", (input, expected) => {
    expect(normalizeRate(input)).toBe(expected);
  });

  it.each(["", ".", "abc", "1.234", "-1", "1,5", "1.2.3", "1e3"])("rejects %j", (input) => {
    expect(normalizeRate(input)).toBeNull();
  });
});
