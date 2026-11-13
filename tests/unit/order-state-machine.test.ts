import { describe, expect, it } from "vitest";

import {
  canTransitionItem,
  canTransitionOrder,
  deriveOrderStatus,
  type DerivableItem,
} from "@/lib/orders/state-machine";

const item = (status: DerivableItem["status"], assigned = true): DerivableItem => ({ status, assigned });

describe("item statuses", () => {
  const worker = { asAssignedWorkerOnly: true };
  const admin = { asAssignedWorkerOnly: false };

  it("lets a worker accept straight into Processing, then mark it done", () => {
    expect(canTransitionItem("PENDING", "PROCESSING", worker)).toBe(true);
    expect(canTransitionItem("PROCESSING", "DONE", worker)).toBe(true);
    expect(canTransitionItem("REFILL", "DONE", worker)).toBe(true);
  });

  it("never lets a worker reopen or cancel", () => {
    expect(canTransitionItem("DONE", "REFILL", worker)).toBe(false);
    expect(canTransitionItem("PROCESSING", "CANCELLED", worker)).toBe(false);
    expect(canTransitionItem("DONE", "PROCESSING", worker)).toBe(false);
  });

  it("lets an admin send a done item to Refill and cancel anything open", () => {
    expect(canTransitionItem("DONE", "REFILL", admin)).toBe(true);
    for (const from of ["PENDING", "PROCESSING", "DONE", "REFILL"] as const) {
      expect(canTransitionItem(from, "CANCELLED", admin)).toBe(true);
    }
    expect(canTransitionItem("CANCELLED", "PENDING", admin)).toBe(false);
  });
});

describe("deriveOrderStatus", () => {
  it("is Pending with no items or an unassigned item", () => {
    expect(deriveOrderStatus("PENDING", [])).toBe("PENDING");
    expect(deriveOrderStatus("PENDING", [item("PENDING"), item("PENDING", false)])).toBe("PENDING");
  });

  it("is Assigned once every item has a worker", () => {
    expect(deriveOrderStatus("PENDING", [item("PENDING"), item("PROCESSING")])).toBe("ASSIGNED");
  });

  it("is Processing once every item is accepted", () => {
    expect(deriveOrderStatus("ASSIGNED", [item("PROCESSING"), item("PROCESSING")])).toBe("PROCESSING");
    expect(deriveOrderStatus("ASSIGNED", [item("PROCESSING"), item("REFILL")])).toBe("PROCESSING");
  });

  it("is Partially Completed when some items are done", () => {
    expect(deriveOrderStatus("PROCESSING", [item("DONE"), item("PROCESSING")])).toBe("PARTIALLY_COMPLETED");
    // A done item sent to Refill takes a completed order back.
    expect(deriveOrderStatus("COMPLETED", [item("DONE"), item("REFILL")])).toBe("PARTIALLY_COMPLETED");
  });

  it("is Completed when every item is done, ignoring cancelled items", () => {
    expect(deriveOrderStatus("PARTIALLY_COMPLETED", [item("DONE"), item("DONE")])).toBe("COMPLETED");
    expect(deriveOrderStatus("PROCESSING", [item("DONE"), item("CANCELLED", false)])).toBe("COMPLETED");
  });

  it("keeps statuses an admin set by hand", () => {
    for (const status of ["DELIVERED", "FINALIZED", "CANCELLED"] as const) {
      expect(deriveOrderStatus(status, [item("REFILL")])).toBe(status);
    }
  });
});

describe("manual order steps", () => {
  it("only allows Delivered after Completed, then Finalized", () => {
    expect(canTransitionOrder("COMPLETED", "DELIVERED")).toBe(true);
    expect(canTransitionOrder("PROCESSING", "DELIVERED")).toBe(false);
    expect(canTransitionOrder("DELIVERED", "FINALIZED")).toBe(true);
    expect(canTransitionOrder("COMPLETED", "FINALIZED")).toBe(false);
  });

  it("never sets a calculated status by hand", () => {
    for (const to of ["PENDING", "ASSIGNED", "PROCESSING", "PARTIALLY_COMPLETED", "COMPLETED"] as const) {
      expect(canTransitionOrder("PENDING", to)).toBe(false);
      expect(canTransitionOrder("DELIVERED", to)).toBe(false);
    }
  });

  it("allows Refunded / Cancelled from any open or delivered order", () => {
    for (const from of ["PENDING", "ASSIGNED", "PROCESSING", "PARTIALLY_COMPLETED", "COMPLETED", "DELIVERED", "FINALIZED"] as const) {
      expect(canTransitionOrder(from, "CANCELLED")).toBe(true);
    }
    expect(canTransitionOrder("CANCELLED", "CANCELLED")).toBe(false);
  });
});

describe("revision (2026-11-13)", () => {
  it("can be started once the order is completed, delivered or finalized", () => {
    for (const from of ["COMPLETED", "DELIVERED", "FINALIZED"] as const) expect(canTransitionOrder(from, "IN_REVISION")).toBe(true);
    for (const from of ["PENDING", "PROCESSING", "PARTIALLY_COMPLETED", "CANCELLED"] as const) {
      expect(canTransitionOrder(from, "IN_REVISION")).toBe(false);
    }
  });
  it("ends by delivering again, or a refund", () => {
    expect(canTransitionOrder("IN_REVISION", "DELIVERED")).toBe(true);
    expect(canTransitionOrder("IN_REVISION", "CANCELLED")).toBe(true);
    expect(canTransitionOrder("IN_REVISION", "FINALIZED")).toBe(false);
  });
  it("stays in revision while items are sent to refill and done again", () => {
    expect(deriveOrderStatus("IN_REVISION", [{ status: "REFILL", assigned: true }])).toBe("IN_REVISION");
    expect(deriveOrderStatus("IN_REVISION", [{ status: "DONE", assigned: true }])).toBe("IN_REVISION");
  });
});
