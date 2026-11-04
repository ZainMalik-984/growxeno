import { describe, expect, it } from "vitest";

import { assignedItemWhere, boardItemWhere, isAssignedToIdentity } from "@/lib/orders/assignment";

describe("isAssignedToIdentity", () => {
  it("matches the deprecated internal workerId path", () => {
    expect(isAssignedToIdentity({ workerId: "user-1", outsourcedWorkerId: null }, { userId: "user-1", outsourcedWorkerId: null })).toBe(true);
  });

  it("matches the live outsourcedWorkerId path for an External Worker", () => {
    expect(
      isAssignedToIdentity({ workerId: null, outsourcedWorkerId: "external-1" }, { userId: "user-for-external-1", outsourcedWorkerId: "external-1" }),
    ).toBe(true);
  });

  it("does not match a different user or a different External Worker", () => {
    expect(isAssignedToIdentity({ workerId: "user-1", outsourcedWorkerId: null }, { userId: "user-2", outsourcedWorkerId: null })).toBe(false);
    expect(
      isAssignedToIdentity({ workerId: null, outsourcedWorkerId: "external-1" }, { userId: "user-x", outsourcedWorkerId: "external-2" }),
    ).toBe(false);
  });

  it("an Employee (no linked External Worker) never matches an item assigned to an External Worker", () => {
    expect(isAssignedToIdentity({ workerId: null, outsourcedWorkerId: "external-1" }, { userId: "employee-1", outsourcedWorkerId: null })).toBe(false);
  });

  it("an item with no assignee at all matches nobody", () => {
    expect(isAssignedToIdentity({ workerId: null, outsourcedWorkerId: null }, { userId: "user-1", outsourcedWorkerId: "external-1" })).toBe(false);
  });
});

describe("assignedItemWhere", () => {
  it("is just the workerId branch for an Employee with no linked External Worker", () => {
    expect(assignedItemWhere({ userId: "employee-1", outsourcedWorkerId: null })).toEqual({
      OR: [{ workerId: "employee-1" }],
    });
  });

  it("includes both branches for an External Worker (so deprecated legacy rows under their own User id, if any, still match)", () => {
    expect(assignedItemWhere({ userId: "user-for-external-1", outsourcedWorkerId: "external-1" })).toEqual({
      OR: [{ workerId: "user-for-external-1" }, { outsourcedWorkerId: "external-1" }],
    });
  });
});

describe("boardItemWhere", () => {
  it("returns an empty filter (everything) for an actor with orders.view.all", () => {
    expect(boardItemWhere({ userId: "admin-1", outsourcedWorkerId: null }, true)).toEqual({});
  });

  it("adds Order.createdById for an Employee without orders.view.all, alongside the assigned-item branches", () => {
    expect(boardItemWhere({ userId: "employee-1", outsourcedWorkerId: null }, false)).toEqual({
      OR: [{ workerId: "employee-1" }, { order: { createdById: "employee-1" } }],
    });
  });

  it("includes all three branches for a linked External Worker without orders.view.all", () => {
    expect(boardItemWhere({ userId: "user-for-external-1", outsourcedWorkerId: "external-1" }, false)).toEqual({
      OR: [{ workerId: "user-for-external-1" }, { outsourcedWorkerId: "external-1" }, { order: { createdById: "user-for-external-1" } }],
    });
  });
});
