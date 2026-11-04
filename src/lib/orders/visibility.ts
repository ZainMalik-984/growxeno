import { isAssignedToIdentity, type AssignmentIdentity } from "./assignment";
import { deriveOrderStatus } from "./state-machine";
import type { OrderDetail, OrderListItemRow } from "./queries";

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
  /**
   * The order's own details: source, reference, notes, who created it, and its
   * real deadline. Owner request, 2026-11-03: an External Worker sees only the
   * deadline, and that deadline is their own (earlier) item deadline, never
   * the order's. Anyone who can see every order sees these.
   */
  orderDetails: boolean;
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
    orderDetails: editor || has("orders.view.all"),
    pickers: {
      customers: editor || has("customers.view"),
      // Preserves the pre-rename behaviour exactly: this used to be a single
      // `workers.view.all` check gating BOTH the internal and outsourced
      // picker lists together; that key is now split in two (2026-10-08,
      // "keep the External Workers separate from employees"), so this is an
      // OR of both halves rather than a 1:1 rename.
      workers: editor || has("orders.assign") || has("employees.view.all") || has("outsourced_workers.view"),
      catalog: editor || has("orders.create") || has("services.view") || has("categories.view"),
    },
  };
}

/** A copy of the order containing only what this actor may see. */
export function redactOrderDetail(order: OrderDetail, identity: AssignmentIdentity, visibility: OrderVisibility): OrderDetail {
  const items = (
    visibility.allItems
      ? order.items
      : order.items.filter((item) =>
          isAssignedToIdentity({ workerId: item.worker?.id ?? null, outsourcedWorkerId: item.outsourcedWorker?.id ?? null }, identity),
        )
  ).map((item) => ({
    ...item,
    // A worker sees what THEY are paid for their own item (owner request,
    // 2026-11-03: "he should see how much he'll make"), never anyone else's.
    workerCost:
      visibility.costs ||
      isAssignedToIdentity({ workerId: item.worker?.id ?? null, outsourcedWorkerId: item.outsourcedWorker?.id ?? null }, identity)
        ? item.workerCost
        : null,
  }));

  const hideDetails = !visibility.orderDetails;
  return {
    ...order,
    items,
    ...(hideDetails
      ? {
          source: null,
          externalReference: null,
          notes: null,
          createdBy: null,
          // Their deadline is the earliest one among their own items.
          deadline: earliest(items.map((item) => item.deadline)),
          // The order's calculated status depends on other workers' items
          // ("Partially Completed" reveals they exist), so a worker gets one
          // worked out from their own items only. Delivered / Finalized /
          // Refunded-Cancelled apply to everyone and pass through unchanged.
          status: deriveOrderStatus(
            order.status,
            items.map((item) => ({ status: item.status, assigned: Boolean(item.worker || item.outsourcedWorker) })),
          ),
          activity: [],
        }
      : {}),
    totalAmount: visibility.prices ? order.totalAmount : "",
    customer: visibility.parties ? order.customer : null,
    // Which of the business's own Fiverr profiles this order came in on is
    // the same class of "who this order is with" fact as the customer.
    fiverrAccount: visibility.parties ? order.fiverrAccount : null,
  };
}

/**
 * May change the status of a whole order (not just an item). Needs
 * `orders.change_status` AND sight of every order: an External Worker holds
 * `orders.change_status` only to move their own items (2026-11-03).
 */
export function canChangeWholeOrderStatus(has: (permission: string) => boolean): boolean {
  return has("orders.change_status") && has("orders.view.all");
}

/** The earliest of these dates, or null when none is set. */
export function earliest(dates: ReadonlyArray<Date | null>): Date | null {
  let min: Date | null = null;
  for (const date of dates) if (date && (!min || date < min)) min = date;
  return min;
}

/**
 * The same `allItems` narrowing as `redactOrderDetail`, for the orders-LIST
 * page's per-row item dropdown (confirmed directly, 2026-10-05) — a
 * restricted Worker expanding their own order row must see only their own
 * item(s), never a co-worker's assignment or progress.
 */
export function redactOrderListItems(
  items: OrderListItemRow[],
  identity: AssignmentIdentity,
  visibility: OrderVisibility,
): OrderListItemRow[] {
  const mine = (item: OrderListItemRow) =>
    isAssignedToIdentity({ workerId: item.workerId, outsourcedWorkerId: item.outsourcedWorker?.id ?? null }, identity);
  return (visibility.allItems ? items : items.filter(mine)).map((item) => ({
    ...item,
    // Same rule as redactOrderDetail: own pay only, unless they may see all costs.
    workerCost: visibility.costs || mine(item) ? item.workerCost : null,
  }));
}
