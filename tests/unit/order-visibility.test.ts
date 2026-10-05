import { describe, expect, it } from "vitest";

import type { OrderDetail } from "@/lib/orders/queries";
import { orderVisibility, redactOrderDetail } from "@/lib/orders/visibility";

const has = (...keys: string[]) => (permission: string) => keys.includes(permission);

const WORKER = "worker-1";
const OTHER = "worker-2";

function item(id: string, workerId: string | null, cost: string | null) {
  return {
    id,
    service: { id: `svc-${id}`, name: `Service ${id}`, metricType: null },
    category: { id: "cat", name: "Category" },
    worker: workerId ? { id: workerId, fullName: `Worker ${workerId}` } : null,
    outsourcedWorker: null,
    workerCost: cost,
    workerCostCurrency: "PKR",
  };
}

const order = {
  id: "order-1",
  orderNumber: 42,
  totalAmount: "678.90",
  currency: "USD",
  customer: { id: "cust-1", name: "Jane Customer" },
  fiverrAccount: { id: "fiverr-1", name: "Fiverr Profile One" },
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
    const redacted = redactOrderDetail(order, WORKER, orderVisibility(has("orders.view")));

    expect(redacted.items.map((i) => i.id)).toEqual(["mine"]);
    expect(redacted.items[0].workerCost).toBeNull();
    expect(redacted.totalAmount).toBe("");
    expect(redacted.customer).toBeNull();
    expect(redacted.fiverrAccount).toBeNull();

    // The point: none of it survives anywhere in what would be serialized to the browser.
    const wire = JSON.stringify(redacted);
    for (const secret of ["67.89", "9999.00", "678.90", "Jane Customer", "Fiverr Profile One", "Service theirs", "worker-2"]) {
      expect(wire, `"${secret}" must not reach a plain worker`).not.toContain(secret);
    }
  });

  it("does not mutate the original order", () => {
    redactOrderDetail(order, WORKER, orderVisibility(has("orders.view")));
    expect(order.items).toHaveLength(2);
    expect(order.totalAmount).toBe("678.90");
  });

  it("leaves an editor's view complete", () => {
    const redacted = redactOrderDetail(order, "admin", orderVisibility(has("orders.view", "orders.view.all", "orders.edit")));
    expect(redacted.items).toHaveLength(2);
    expect(redacted.items[1].workerCost).toBe("9999.00");
    expect(redacted.customer?.name).toBe("Jane Customer");
    expect(redacted.fiverrAccount?.name).toBe("Fiverr Profile One");
    expect(redacted.totalAmount).toBe("678.90");
  });

  it("shows the order total but not costs to someone with only revenue access", () => {
    const redacted = redactOrderDetail(order, "someone", orderVisibility(has("orders.view", "orders.view.all", "finance.revenue.view")));
    expect(redacted.totalAmount).toBe("678.90");
    expect(redacted.items[0].workerCost).toBeNull();
  });
});
