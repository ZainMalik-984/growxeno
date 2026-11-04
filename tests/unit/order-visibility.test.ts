import { describe, expect, it } from "vitest";

import type { OrderDetail, OrderListItemRow } from "@/lib/orders/queries";
import { canChangeWholeOrderStatus, orderVisibility, redactOrderDetail, redactOrderListItems } from "@/lib/orders/visibility";

const has = (...keys: string[]) => (permission: string) => keys.includes(permission);

const WORKER = "worker-1";
const OTHER = "worker-2";
const identity = (userId: string, outsourcedWorkerId: string | null = null) => ({ userId, outsourcedWorkerId });

function item(id: string, workerId: string | null, cost: string | null, outsourcedWorkerId: string | null = null) {
  return {
    id,
    service: { id: `svc-${id}`, name: `Service ${id}`, metricType: null },
    category: { id: "cat", name: "Category" },
    worker: workerId ? { id: workerId, fullName: `Worker ${workerId}` } : null,
    outsourcedWorker: outsourcedWorkerId ? { id: outsourcedWorkerId, name: `External ${outsourcedWorkerId}` } : null,
    workerCost: cost,
    workerCostCurrency: "PKR",
    deadline: new Date(id === "mine" ? "2026-12-09T00:00:00Z" : "2026-12-05T00:00:00Z"),
    deadlineOverridden: false,
    status: id === "mine" ? "DONE" : "PROCESSING",
  };
}

const order = {
  id: "order-1",
  orderNumber: 42,
  totalAmount: "678.90",
  currency: "USD",
  customer: { id: "cust-1", name: "Jane Customer" },
  fiverrAccount: { id: "fiverr-1", name: "Fiverr Profile One" },
  status: "PARTIALLY_COMPLETED",
  source: "FIVERR",
  externalReference: "FO-SECRET-REF",
  notes: "Secret order note",
  deadline: new Date("2026-12-10T00:00:00Z"),
  createdBy: { id: "admin-1", fullName: "Admin Person" },
  activity: [{ id: "a1", action: "order.updated", summary: "Deadline moved", actorLabel: "Admin Person", createdAt: new Date() }],
  items: [item("mine", WORKER, "67.89"), item("theirs", OTHER, "9999.00")],
} as unknown as OrderDetail;

describe("orderVisibility", () => {
  it("gives a plain worker nothing beyond their own assignments", () => {
    const v = orderVisibility(has("orders.view", "orders.comment", "orders.change_status"));
    expect(v).toMatchObject({ allItems: false, prices: false, costs: false, parties: false });
    expect(v.pickers).toEqual({ customers: false, workers: false, catalog: false });
  });

  it("does not treat holding orders.view.all as permission to see money", () => {
    const v = orderVisibility(has("orders.view", "orders.view.all"));
    expect(v.allItems).toBe(true);
    expect(v.prices).toBe(false);
    expect(v.costs).toBe(false);
  });

  it("lets an editor see and set prices, costs and parties", () => {
    const v = orderVisibility(has("orders.view", "orders.view.all", "orders.edit"));
    expect(v).toMatchObject({ allItems: true, prices: true, costs: true, parties: true });
    expect(v.pickers.customers && v.pickers.workers && v.pickers.catalog).toBe(true);
  });

  it("splits price and cost visibility by finance permission", () => {
    expect(orderVisibility(has("finance.revenue.view"))).toMatchObject({ prices: true, costs: false });
    expect(orderVisibility(has("finance.worker_payments.view"))).toMatchObject({ prices: false, costs: true });
  });
});

