import type { OrderItemStatus, OrderStatus } from "@/generated/prisma/client";

/**
 * Order and Order Item statuses (owner-directed rework, 2026-11-03),
 * documented in docs/ORDERS.md §4.
 *
 * Intentionally PURE: no database, no request context, no `server-only`
 * import. This is the ONLY place that decides whether a status change is
 * legal and what an order's calculated status is; the service layer calls it
 * and does nothing else to make that decision.
 *
 * Items:  PENDING → (worker accepts) PROCESSING → (worker) DONE
 *         DONE → (admin) REFILL → (worker) DONE;  any → (admin) CANCELLED
 * Orders: PENDING / ASSIGNED / PROCESSING / PARTIALLY_COMPLETED / COMPLETED
 *         are calculated from the items (`deriveOrderStatus`) — nobody sets
 *         them. An admin then moves COMPLETED → DELIVERED → FINALIZED, can
 *         send any of those three to IN_REVISION (back to DELIVERED when the
 *         changes are done), and can mark any open order Refunded / Cancelled.
 */

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/** What someone who manages every order (`orders.view.all`) may do to an item. */
export const ITEM_TRANSITIONS: Record<OrderItemStatus, readonly OrderItemStatus[]> = {
  // PENDING -> PROCESSING is "accept"; an admin may do it on the worker's
  // behalf, and only once a worker is assigned (checked in the service).
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["DONE", "CANCELLED"],
  // Owner's choice, 2026-11-03: only an admin sends a done item to Refill.
  DONE: ["REFILL", "CANCELLED"],
  REFILL: ["DONE", "CANCELLED"],
  CANCELLED: [],
};

/**
 * What the assigned worker may do to their OWN item: accept it (straight into
 * Processing — no separate Start, owner request 2026-11-03), mark it done,
 * and mark a refill done. Never cancel, never reopen.
 */
export const WORKER_ITEM_TRANSITIONS: Record<OrderItemStatus, readonly OrderItemStatus[]> = {
  PENDING: ["PROCESSING"],
  PROCESSING: ["DONE"],
  DONE: [],
  REFILL: ["DONE"],
  CANCELLED: [],
};

export function canTransitionItem(
  from: OrderItemStatus,
  to: OrderItemStatus,
  options: { asAssignedWorkerOnly: boolean },
): boolean {
  const table = options.asAssignedWorkerOnly ? WORKER_ITEM_TRANSITIONS : ITEM_TRANSITIONS;
  return table[from].includes(to);
}

export const ORDER_ITEM_STATUS_LABELS: Record<OrderItemStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  DONE: "Done",
  REFILL: "Refill",
  CANCELLED: "Cancelled",
};

/** Statuses in which an item still needs work. */
export const OPEN_ITEM_STATUSES: readonly OrderItemStatus[] = ["PENDING", "PROCESSING", "REFILL"];

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/** Calculated from the items; never set by hand. */
export const CALCULATED_ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "ASSIGNED",
  "PROCESSING",
  "PARTIALLY_COMPLETED",
  "COMPLETED",
];

/** Set by an admin; once there, the order no longer follows its items. */
export const MANUAL_ORDER_STATUSES: readonly OrderStatus[] = ["DELIVERED", "FINALIZED", "IN_REVISION", "CANCELLED"];

/** The order is closed: delivered, finalized or refunded/cancelled. */
export const CLOSED_ORDER_STATUSES: OrderStatus[] = ["DELIVERED", "FINALIZED", "CANCELLED"];

/** The manual steps an admin may take from each status. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["CANCELLED"],
  ASSIGNED: ["CANCELLED"],
  PROCESSING: ["CANCELLED"],
  PARTIALLY_COMPLETED: ["CANCELLED"],
  // Revision once it's done or delivered, even finalized (owner request, 2026-11-13).
  COMPLETED: ["DELIVERED", "IN_REVISION", "CANCELLED"],
  DELIVERED: ["FINALIZED", "IN_REVISION", "CANCELLED"],
  // Refund after finalizing is still possible.
  FINALIZED: ["IN_REVISION", "CANCELLED"],
  IN_REVISION: ["DELIVERED", "CANCELLED"],
  CANCELLED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export type DerivableItem = { status: OrderItemStatus; assigned: boolean };

/**
 * The order's status, worked out from its items (owner's rules, 2026-11-03):
 * - every item done                                  → Completed
 * - some done, the rest still open                   → Partially Completed
 * - every item accepted (Processing or Refill)       → Processing
 * - every item has a worker                          → Assigned
 * - otherwise (or no items)                          → Pending
 * Cancelled items are ignored. Once an admin has set Delivered, Finalized or
 * Refunded / Cancelled, that stays: the order no longer follows its items.
 */
export function deriveOrderStatus(current: OrderStatus, items: readonly DerivableItem[]): OrderStatus {
  if (MANUAL_ORDER_STATUSES.includes(current)) return current;
  const active = items.filter((item) => item.status !== "CANCELLED");
  if (active.length === 0) return "PENDING";
  const done = active.filter((item) => item.status === "DONE").length;
  if (done === active.length) return "COMPLETED";
  if (done > 0) return "PARTIALLY_COMPLETED";
  if (active.every((item) => item.status === "PROCESSING" || item.status === "REFILL")) return "PROCESSING";
  if (active.every((item) => item.assigned)) return "ASSIGNED";
  return "PENDING";
}

/** Human-readable labels, used consistently across list, detail and activity text. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  PROCESSING: "Processing",
  PARTIALLY_COMPLETED: "Partially Completed",
  COMPLETED: "Completed",
  DELIVERED: "Delivered",
  FINALIZED: "Finalized",
  IN_REVISION: "In revision",
  CANCELLED: "Refunded / Cancelled",
};

/** In display order. */
export const ORDER_STATUS_VALUES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];
