import "server-only";

import type { OrderItemStatus, OrderSource, OrderStatus } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit/record";
import type { Actor } from "@/lib/auth/session";
import {
  runTransaction,
  ServiceRejection,
  serviceFailure as failure,
  type ServiceResult,
  type TransactionClient,
} from "@/lib/db/transaction";
import { emitNotificationEvent } from "@/lib/notifications/service";
import {
  allRequiredItemsComplete,
  canTransitionItem,
  canTransitionOrder,
  ORDER_ITEM_STATUS_LABELS,
  ORDER_STATUS_LABELS,
} from "./state-machine";
import { normalizeUrl, safeExternalHref } from "./url-normalize";

export type { ServiceResult };

/**
 * Order write operations (specification Sections 22, 24, 39–42, 62, 64),
 * documented in full in docs/ORDERS.md.
 *
 * Every function receives an ALREADY-AUTHORIZED actor and records its change
 * plus an `OrderActivity` row (and, for anything access/config-adjacent, an
 * `AuditLog` row) in the same transaction — the established pattern from
 * `src/lib/access/service.ts`.
 */

async function logActivity(
  tx: TransactionClient,
  orderId: string,
  actor: Actor,
  action: string,
  summary: string,
): Promise<void> {
  await tx.orderActivity.create({
    data: { orderId, actorId: actor.user.id, actorLabel: actor.user.fullName, action, summary },
  });
}

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

export type OrderInput = {
  source: OrderSource;
  externalReference?: string;
  customerId?: string | null;
  fiverrAccountId?: string | null;
  deadline?: string | null;
  notes?: string;
  currency?: string;
  /**
   * The whole order's price (owner-directed redesign, confirmed directly
   * 2026-09-27) — entered directly here, not derived from items, which carry
   * no price of their own any more. Optional: an order can exist before its
   * price is settled, the same looseness as its deadline before Process
   * Order. See docs/REQUIREMENTS.md D12.
   */
  totalAmount?: string;
};

function normalizeOrderInput(input: OrderInput) {
  return {
    source: input.source,
    externalReference: input.externalReference?.trim() || null,
    customerId: input.customerId || null,
    // Forced to null on an EXTERNAL order regardless of what was submitted —
    // confirmed directly, 2026-09-27: "fiverr account should be taken if
    // source is Fiverr." A stray value from a form that changed source after
    // picking an account is never trusted.
    fiverrAccountId: input.source === "FIVERR" ? input.fiverrAccountId || null : null,
    deadline: input.deadline ? new Date(input.deadline) : null,
    notes: input.notes?.trim() || null,
    currency: (input.currency?.trim() || "USD").toUpperCase(),
    totalAmount: input.totalAmount?.trim() || "0",
  };
}

export async function createOrder(
  actor: Actor,
  input: OrderInput,
): Promise<ServiceResult<{ id: string }>> {
  const data = normalizeOrderInput(input);
  if (data.source === "FIVERR" && !data.fiverrAccountId) {
    return failure("Choose which Fiverr account this order came in on.");
  }

  return runTransaction(async (tx) => {
    if (data.customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: data.customerId },
        select: { id: true },
      });
      if (!customer) throw new ServiceRejection("That customer no longer exists.");
    }
    if (data.fiverrAccountId) {
      const fiverrAccount = await tx.fiverrAccount.findUnique({ where: { id: data.fiverrAccountId }, select: { id: true } });
      if (!fiverrAccount) throw new ServiceRejection("That Fiverr account no longer exists.");
    }

    const order = await tx.order.create({
      data: {
        source: data.source,
        externalReference: data.externalReference,
        customerId: data.customerId,
        fiverrAccountId: data.fiverrAccountId,
        deadline: data.deadline,
        notes: data.notes,
        currency: data.currency,
        totalAmount: data.totalAmount,
        createdById: actor.user.id,
      },
      select: { id: true, orderNumber: true },
    });

    await logActivity(tx, order.id, actor, "order.created", `Order #${order.orderNumber} created`);
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order.created",
      entityType: "Order",
      entityId: order.id,
      summary: `Created order #${order.orderNumber}`,
      newValue: { source: data.source, customerId: data.customerId },
    });

    return { id: order.id };
  });
}

