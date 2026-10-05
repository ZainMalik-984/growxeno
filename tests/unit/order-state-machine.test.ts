import { describe, expect, it } from "vitest";

import {
  allRequiredItemsComplete,
  canTransitionItem,
  canTransitionOrder,
  ORDER_STATUS_VALUES,
  ORDER_TRANSITIONS,
} from "@/lib/orders/state-machine";

describe("order state machine", () => {
  it("allows the documented happy-path sequence", () => {
    expect(canTransitionOrder("PENDING", "PROCESSING")).toBe(true);
    expect(canTransitionOrder("PROCESSING", "IN_PROGRESS")).toBe(true);
    expect(canTransitionOrder("IN_PROGRESS", "INTERNAL_REVIEW")).toBe(true);
    expect(canTransitionOrder("INTERNAL_REVIEW", "READY_FOR_DELIVERY")).toBe(true);
    expect(canTransitionOrder("READY_FOR_DELIVERY", "DELIVERED")).toBe(true);
    expect(canTransitionOrder("DELIVERED", "COMPLETED")).toBe(true);
  });

  it("allows revision from any in-flight status, and back to in progress", () => {
    expect(canTransitionOrder("IN_PROGRESS", "REVISION")).toBe(true);
    expect(canTransitionOrder("INTERNAL_REVIEW", "REVISION")).toBe(true);
    expect(canTransitionOrder("READY_FOR_DELIVERY", "REVISION")).toBe(true);
    expect(canTransitionOrder("DELIVERED", "REVISION")).toBe(true);
    expect(canTransitionOrder("REVISION", "IN_PROGRESS")).toBe(true);
  });

  it("allows cancellation from every non-terminal status except DELIVERED", () => {
    for (const status of ORDER_STATUS_VALUES) {
      const expected = ORDER_TRANSITIONS[status].includes("CANCELLED");
      expect(canTransitionOrder(status, "CANCELLED")).toBe(expected);
    }
    // DELIVERED specifically cannot be cancelled — only completed or revised.
    expect(canTransitionOrder("DELIVERED", "CANCELLED")).toBe(false);
  });

  it("rejects arbitrary jumps", () => {
    expect(canTransitionOrder("PENDING", "COMPLETED")).toBe(false);
    expect(canTransitionOrder("PENDING", "DELIVERED")).toBe(false);
    expect(canTransitionOrder("PROCESSING", "READY_FOR_DELIVERY")).toBe(false);
  });

  it("treats COMPLETED and CANCELLED as terminal", () => {
    expect(ORDER_TRANSITIONS.COMPLETED).toEqual([]);
    expect(ORDER_TRANSITIONS.CANCELLED).toEqual([]);
  });
});

describe("order item state machine", () => {
  it("lets an admin (broad scope) move an item through review to completion", () => {
    expect(canTransitionItem("PENDING", "IN_PROGRESS", { asAssignedWorkerOnly: false })).toBe(true);
    expect(canTransitionItem("IN_PROGRESS", "INTERNAL_REVIEW", { asAssignedWorkerOnly: false })).toBe(
      true,
    );
    expect(canTransitionItem("INTERNAL_REVIEW", "COMPLETED", { asAssignedWorkerOnly: false })).toBe(
      true,
    );
  });

  it("lets an admin cancel or send back to revision, but never a worker acting on their own item", () => {
    expect(canTransitionItem("PENDING", "CANCELLED", { asAssignedWorkerOnly: false })).toBe(true);
    expect(canTransitionItem("PENDING", "CANCELLED", { asAssignedWorkerOnly: true })).toBe(false);
    expect(canTransitionItem("IN_PROGRESS", "REVISION", { asAssignedWorkerOnly: false })).toBe(true);
    expect(canTransitionItem("IN_PROGRESS", "REVISION", { asAssignedWorkerOnly: true })).toBe(false);
  });

  it("restricts a worker on their own item to moving it forward only", () => {
    expect(canTransitionItem("PENDING", "IN_PROGRESS", { asAssignedWorkerOnly: true })).toBe(true);
    expect(canTransitionItem("IN_PROGRESS", "INTERNAL_REVIEW", { asAssignedWorkerOnly: true })).toBe(
      true,
    );
    expect(canTransitionItem("REVISION", "IN_PROGRESS", { asAssignedWorkerOnly: true })).toBe(true);
  });

  it("never lets a worker mark their own item completed", () => {
    expect(canTransitionItem("INTERNAL_REVIEW", "COMPLETED", { asAssignedWorkerOnly: true })).toBe(
      false,
    );
  });

  it("lets an admin flag a completed item back to revision, but never a worker on their own item", () => {
    expect(canTransitionItem("COMPLETED", "REVISION", { asAssignedWorkerOnly: false })).toBe(true);
    expect(canTransitionItem("COMPLETED", "REVISION", { asAssignedWorkerOnly: true })).toBe(false);
  });
});

describe("allRequiredItemsComplete", () => {
  it("is false with no items", () => {
    expect(allRequiredItemsComplete([])).toBe(false);
  });

  it("is true when every non-cancelled item is completed", () => {
    expect(allRequiredItemsComplete(["COMPLETED", "COMPLETED"])).toBe(true);
    expect(allRequiredItemsComplete(["COMPLETED", "CANCELLED"])).toBe(true);
  });

  it("is false when any non-cancelled item is not completed", () => {
    expect(allRequiredItemsComplete(["COMPLETED", "IN_PROGRESS"])).toBe(false);
  });

  it("is false when every item is cancelled (nothing left to require)", () => {
    expect(allRequiredItemsComplete(["CANCELLED", "CANCELLED"])).toBe(false);
  });
});
