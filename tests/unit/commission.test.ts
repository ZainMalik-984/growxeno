import { describe, expect, it } from "vitest";

import { commissionOnOrder, commissionTotals } from "@/lib/finance/commission";
import { parseFiverrFeeSettings } from "@/lib/settings/fiverr-fee";

describe("commission", () => {
  it("takes the Fiverr fee off Fiverr orders only", () => {
    // 10% of (100 − 20%) = 8
    expect(commissionOnOrder({ source: "FIVERR", totalAmount: "100.00" }, 10, 20)).toBe(8);
    // 10% of 100 = 10
    expect(commissionOnOrder({ source: "EXTERNAL", totalAmount: "100.00" }, 10, 20)).toBe(10);
  });

  it("rounds to cents and ignores empty prices", () => {
    expect(commissionOnOrder({ source: "FIVERR", totalAmount: "33.33" }, 7.5, 20)).toBe(2);
    expect(commissionOnOrder({ source: "EXTERNAL", totalAmount: "0" }, 10, 20)).toBe(0);
  });

  it("splits earned (delivered/finalized) from pending, per currency, skipping cancelled", () => {
    const totals = commissionTotals(
      [
        { source: "FIVERR", status: "DELIVERED", currency: "USD", totalAmount: "100" },
        { source: "EXTERNAL", status: "FINALIZED", currency: "USD", totalAmount: "50" },
        { source: "EXTERNAL", status: "PROCESSING", currency: "USD", totalAmount: "200" },
        { source: "EXTERNAL", status: "COMPLETED", currency: "PKR", totalAmount: "1000" },
        { source: "FIVERR", status: "CANCELLED", currency: "USD", totalAmount: "999" },
      ],
      10,
      20,
    );
    expect(totals.earnedByCurrency).toEqual({ USD: 13 });
    expect(totals.pendingByCurrency).toEqual({ USD: 20, PKR: 100 });
  });

  it("reads the Fiverr fee setting, falling back to 20%", () => {
    expect(parseFiverrFeeSettings({ percent: 15 })).toEqual({ percent: 15 });
    expect(parseFiverrFeeSettings(null)).toEqual({ percent: 20 });
    expect(parseFiverrFeeSettings({ percent: 150 })).toEqual({ percent: 20 });
  });
});