export async function updateOrder(
  actor: Actor,
  orderId: string,
  input: OrderInput,
): Promise<ServiceResult> {
  const data = normalizeOrderInput(input);
  if (data.source === "FIVERR" && !data.fiverrAccountId) {
    return failure("Choose which Fiverr account this order came in on.");
  }

  return runTransaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true },
    });
    if (!existing) throw new ServiceRejection("That order no longer exists.");

    if (data.customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: data.customerId },
        select: { id: true },
      });
      if (!customer) throw new ServiceRejection("That customer no longer exists.");
    }
    if (data.fiverrAccountId) {
      const fiverrAccount = await tx.fiverrAccount.findUnique({ where: { id: data.fiverrAccountId }, select: { id: true } });
      if (!fiverrAccount) throw new ServiceRejection("That Fiverr account no longer exists.");
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        source: data.source,
        externalReference: data.externalReference,
        customerId: data.customerId,
        fiverrAccountId: data.fiverrAccountId,
        deadline: data.deadline,
        notes: data.notes,
        totalAmount: data.totalAmount,
      },
    });

    await logActivity(tx, orderId, actor, "order.updated", `Order #${existing.orderNumber} details updated`);
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order.updated",
      entityType: "Order",
      entityId: orderId,
      summary: `Updated order #${existing.orderNumber}`,
    });
  });
}

// ---------------------------------------------------------------------------
// Order status
// ---------------------------------------------------------------------------

export async function changeOrderStatus(
  actor: Actor,
  orderId: string,
  targetStatus: OrderStatus,
  reason?: string,
): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        status: true,
        createdById: true,
        items: { select: { status: true, workerId: true } },
      },
    });
    if (!order) throw new ServiceRejection("That order no longer exists.");

    if (!canTransitionOrder(order.status, targetStatus)) {
      throw new ServiceRejection(
        `Cannot move an order from ${ORDER_STATUS_LABELS[order.status]} to ${ORDER_STATUS_LABELS[targetStatus]}.`,
      );
    }

    if (targetStatus === "INTERNAL_REVIEW") {
      const itemStatuses = order.items.map((item) => item.status);
      if (!allRequiredItemsComplete(itemStatuses)) {
        throw new ServiceRejection(
          "Every item must be completed (or cancelled) before moving to Internal Review.",
        );
      }
    }
    if (targetStatus === "COMPLETED") {
      const hasOpenRevision = order.items.some((item) => item.status === "REVISION");
      if (hasOpenRevision) {
        throw new ServiceRejection("An item is still in Revision. Resolve it before completing the order.");
      }
    }
    if (targetStatus === "CANCELLED" && !reason?.trim()) {
      throw new ServiceRejection("A reason is required to cancel an order.");
    }
    if (targetStatus === "REVISION" && !reason?.trim()) {
      throw new ServiceRejection("A reason is required to send an order to Revision.");
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: targetStatus,
        // Revenue recognition point (docs/REQUIREMENTS.md D4): stamped each
        // time the order reaches DELIVERED, including a re-delivery after a
        // REVISION loop — the recognition date should reflect the delivery
        // that actually stuck, not the first attempt.
        ...(targetStatus === "DELIVERED" ? { deliveredAt: new Date() } : {}),
      },
    });

    const summary = reason
      ? `Order #${order.orderNumber} moved from ${ORDER_STATUS_LABELS[order.status]} to ${ORDER_STATUS_LABELS[targetStatus]}: ${reason}`
      : `Order #${order.orderNumber} moved from ${ORDER_STATUS_LABELS[order.status]} to ${ORDER_STATUS_LABELS[targetStatus]}`;
    await logActivity(tx, orderId, actor, "order.status_changed", summary);
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order.status_changed",
      entityType: "Order",
      entityId: orderId,
      summary,
      previousValue: { status: order.status },
      newValue: { status: targetStatus, reason: reason ?? null },
    });

    if (targetStatus === "REVISION") {
      const workerIds = [...new Set(order.items.map((item) => item.workerId).filter((id) => id !== null))];
      await emitNotificationEvent(
        tx,
        "ORDER_REVISED",
        workerIds.map((userId) => ({
          userId,
          title: `Order #${order.orderNumber} sent for revision`,
          message: reason ?? `Order #${order.orderNumber} was sent for revision.`,
          entityType: "Order",
          entityId: orderId,
          actionUrl: `/orders/${orderId}`,
        })),
        { orderId, reason: reason ?? null },
      );
    }
    if (targetStatus === "COMPLETED") {
      await emitNotificationEvent(
        tx,
        "ORDER_COMPLETED",
        [
          {
            userId: order.createdById,
            title: `Order #${order.orderNumber} completed`,
            message: `Order #${order.orderNumber} has been marked completed.`,
            entityType: "Order",
            entityId: orderId,
            actionUrl: `/orders/${orderId}`,
          },
        ],
        { orderId },
      );
    }
  });
}