describe("redactOrderDetail", () => {
  it("removes other workers' items, all money, and the customer for a plain worker", () => {
    const redacted = redactOrderDetail(order, identity(WORKER), orderVisibility(has("orders.view")));

    expect(redacted.items.map((i) => i.id)).toEqual(["mine"]);
    // Their own pay is theirs to see (owner request, 2026-11-03).
    expect(redacted.items[0].workerCost).toBe("67.89");
    expect(redacted.totalAmount).toBe("");
    expect(redacted.customer).toBeNull();
    expect(redacted.fiverrAccount).toBeNull();

    // The point: none of it survives anywhere in what would be serialized to the browser.
    const wire = JSON.stringify(redacted);
    for (const secret of ["9999.00", "678.90", "Jane Customer", "Fiverr Profile One", "Service theirs", "worker-2"]) {
      expect(wire, `"${secret}" must not reach a plain worker`).not.toContain(secret);
    }
  });

  it("shows a worker only their own deadline, never the order's details", () => {
    const redacted = redactOrderDetail(order, identity(WORKER), orderVisibility(has("orders.view")));
    expect(redacted.deadline).toEqual(new Date("2026-12-09T00:00:00Z"));
    expect(redacted.source).toBeNull();
    expect(redacted.externalReference).toBeNull();
    expect(redacted.notes).toBeNull();
    expect(redacted.createdBy).toBeNull();
    expect(redacted.activity).toEqual([]);
    // The whole order is Partially Completed, but this worker's only item is
    // Done: they see Completed, which says nothing about anyone else's work.
    expect(redacted.status).toBe("COMPLETED");

    const wire = JSON.stringify(redacted);
    for (const secret of ["FIVERR", "FO-SECRET-REF", "Secret order note", "Admin Person", "2026-12-10", "2026-12-05"]) {
      expect(wire, `"${secret}" must not reach a plain worker`).not.toContain(secret);
    }
  });

  it("keeps the order's own details for anyone who sees every order", () => {
    const redacted = redactOrderDetail(order, identity("admin"), orderVisibility(has("orders.view", "orders.view.all")));
    expect(redacted.deadline).toEqual(new Date("2026-12-10T00:00:00Z"));
    expect(redacted.externalReference).toBe("FO-SECRET-REF");
  });

  it("does not mutate the original order", () => {
    redactOrderDetail(order, identity(WORKER), orderVisibility(has("orders.view")));
    expect(order.items).toHaveLength(2);
    expect(order.totalAmount).toBe("678.90");
  });

  it("leaves an editor's view complete", () => {
    const redacted = redactOrderDetail(order, identity("admin"), orderVisibility(has("orders.view", "orders.view.all", "orders.edit")));
    expect(redacted.items).toHaveLength(2);
    expect(redacted.items[1].workerCost).toBe("9999.00");
    expect(redacted.customer?.name).toBe("Jane Customer");
    expect(redacted.fiverrAccount?.name).toBe("Fiverr Profile One");
    expect(redacted.totalAmount).toBe("678.90");
  });

  it("shows the order total but not costs to someone with only revenue access", () => {
    const redacted = redactOrderDetail(order, identity("someone"), orderVisibility(has("orders.view", "orders.view.all", "finance.revenue.view")));
    expect(redacted.totalAmount).toBe("678.90");
    expect(redacted.items[0].workerCost).toBeNull();
  });

  it("matches an External Worker by outsourcedWorkerId, not by their User id", () => {
    const externalOrder = {
      ...order,
      items: [item("mine", null, "67.89", "external-1"), item("theirs", OTHER, "9999.00")],
    } as unknown as OrderDetail;
    const redacted = redactOrderDetail(externalOrder, identity("user-for-external-1", "external-1"), orderVisibility(has("orders.view")));
    expect(redacted.items.map((i) => i.id)).toEqual(["mine"]);
  });
});

function listItem(id: string, workerId: string | null): OrderListItemRow {
  return {
    id,
    orderId: "order-1",
    serviceName: `Service ${id}`,
    metricType: "VIEWS",
    workerId,
    worker: workerId ? { id: workerId, fullName: `Worker ${workerId}` } : null,
    outsourcedWorker: null,
    currentCount: 100,
    targetCount: 1000,
    startingCount: 0,
    status: "PROCESSING",
    deadline: null,
    channelLink: null,
    workerCost: workerId === WORKER ? "67.89" : "9999.00",
    workerCostCurrency: "PKR",
  };
}

describe("redactOrderListItems", () => {
  const listItems = [listItem("mine", WORKER), listItem("theirs", OTHER)];

  it("keeps a plain worker's expanded row to only their own item", () => {
    const redacted = redactOrderListItems(listItems, identity(WORKER), orderVisibility(has("orders.view")));
    expect(redacted.map((i) => i.id)).toEqual(["mine"]);
  });

  it("shows a worker their own pay and nothing else", () => {
    const redacted = redactOrderListItems(listItems, identity(WORKER), orderVisibility(has("orders.view")));
    expect(redacted[0].workerCost).toBe("67.89");
    expect(JSON.stringify(redacted)).not.toContain("9999.00");
  });

  it("hides pay from someone who sees every order but not costs", () => {
    const redacted = redactOrderListItems(listItems, identity("viewer"), orderVisibility(has("orders.view", "orders.view.all")));
    expect(redacted.map((i) => i.workerCost)).toEqual([null, null]);
  });

  it("leaves every item visible for someone with orders.view.all", () => {
    const redacted = redactOrderListItems(listItems, identity("admin"), orderVisibility(has("orders.view", "orders.view.all")));
    expect(redacted.map((i) => i.id)).toEqual(["mine", "theirs"]);
  });

  it("keeps an External Worker's expanded row to only their own item, matched by outsourcedWorkerId", () => {
    const rows = [
      { ...listItem("mine", null), outsourcedWorker: { id: "external-1", name: "External One" } },
      listItem("theirs", OTHER),
    ];
    const redacted = redactOrderListItems(rows, identity("user-for-external-1", "external-1"), orderVisibility(has("orders.view")));
    expect(redacted.map((i) => i.id)).toEqual(["mine"]);
  });
});

describe("canChangeWholeOrderStatus", () => {
  it("keeps whole-order status changes away from External Workers", () => {
    expect(canChangeWholeOrderStatus(has("orders.view", "orders.comment", "orders.change_status"))).toBe(false);
  });
  it("allows people who manage every order", () => {
    expect(canChangeWholeOrderStatus(has("orders.view", "orders.view.all", "orders.change_status"))).toBe(true);
    expect(canChangeWholeOrderStatus(has("orders.view", "orders.view.all"))).toBe(false);
  });
});
