import { beforeEach, describe, expect, it, vi } from "vitest";

/** Marking an order item's worker pay as already paid (2026-11-18). */

vi.mock("server-only", () => ({}));

let item: Record<string, unknown> | null;
const update = vi.fn(async () => ({}));
const tx = {
  orderItem: { findUnique: vi.fn(async () => item), update },
  orderActivity: { create: vi.fn(async () => ({})) },
  auditLog: { create: vi.fn(async () => ({})) },
};
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } }));
vi.mock("@/lib/audit/record", () => ({ recordAudit: vi.fn(async () => {}) }));

const { setItemWorkerPaid } = await import("@/lib/orders/service");

const actor = { user: { id: "u1", email: "a@b.c", fullName: "Admin" }, permissions: new Set<string>() } as never;
const base = {
  orderId: "o1",
  workerCost: { toString: () => "250" },
  workerCostCurrency: "PKR",
  workerPaidAt: null,
  order: { orderNumber: 7 },
  service: { name: "Watch Hours" },
  category: { name: "YouTube" },
  outsourcedWorker: { name: "Inzmam" },
  worker: null,
};

describe("setItemWorkerPaid", () => {
  beforeEach(() => {
    update.mockClear();
    item = { ...base };
  });

  it("stamps the item as paid", async () => {
    expect((await setItemWorkerPaid(actor, "i1", true)).ok).toBe(true);
    expect(update).toHaveBeenCalledWith({ where: { id: "i1" }, data: { workerPaidAt: expect.any(Date), workerPaidById: "u1" } });
  });

  it("clears it again", async () => {
    item = { ...base, workerPaidAt: new Date() };
    expect((await setItemWorkerPaid(actor, "i1", false)).ok).toBe(true);
    expect(update).toHaveBeenCalledWith({ where: { id: "i1" }, data: { workerPaidAt: null, workerPaidById: null } });
  });

  it("needs a worker and some pay", async () => {
    item = { ...base, outsourcedWorker: null };
    expect(await setItemWorkerPaid(actor, "i1", true)).toEqual({ ok: false, error: "No worker is assigned to this item." });
    item = { ...base, workerCost: null };
    expect(await setItemWorkerPaid(actor, "i1", true)).toEqual({ ok: false, error: "This item has no worker pay to mark as paid." });
    expect(update).not.toHaveBeenCalled();
  });
});