/**
 * Process Order (specification Section 42, docs/ORDERS.md §5): the
 * PENDING -> PROCESSING transition, plus activating assigned items.
 *
 * No provider or queue call happens inside this transaction — only a
 * `NotificationOutbox` row recording intent. A dispatcher (Phase 8) drains it
 * afterwards, so this never fails because email/WhatsApp is unreachable.
 */
export async function processOrder(actor: Actor, orderId: string): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        status: true,
        deadline: true,
        items: {
          select: {
            id: true,
            serviceId: true,
            workerId: true,
            outsourcedWorkerId: true,
            status: true,
            service: { select: { name: true } },
          },
        },
      },
    });
    if (!order) throw new ServiceRejection("That order no longer exists.");
    if (!canTransitionOrder(order.status, "PROCESSING")) {
      throw new ServiceRejection(`Cannot process an order that is ${ORDER_STATUS_LABELS[order.status]}.`);
    }
    if (order.items.length === 0) {
      throw new ServiceRejection("Add at least one item before processing this order.");
    }
    if (!order.deadline) {
      throw new ServiceRejection("Set a deadline before processing this order.");
    }
    const unassigned = order.items.filter((item) => !item.workerId && !item.outsourcedWorkerId);
    if (unassigned.length > 0) {
      throw new ServiceRejection(
        `${unassigned.length} ${unassigned.length === 1 ? "item needs" : "items need"} a worker assigned before processing.`,
      );
    }

    await tx.order.update({ where: { id: orderId }, data: { status: "PROCESSING" } });

    const activatable = order.items.filter((item) => item.status === "PENDING");
    for (const item of activatable) {
      await tx.orderItem.update({ where: { id: item.id }, data: { status: "IN_PROGRESS" } });
    }

    await logActivity(
      tx,
      orderId,
      actor,
      "order.processed",
      `Order #${order.orderNumber} processed — ${activatable.length} item(s) activated`,
    );
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order.processed",
      entityType: "Order",
      entityId: orderId,
      summary: `Processed order #${order.orderNumber}`,
      newValue: { activatedItems: activatable.length },
    });

    await emitNotificationEvent(
      tx,
      "ORDER_PROCESSED",
      [],
      { orderId, orderNumber: order.orderNumber },
    );
    for (const item of activatable) {
      if (!item.workerId) continue; // outsourced workers have no in-app account to notify
      await emitNotificationEvent(
        tx,
        "ORDER_STARTED",
        [
          {
            userId: item.workerId,
            title: `Order #${order.orderNumber} started`,
            message: `"${item.service.name}" on order #${order.orderNumber} is now in progress.`,
            entityType: "Order",
            entityId: orderId,
            actionUrl: `/orders/${orderId}`,
          },
        ],
        { orderId, orderItemId: item.id },
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Order items
// ---------------------------------------------------------------------------

export type OrderItemInput = {
  serviceId: string;
  description?: string;
  deadline?: string | null;
  /**
   * Only meaningful when the chosen service has a `metricType` (owner-directed
   * redesign, confirmed directly 2026-09-27) — "if subscribers it would take
   * the channel link, number of subscribers required, current subscribers,
   * and a note." Required by this function when the service is a metric
   * service; ignored (and stored as null) otherwise.
   */
  channelLink?: string | null;
  targetCount?: number | null;
  currentCount?: number | null;
  workerCost?: string | null;
  workerCostCurrency?: string;
};

/** Validates and normalizes the metric fields against the chosen service's `metricType`, if any. */
function resolveMetricFields(
  service: { name: string; metricType: string | null },
  input: OrderItemInput,
): { channelLink: string | null; targetCount: number | null; currentCount: number | null } {
  if (!service.metricType) {
    return { channelLink: null, targetCount: null, currentCount: null };
  }
  const channelLink = input.channelLink?.trim() || null;
  if (!channelLink) throw new ServiceRejection(`"${service.name}" needs a channel link.`);
  if (!safeExternalHref(channelLink)) {
    throw new ServiceRejection("Enter a valid http or https channel link, including https://.");
  }
  if (input.targetCount === null || input.targetCount === undefined) {
    throw new ServiceRejection(`"${service.name}" needs how many are required.`);
  }
  if (!Number.isInteger(input.targetCount) || input.targetCount < 0) {
    throw new ServiceRejection("The required count must be a whole number, zero or more.");
  }
  const currentCount = input.currentCount ?? 0;
  if (!Number.isInteger(currentCount) || currentCount < 0) {
    throw new ServiceRejection("The current count must be a whole number, zero or more.");
  }
  return { channelLink, targetCount: input.targetCount, currentCount };
}

export async function addOrderItem(
  actor: Actor,
  orderId: string,
  input: OrderItemInput,
): Promise<ServiceResult<{ id: string }>> {
  return runTransaction(async (tx) => {
    const [order, service] = await Promise.all([
      tx.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } }),
      tx.service.findUnique({
        where: { id: input.serviceId },
        select: { id: true, name: true, categoryId: true, metricType: true },
      }),
    ]);
    if (!order) throw new ServiceRejection("That order no longer exists.");
    if (!service) throw new ServiceRejection("That service no longer exists.");

    const metric = resolveMetricFields(service, input);

    const item = await tx.orderItem.create({
      data: {
        orderId,
        serviceId: service.id,
        categoryId: service.categoryId,
        description: input.description?.trim() || null,
        deadline: input.deadline ? new Date(input.deadline) : null,
        channelLink: metric.channelLink,
        targetCount: metric.targetCount,
        currentCount: metric.currentCount,
        workerCost: input.workerCost?.trim() || null,
        workerCostCurrency: (input.workerCostCurrency?.trim() || "PKR").toUpperCase(),
      },
      select: { id: true },
    });

    await logActivity(
      tx,
      orderId,
      actor,
      "order_item.added",
      `Added item "${service.name}" to order #${order.orderNumber}`,
    );
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order_item.added",
      entityType: "Order",
      entityId: orderId,
      summary: `Added item "${service.name}" to order #${order.orderNumber}`,
      newValue: { itemId: item.id, serviceId: service.id },
    });

    return { id: item.id };
  });
}

