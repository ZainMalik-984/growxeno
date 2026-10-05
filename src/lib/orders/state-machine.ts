import type { OrderItemStatus, OrderStatus } from "@/generated/prisma/client";

/**
 * The Order and Order Item state machines (specification Sections 39–41),
 * documented in full in docs/ORDERS.md §4.
 *
 * Intentionally PURE: no database, no request context, no `server-only`
 * import — same reasoning as `src/lib/permissions/resolve.ts`. This is the
 * ONLY place that decides whether a transition is legal; the service layer
 * calls it and does nothing else to make that decision.
 */

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["INTERNAL_REVIEW", "REVISION", "CANCELLED"],
  INTERNAL_REVIEW: ["READY_FOR_DELIVERY", "REVISION", "CANCELLED"],
  READY_FOR_DELIVERY: ["DELIVERED", "REVISION", "CANCELLED"],
  DELIVERED: ["COMPLETED", "REVISION"],
  REVISION: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/**
 * Full transition set for an actor with broad scope (`orders.view.all` —
 * an admin/manager, not just the assigned worker). A worker acting on their
 * own item is further restricted by `WORKER_ITEM_TRANSITIONS` below.
 */
export const ITEM_TRANSITIONS: Record<OrderItemStatus, readonly OrderItemStatus[]> = {
  PENDING: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["INTERNAL_REVIEW", "REVISION", "CANCELLED"],
  INTERNAL_REVIEW: ["COMPLETED", "REVISION", "CANCELLED"],
  REVISION: ["IN_PROGRESS", "CANCELLED"],
  // COMPLETED -> REVISION: flagging a completed item for redo after the fact
  // (specification-adjacent, confirmed directly 2026-09-17 — e.g. delivered
  // subscribers later unsubscribed). Admin-only: WORKER_ITEM_TRANSITIONS
  // below does not carry this, so a worker can never reopen their own
  // completed work themselves.
  COMPLETED: ["REVISION"],
  CANCELLED: [],
};

/**
 * What a worker may do to THEIR OWN item without broader scope (docs/ORDERS.md
 * §4): move it forward, but never mark it delivered/completed or cancel it —
 * those are review/administrative actions.
 */
export const WORKER_ITEM_TRANSITIONS: Record<OrderItemStatus, readonly OrderItemStatus[]> = {
  PENDING: ["IN_PROGRESS"],
  IN_PROGRESS: ["INTERNAL_REVIEW"],
  INTERNAL_REVIEW: [],
  REVISION: ["IN_PROGRESS"],
  COMPLETED: [],
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

/** Human-readable labels, used consistently across list, detail and activity text. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  IN_PROGRESS: "In Progress",
  INTERNAL_REVIEW: "Internal Review",
  READY_FOR_DELIVERY: "Ready for Delivery",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  REVISION: "Revision",
  CANCELLED: "Cancelled",
};

export const ORDER_ITEM_STATUS_LABELS: Record<OrderItemStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  INTERNAL_REVIEW: "Internal Review",
  REVISION: "Revision",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_VALUES = Object.keys(ORDER_TRANSITIONS) as OrderStatus[];

/**
 * Whether every item that counts toward completion is COMPLETED
 * (specification Section 41's "all required items", docs/REQUIREMENTS.md
 * D11 — open; until answered, "required" means every non-cancelled item).
 */
export function allRequiredItemsComplete(itemStatuses: readonly OrderItemStatus[]): boolean {
  const required = itemStatuses.filter((status) => status !== "CANCELLED");
  return required.length > 0 && required.every((status) => status === "COMPLETED");
}
