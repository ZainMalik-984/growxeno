import { describe, expect, it } from "vitest";

import { orderSourceInfo, type OrderSourceFields } from "@/lib/orders/source-info";
import { orderVisibility } from "@/lib/orders/visibility";

const base: OrderSourceFields = {
  source: "FIVERR",
  fiverrProfileName: "growxeno_pro",
  externalReference: "FO123",
  orderDate: new Date("2026-11-10T10:00:00Z"),
  notes: "Rush",
  customerName: "Said",
  customerEmail: "said@example.com",
  customerPhone: "+92 300 0000000",
};

const team = orderVisibility(() => true);
const worker = orderVisibility((key) => key === "orders.view" || key === "orders.change_status");

describe("orderSourceInfo", () => {
  it("gives the Fiverr profile name for a Fiverr order", () => {
    expect(orderSourceInfo(base, team)).toEqual({ kind: "FIVERR", profileName: "growxeno_pro", reference: "FO123" });
  });

  it("gives the External order's details", () => {
    expect(orderSourceInfo({ ...base, source: "EXTERNAL", fiverrProfileName: null }, team)).toEqual({
      kind: "EXTERNAL",
      reference: "FO123",
      orderDate: base.orderDate,
      notes: "Rush",
      customer: { name: "Said", email: "said@example.com", phone: "+92 300 0000000" },
    });
  });

  it("gives nothing to a worker, so it never reaches their page", () => {
    expect(orderSourceInfo(base, worker)).toBeNull();
    expect(orderSourceInfo({ ...base, source: "EXTERNAL" }, worker)).toBeNull();
  });

  it("needs both the order's details and its parties", () => {
    expect(orderSourceInfo(base, { orderDetails: true, parties: false })).toBeNull();
    expect(orderSourceInfo(base, { orderDetails: false, parties: true })).toBeNull();
  });
});