export async function updateOrderItem(
  actor: Actor,
  itemId: string,
  input: OrderItemInput,
): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const existing = await tx.orderItem.findUnique({
      where: { id: itemId },
      select: { orderId: true, order: { select: { orderNumber: true } }, service: { select: { name: true } } },
    });
    if (!existing) throw new ServiceRejection("That item no longer exists.");

    const service = await tx.service.findUnique({
      where: { id: input.serviceId },
      select: { id: true, name: true, categoryId: true, metricType: true },
    });
    if (!service) throw new ServiceRejection("That service no longer exists.");

    const metric = resolveMetricFields(service, input);

    await tx.orderItem.update({
      where: { id: itemId },
      data: {
        serviceId: service.id,
        categoryId: service.categoryId,
        description: input.description?.trim() || null,
        deadline: input.deadline ? new Date(input.deadline) : null,
        channelLink: metric.channelLink,
        targetCount: metric.targetCount,
        currentCount: metric.currentCount,
        workerCost: input.workerCost?.trim() || null,
        workerCostCurrency: (input.workerCostCurrency?.trim() || "PKR").toUpperCase(),
      },
    });

    await logActivity(
      tx,
      existing.orderId,
      actor,
      "order_item.updated",
      `Updated item "${service.name}" on order #${existing.order.orderNumber}`,
    );
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order_item.updated",
      entityType: "Order",
      entityId: existing.orderId,
      summary: `Updated item "${service.name}" on order #${existing.order.orderNumber}`,
    });
  });
}

