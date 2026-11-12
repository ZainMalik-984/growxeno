import { describe, expect, it } from "vitest";

import { isEmptyUpdate, parseCount, signedChange, updatePermissions, updateRecipients } from "@/lib/order-updates/rules";

describe("order item updates: who is notified", () => {
  it("tells the whole team and the item's worker, not the author", () => {
    const result = updateRecipients({ teamUserIds: ["admin-1", "admin-2"], itemWorkerUserIds: ["worker-a", null], authorId: "worker-a" });
    expect(result).toEqual([
      { userId: "admin-1", isItemWorker: false },
      { userId: "admin-2", isItemWorker: false },
    ]);
  });

  it("tells the item's worker when the team posts, with their own link", () => {
    const result = updateRecipients({ teamUserIds: ["admin-1", "admin-2"], itemWorkerUserIds: ["worker-a", null], authorId: "admin-1" });
    expect(result).toEqual([
      { userId: "admin-2", isItemWorker: false },
      { userId: "worker-a", isItemWorker: true },
    ]);
  });

  it("never includes workers on the order's other items (they are neither team nor this item's worker)", () => {
    const result = updateRecipients({ teamUserIds: ["admin-1"], itemWorkerUserIds: ["worker-a"], authorId: "admin-1" });
    expect(result.map((r) => r.userId)).toEqual(["worker-a"]);
    expect(result.map((r) => r.userId)).not.toContain("worker-b");
  });

  it("lists someone once even when they are both team and the item's worker", () => {
    const result = updateRecipients({ teamUserIds: ["admin-1", "lead"], itemWorkerUserIds: ["lead"], authorId: "admin-1" });
    expect(result).toEqual([{ userId: "lead", isItemWorker: false }]);
  });

  it("tells no one when the author is the only person with access", () => {
    expect(updateRecipients({ teamUserIds: ["admin-1"], itemWorkerUserIds: [null], authorId: "admin-1" })).toEqual([]);
  });
});

describe("order item updates: who may post", () => {
  const base = { isTeam: false, isAssignedWorker: true, canChangeStatus: true, hasMetric: true };

  it("lets the team post and set the count on any item", () => {
    expect(updatePermissions({ ...base, isTeam: true, isAssignedWorker: false, status: "DONE" })).toEqual({ canPost: true, canSetCount: true });
  });

  it("lets the worker post on their own task only once accepted, and set the count then", () => {
    // Before accepting: only Accept / Reject (2026-11-12).
    expect(updatePermissions({ ...base, status: "PENDING" })).toEqual({ canPost: false, canSetCount: false });
    expect(updatePermissions({ ...base, status: "PROCESSING" })).toEqual({ canPost: true, canSetCount: true });
    expect(updatePermissions({ ...base, status: "REFILL" })).toEqual({ canPost: true, canSetCount: true });
    expect(updatePermissions({ ...base, status: "DONE" })).toEqual({ canPost: true, canSetCount: false });
  });

  it("stops posting on a cancelled task, someone else's task, or without status rights", () => {
    expect(updatePermissions({ ...base, status: "CANCELLED" }).canPost).toBe(false);
    expect(updatePermissions({ ...base, isAssignedWorker: false, status: "PROCESSING" }).canPost).toBe(false);
    expect(updatePermissions({ ...base, canChangeStatus: false, status: "PROCESSING" }).canPost).toBe(false);
  });

  it("never offers a count on an item without one", () => {
    expect(updatePermissions({ ...base, hasMetric: false, status: "PROCESSING" })).toEqual({ canPost: true, canSetCount: false });
  });
});

describe("order item updates: the count field", () => {
  it("reads whole numbers with commas or spaces", () => {
    expect(parseCount("2,350")).toEqual({ ok: true, value: 2350 });
    expect(parseCount(" 4 200 ")).toEqual({ ok: true, value: 4200 });
    expect(parseCount("0")).toEqual({ ok: true, value: 0 });
  });

  it("treats empty as no change", () => {
    expect(parseCount("")).toEqual({ ok: true, value: null });
    expect(parseCount(undefined)).toEqual({ ok: true, value: null });
  });

  it("rejects decimals, negatives and words", () => {
    expect(parseCount("12.5").ok).toBe(false);
    expect(parseCount("-3").ok).toBe(false);
    expect(parseCount("lots").ok).toBe(false);
    expect(parseCount("99999999999").ok).toBe(false);
  });

  it("needs at least text, a count or a screenshot", () => {
    expect(isEmptyUpdate({ body: "  ", count: null, imageCount: 0 })).toBe(true);
    expect(isEmptyUpdate({ body: "done for today", count: null, imageCount: 0 })).toBe(false);
    expect(isEmptyUpdate({ body: "", count: 0, imageCount: 0 })).toBe(false);
    expect(isEmptyUpdate({ body: "", count: null, imageCount: 1 })).toBe(false);
  });

  it("shows the change since the last count", () => {
    expect(signedChange(655, 775)).toBe("+120");
    expect(signedChange(1000, 960)).toBe("−40");
    expect(signedChange(5, 5)).toBe("±0");
    expect(signedChange(null, 1200)).toBe("+1,200");
  });
});
