import type { OrderDetail } from "./queries";

/**
 * What an order shows to whom (Phase 10 data-exposure audit).
 *
 * Holding `orders.view` means "may open the orders you are involved in" — it is
 * NOT permission to see what the client is charged, what other workers cost,
 * or who the customer is. Specification Section 44: "Workers must not
 * automatically receive financial information." Before this rule existed, a
 * worker assigned to one item received EVERY item of the order, each with its
 * selling price and worker cost, plus the buyer, customer and total, in the
 * page sent to their browser. (Buyer itself was removed from the system
 * entirely, post-Phase-10, 2026-09-27 — see `prisma/schema/crm.prisma`.)
 *
 * The fix is applied on the SERVER, before anything reaches a client
 * component: a value the actor may not see is removed from the data, not
 * merely hidden by the UI (hidden values are still in the page payload).
 *
 * Pure — no database, no `server-only` — so it is unit-tested.
 */

export type OrderVisibility = {
  /** Every item on the order, not just the actor's own assignments. */
  allItems: boolean;
  /** What the client is charged: the order's total price (an item no longer has a price of its own — see D12). */
  prices: boolean;
  /** What workers are paid: item worker costs. */
  costs: boolean;
  /** The customer's identity (and, with it, which Fiverr account the order came in on). */
  parties: boolean;
  /** The lists that feed filter dropdowns and pickers (customers, workers, services, categories). */
  pickers: { customers: boolean; workers: boolean; catalog: boolean };
};

export function orderVisibility(has: (permission: string) => boolean): OrderVisibility {
  // Someone who can edit an order must see and be able to set its prices and parties.
  const editor = has("orders.edit");
  return {
    allItems: has("orders.view.all"),
    prices: editor || has("orders.create") || has("finance.revenue.view"),
    costs: editor || has("finance.worker_payments.view") || has("finance.profit.view"),
    parties: editor || has("customers.view"),
    pickers: {
      customers: editor || has("customers.view"),
      workers: editor || has("orders.assign") || has("workers.view.all"),
      catalog: editor || has("orders.create") || has("services.view") || has("categories.view"),
    },
  };
}

/** A copy of the order containing only what this actor may see. */
export function redactOrderDetail(order: OrderDetail, actorId: string, visibility: OrderVisibility): OrderDetail {
  const items = (visibility.allItems ? order.items : order.items.filter((item) => item.worker?.id === actorId)).map((item) => ({
    ...item,
    workerCost: visibility.costs ? item.workerCost : null,
  }));

  return {
    ...order,
    items,
    totalAmount: visibility.prices ? order.totalAmount : "",
    customer: visibility.parties ? order.customer : null,
    // Which of the business's own Fiverr profiles this order came in on is
    // the same class of "who this order is with" fact as the customer.
    fiverrAccount: visibility.parties ? order.fiverrAccount : null,
  };
}