export async function removeOrderItem(actor: Actor, itemId: string): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: itemId },
      select: {
        orderId: true,
        order: { select: { orderNumber: true } },
        service: { select: { name: true } },
      },
    });
    if (!item) throw new ServiceRejection("That item no longer exists.");

    await tx.orderItem.delete({ where: { id: itemId } });
    await logActivity(
      tx,
      item.orderId,
      actor,
      "order_item.removed",
      `Removed item "${item.service.name}" from order #${item.order.orderNumber}`,
    );
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order_item.removed",
      entityType: "Order",
      entityId: item.orderId,
      summary: `Removed item "${item.service.name}" from order #${item.order.orderNumber}`,
    });
  });
}

/** Exactly one of `workerId` / `outsourcedWorkerId` may be set; pass both `null` to clear. */
export async function assignOrderItemWorker(
  actor: Actor,
  itemId: string,
  assignment: { workerId?: string | null; outsourcedWorkerId?: string | null },
): Promise<ServiceResult> {
  const workerId = assignment.workerId || null;
  const outsourcedWorkerId = assignment.outsourcedWorkerId || null;
  if (workerId && outsourcedWorkerId) {
    return failure("An item can be assigned to an internal worker or an outsourced worker, not both.");
  }

  return runTransaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: itemId },
      select: {
        orderId: true,
        order: { select: { orderNumber: true } },
        service: { select: { name: true } },
      },
    });
    if (!item) throw new ServiceRejection("That item no longer exists.");

    if (workerId) {
      const worker = await tx.user.findUnique({ where: { id: workerId }, select: { id: true, isActive: true } });
      if (!worker || !worker.isActive) throw new ServiceRejection("That user is not an active user.");
    }
    if (outsourcedWorkerId) {
      const worker = await tx.outsourcedWorker.findUnique({
        where: { id: outsourcedWorkerId },
        select: { id: true, isActive: true },
      });
      if (!worker || !worker.isActive) throw new ServiceRejection("That outsourced worker is not active.");
    }

    await tx.orderItem.update({ where: { id: itemId }, data: { workerId, outsourcedWorkerId } });

    const [assignee] = await Promise.all([
      workerId
        ? tx.user.findUnique({ where: { id: workerId }, select: { fullName: true } })
        : outsourcedWorkerId
          ? tx.outsourcedWorker.findUnique({ where: { id: outsourcedWorkerId }, select: { name: true } })
          : null,
    ]);
    const assigneeName = assignee ? ("fullName" in assignee ? assignee.fullName : assignee.name) : null;

    const summary = assigneeName
      ? `Assigned "${item.service.name}" on order #${item.order.orderNumber} to ${assigneeName}`
      : `Unassigned "${item.service.name}" on order #${item.order.orderNumber}`;
    await logActivity(tx, item.orderId, actor, "order_item.assigned", summary);
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order_item.assigned",
      entityType: "Order",
      entityId: item.orderId,
      summary,
      newValue: { itemId, workerId, outsourcedWorkerId },
    });

    // Outsourced workers have no in-app account — outbox intent only, no recipients.
    if (workerId) {
      await emitNotificationEvent(
        tx,
        "ORDER_ASSIGNED",
        [
          {
            userId: workerId,
            title: `Assigned to order #${item.order.orderNumber}`,
            message: `You were assigned "${item.service.name}" on order #${item.order.orderNumber}.`,
            entityType: "Order",
            entityId: item.orderId,
            actionUrl: `/orders/${item.orderId}`,
          },
        ],
        { orderId: item.orderId, orderItemId: itemId },
      );
    }
  });
}

