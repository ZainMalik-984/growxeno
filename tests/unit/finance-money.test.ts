import { describe, expect, it } from "vitest";

import { formatCurrencyBreakdown, roundMoney, sumByCurrency } from "@/lib/finance/money";

describe("roundMoney", () => {
  it("rounds half-up to 2 decimals", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(1.004)).toBe(1);
    expect(roundMoney(2.345)).toBe(2.35);
  });

  it("leaves an already-2-decimal value unchanged", () => {
    expect(roundMoney(100)).toBe(100);
    expect(roundMoney(99.99)).toBe(99.99);
  });
});

describe("sumByCurrency", () => {
  it("never blends different currencies into one total", () => {
    const result = sumByCurrency([
      { amount: 100, currency: "USD" },
      { amount: 3500, currency: "PKR" },
      { amount: 50, currency: "USD" },
    ]);
    expect(result).toEqual({ USD: 150, PKR: 3500 });
  });

  it("accumulates into a provided starting map", () => {
    const result = sumByCurrency([{ amount: 25, currency: "USD" }], { USD: 100 });
    expect(result).toEqual({ USD: 125 });
  });

  it("rounds each running total to 2 decimals", () => {
    const result = sumByCurrency([
      { amount: 0.1, currency: "USD" },
      { amount: 0.2, currency: "USD" },
    ]);
    expect(result.USD).toBe(0.3);
  });
});

describe("formatCurrencyBreakdown", () => {
  it("joins multiple currencies without blending them", () => {
    expect(formatCurrencyBreakdown({ USD: 100, PKR: 3500 })).toBe("100.00 USD · 3500.00 PKR");
  });

  it("shows an em dash for an empty breakdown", () => {
    expect(formatCurrencyBreakdown({})).toBe("—");
  });
});
