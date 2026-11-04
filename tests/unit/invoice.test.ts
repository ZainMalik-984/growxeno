import { describe, expect, it } from "vitest";

import {
  computeTotals,
  hasCountableItems,
  isCountable,
  lineTotal,
  type InvoiceData,
  type InvoiceItem,
} from "@/lib/invoices/invoice";

const item = (quantity: number, unitPrice: number): InvoiceItem => ({
  id: String(Math.random()),
  description: "Service",
  quantity,
  unitPrice,
});

describe("invoice items", () => {
  it("multiplies countable items by quantity", () => {
    expect(isCountable(item(3, 250))).toBe(true);
    expect(lineTotal(item(3, 250))).toBe(750);
  });

  it("treats quantity 0 as a fixed price, not a zero amount", () => {
    expect(isCountable(item(0, 450))).toBe(false);
    expect(lineTotal(item(0, 450))).toBe(450);
  });

  it("treats a blank (NaN) quantity like 0", () => {
    expect(lineTotal(item(Number.NaN, 120))).toBe(120);
  });

  it("shows the quantity column only when some item is countable", () => {
    expect(hasCountableItems([item(0, 100), item(0, 50)])).toBe(false);
    expect(hasCountableItems([item(0, 100), item(2, 50)])).toBe(true);
  });

  it("totals mixed items with discount then tax", () => {
    const party = { name: "", company: "", email: "", phone: "", address: "" };
    const data: InvoiceData = {
      number: "T-1",
      issueDate: "2026-10-28",
      dueDate: "2026-11-11",
      showDueDate: true,
      currency: "USD",
      from: party,
      billTo: party,
      items: [item(0, 450), item(3, 250)],
      discountPercent: 10,
      taxPercent: 5,
      notes: "",
      paymentDetails: "",
    };
    // 450 + 750 = 1200; -10% = 1080; +5% tax = 1134
    expect(computeTotals(data)).toEqual({ subtotal: 1200, discount: 120, tax: 54, total: 1134 });
  });
});