export async function changeOrderItemStatus(
  actor: Actor,
  itemId: string,
  targetStatus: OrderItemStatus,
): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: itemId },
      select: {
        orderId: true,
        status: true,
        workerId: true,
        order: { select: { orderNumber: true } },
        service: { select: { name: true } },
      },
    });
    if (!item) throw new ServiceRejection("That item no longer exists.");

    const actingAsAssignedWorkerOnly = !actor.permissions.has("orders.view.all") && item.workerId === actor.user.id;

    if (!canTransitionItem(item.status, targetStatus, { asAssignedWorkerOnly: actingAsAssignedWorkerOnly })) {
      throw new ServiceRejection(
        `Cannot move this item from ${ORDER_ITEM_STATUS_LABELS[item.status]} to ${ORDER_ITEM_STATUS_LABELS[targetStatus]}.`,
      );
    }

    // finishedAt marks the two "earned" states (D5); a COMPLETED item flagged back to REVISION clears it.
    const finishedAt = targetStatus === "COMPLETED" || targetStatus === "CANCELLED" ? new Date() : null;
    await tx.orderItem.update({ where: { id: itemId }, data: { status: targetStatus, finishedAt } });

    const summary = `${actor.user.fullName} changed the item status of "${item.service.name}" on order #${item.order.orderNumber} from ${ORDER_ITEM_STATUS_LABELS[item.status]} to ${ORDER_ITEM_STATUS_LABELS[targetStatus]}`;
    await logActivity(tx, item.orderId, actor, "order_item.status_changed", summary);
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order_item.status_changed",
      entityType: "Order",
      entityId: item.orderId,
      summary,
      previousValue: { status: item.status },
      newValue: { status: targetStatus },
    });
  });
}

/**
 * Cancels an item and, in the same step, records what it actually owes the
 * worker — for the case an order is cancelled mid-progress and an outsourced
 * worker had already done partial work (confirmed directly 2026-09-17: e.g.
 * 500 of 1000 subscribers done before the customer cancelled; the worker is
 * still owed for the 500). A required note captures why, and doubles as the
 * durable record that "something like this happened" (docs/REQUIREMENTS.md
 * D5's follow-up) — no separate quantity/partial-completion schema exists;
 * the existing editable `workerCost` plus this note is the whole mechanism.
 *
 * `adjustedWorkerCost` is optional: omit it to cancel without touching cost
 * (nothing was done, or the item has no real per-item cost to begin with).
 * When the item has an outsourced worker, this also writes a
 * `NotificationOutbox` intent so a future dispatcher (Phase 8) can tell them
 * to stop — no message is sent today, same as every other outbox write.
 */
export async function cancelOrderItemWithAdjustedCost(
  actor: Actor,
  itemId: string,
  input: { adjustedWorkerCost?: string; note: string },
): Promise<ServiceResult> {
  const note = input.note.trim();
  if (!note) return failure("Explain why this item is being cancelled with an adjusted cost.");

  return runTransaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: itemId },
      select: {
        orderId: true,
        status: true,
        workerId: true,
        outsourcedWorkerId: true,
        workerCost: true,
        workerCostCurrency: true,
        order: { select: { orderNumber: true } },
        service: { select: { name: true } },
        outsourcedWorker: { select: { id: true, name: true } },
      },
    });
    if (!item) throw new ServiceRejection("That item no longer exists.");

    const actingAsAssignedWorkerOnly = !actor.permissions.has("orders.view.all") && item.workerId === actor.user.id;
    if (!canTransitionItem(item.status, "CANCELLED", { asAssignedWorkerOnly: actingAsAssignedWorkerOnly })) {
      throw new ServiceRejection(`Cannot cancel this item from ${ORDER_ITEM_STATUS_LABELS[item.status]}.`);
    }

    const previousWorkerCost = item.workerCost?.toString() ?? null;
    await tx.orderItem.update({
      where: { id: itemId },
      data: {
        status: "CANCELLED",
        finishedAt: new Date(),
        ...(input.adjustedWorkerCost !== undefined ? { workerCost: input.adjustedWorkerCost } : {}),
      },
    });

    // The activity feed is visible to anyone with `orders.activity.view` — including a worker on an
    // order they are assigned to — so it must not carry what a worker is paid. The exact figures are
    // in the audit log entry below (`audit.view`), which is where a cost change belongs.
    const costNote = input.adjustedWorkerCost !== undefined ? " Worker cost was adjusted." : "";
    const summary = `${actor.user.fullName} cancelled "${item.service.name}" on order #${item.order.orderNumber} with a note.${costNote}`;
    const auditSummary = `${summary.replace(" Worker cost was adjusted.", "")}${
      input.adjustedWorkerCost !== undefined
        ? ` Worker cost adjusted from ${previousWorkerCost ?? "unset"} to ${input.adjustedWorkerCost} ${item.workerCostCurrency}.`
        : ""
    }`;
    await logActivity(tx, item.orderId, actor, "order_item.cancelled_with_adjustment", summary);
    await tx.orderNote.create({ data: { orderId: item.orderId, body: note, authorId: actor.user.id } });
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order_item.cancelled_with_adjustment",
      entityType: "Order",
      entityId: item.orderId,
      summary: auditSummary,
      previousValue: { status: item.status, workerCost: previousWorkerCost },
      newValue: { status: "CANCELLED", workerCost: input.adjustedWorkerCost ?? previousWorkerCost, note },
    });

    if (item.outsourcedWorker) {
      // Outbox-only: an outsourced worker has no User row, so this never
      // produces an in-app Notification — recipients is deliberately empty.
      await emitNotificationEvent(tx, "ORDER_ITEM_STOP_WORK_REQUESTED", [], {
        orderId: item.orderId,
        orderItemId: itemId,
        outsourcedWorkerId: item.outsourcedWorker.id,
        outsourcedWorkerName: item.outsourcedWorker.name,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Order Item links (specification Sections 25, 27, 133, 134)
// ---------------------------------------------------------------------------

export async function addOrderItemLink(
  actor: Actor,
  orderItemId: string,
  input: { url: string; label?: string },
): Promise<ServiceResult<{ id: string }>> {
  let normalized: ReturnType<typeof normalizeUrl>;
  try {
    normalized = normalizeUrl(input.url);
  } catch {
    return failure("Enter a valid http or https URL, including https://.");
  }

  return runTransaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: orderItemId },
      select: { orderId: true, workerId: true, order: { select: { orderNumber: true } } },
    });
    if (!item) throw new ServiceRejection("That item no longer exists.");

    // Without `orders.edit`, an actor can only attach a link (their
    // deliverable, standing in for the file upload Section 44 asks for —
    // there is no Storage bucket, see docs/ARCHITECTURE.md §12 point 12) to
    // an item they are themselves assigned to, never someone else's.
    if (!actor.permissions.has("orders.edit") && item.workerId !== actor.user.id) {
      throw new ServiceRejection("You can only add links to items assigned to you.");
    }

    const link = await tx.orderItemLink.create({
      data: {
        orderItemId,
        url: input.url.trim(),
        normalizedUrl: normalized.normalizedUrl,
        domain: normalized.domain,
        path: normalized.path,
        label: input.label?.trim() || null,
        createdById: actor.user.id,
      },
      select: { id: true },
    });

    await logActivity(
      tx,
      item.orderId,
      actor,
      "order_item.link_added",
      `Added a link to order #${item.order.orderNumber}`,
    );

    return { id: link.id };
  });
}

export async function removeOrderItemLink(actor: Actor, linkId: string): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const link = await tx.orderItemLink.findUnique({
      where: { id: linkId },
      select: {
        orderItemId: true,
        orderItem: { select: { orderId: true, order: { select: { orderNumber: true } } } },
      },
    });
    if (!link) throw new ServiceRejection("That link no longer exists.");

    await tx.orderItemLink.delete({ where: { id: linkId } });
    await logActivity(
      tx,
      link.orderItem.orderId,
      actor,
      "order_item.link_removed",
      `Removed a link from order #${link.orderItem.order.orderNumber}`,
    );
  });
}

// ---------------------------------------------------------------------------
// Order notes (specification Section 62) — distinct from activity
// ---------------------------------------------------------------------------

export async function addOrderNote(
  actor: Actor,
  orderId: string,
  body: string,
): Promise<ServiceResult<{ id: string }>> {
  const trimmed = body.trim();
  if (!trimmed) return failure("Write a note before saving.");

  return runTransaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } });
    if (!order) throw new ServiceRejection("That order no longer exists.");

    const note = await tx.orderNote.create({
      data: { orderId, body: trimmed, authorId: actor.user.id },
      select: { id: true },
    });

    await logActivity(tx, orderId, actor, "order.note_added", `Added a note to order #${order.orderNumber}`);

    return { id: note.id };
  });
}
