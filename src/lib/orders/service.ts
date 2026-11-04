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
import { isAssignedToIdentity } from "./assignment";
import { computeAssignmentCost } from "./rate";
import {
  canTransitionItem,
  canTransitionOrder,
  deriveOrderStatus,
  ORDER_ITEM_STATUS_LABELS,
  ORDER_STATUS_LABELS,
} from "./state-machine";
import { normalizeUrl, safeExternalHref } from "./url-normalize";
import { syncWorkerDeadlines } from "./worker-deadline-sync";
import { getWorkerDeadlineSettings } from "@/lib/settings/queries";
import { computeWorkerDeadline } from "@/lib/settings/worker-deadline";

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

/**
 * Recalculates the order's status from its items (owner-directed rework,
 * 2026-11-03 — see `deriveOrderStatus` in state-machine.ts) and records the
 * change. Called inside every transaction that changes an item's status,
 * assignment or existence, so the order can never disagree with its items.
 */
async function refreshOrderStatus(tx: TransactionClient, orderId: string, actor: Actor): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      orderNumber: true,
      createdById: true,
      items: { select: { status: true, workerId: true, outsourcedWorkerId: true } },
    },
  });
  if (!order) return;
  const next = deriveOrderStatus(
    order.status,
    order.items.map((item) => ({ status: item.status, assigned: Boolean(item.outsourcedWorkerId || item.workerId) })),
  );
  if (next === order.status) return;

  await tx.order.update({ where: { id: orderId }, data: { status: next } });
  await logActivity(
    tx,
    orderId,
    actor,
    "order.status_changed",
    `Order #${order.orderNumber} is now ${ORDER_STATUS_LABELS[next]} (updated automatically from its items)`,
  );
  if (next === "COMPLETED") {
    await emitNotificationEvent(
      tx,
      "ORDER_COMPLETED",
      [
        {
          userId: order.createdById,
          title: `Order #${order.orderNumber} completed`,
          message: `Every item on order #${order.orderNumber} is done. It's ready to deliver.`,
          entityType: "Order",
          entityId: orderId,
          actionUrl: `/orders/${orderId}`,
        },
      ],
      { orderId },
    );
  }
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
      select: { orderNumber: true, deadline: true },
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

    // Items that follow the order get their worker deadline moved with it.
    if ((existing.deadline?.getTime() ?? null) !== (data.deadline?.getTime() ?? null)) {
      await syncWorkerDeadlines(tx, [orderId]);
    }

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

/**
 * The manual order steps (owner-directed rework, 2026-11-03): Completed →
 * Delivered → Finalized, and Refunded / Cancelled from any status. Every other
 * status is calculated from the items (`refreshOrderStatus`), so nobody can
 * set it here — `canTransitionOrder` only allows these three targets.
 */
export async function changeOrderStatus(
  actor: Actor,
  orderId: string,
  targetStatus: OrderStatus,
  reason?: string,
): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true, status: true },
    });
    if (!order) throw new ServiceRejection("That order no longer exists.");

    if (!canTransitionOrder(order.status, targetStatus)) {
      throw new ServiceRejection(
        `Cannot move an order from ${ORDER_STATUS_LABELS[order.status]} to ${ORDER_STATUS_LABELS[targetStatus]}.`,
      );
    }
    if (targetStatus === "CANCELLED" && !reason?.trim()) {
      throw new ServiceRejection("A reason is required to refund or cancel an order.");
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: targetStatus,
        // Revenue recognition point (docs/REQUIREMENTS.md D4).
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
  // No workerCost/workerCostCurrency here, 2026-10-08 — cost now lives
  // entirely with assignment (`assignOrderItemWorker`), computed from the
  // assigned External Worker's `ServiceRate`. There is exactly one place
  // to set it, not two (this input used to carry it too, redundantly).
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
    const [order, service, deadlineSettings] = await Promise.all([
      tx.order.findUnique({ where: { id: orderId }, select: { orderNumber: true, deadline: true, createdAt: true } }),
      tx.service.findUnique({
        where: { id: input.serviceId },
        select: { id: true, name: true, categoryId: true, metricType: true },
      }),
      getWorkerDeadlineSettings(tx),
    ]);
    if (!order) throw new ServiceRejection("That order no longer exists.");
    if (!service) throw new ServiceRejection("That service no longer exists.");

    const metric = resolveMetricFields(service, input);
    // A deadline given here is a manual one; otherwise the item follows the order.
    const manualDeadline = input.deadline ? new Date(input.deadline) : null;

    const item = await tx.orderItem.create({
      data: {
        orderId,
        serviceId: service.id,
        categoryId: service.categoryId,
        description: input.description?.trim() || null,
        deadline: manualDeadline ?? computeWorkerDeadline(order.deadline, order.createdAt, deadlineSettings),
        deadlineOverridden: manualDeadline !== null,
        channelLink: metric.channelLink,
        targetCount: metric.targetCount,
        currentCount: metric.currentCount,
        // Snapshotted ONLY here, never touched again by updateOrderItem or
        // updateOrderItemProgress — see the schema doc comment on this
        // column for why (2026-10-05): the progress bar must measure actual
        // work done since creation, not restate the count the item already
        // had before any work started.
        startingCount: metric.currentCount,
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
    await refreshOrderStatus(tx, orderId, actor);

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
        // No deadline here: it has its own inline editor and action
        // (setOrderItemDeadline), so saving other details never resets it.
        channelLink: metric.channelLink,
        targetCount: metric.targetCount,
        currentCount: metric.currentCount,
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

/**
 * Sets an item's worker deadline by hand, or (`deadline: null`) puts it back
 * on automatic, following the order deadline and the settings again.
 * Owner request, 2026-11-03: editable from the item itself, one click away.
 */
export async function setOrderItemDeadline(
  actor: Actor,
  itemId: string,
  deadline: Date | null,
): Promise<ServiceResult<{ deadline: Date | null; overridden: boolean }>> {
  return runTransaction(async (tx) => {
    const [item, settings] = await Promise.all([
      tx.orderItem.findUnique({
        where: { id: itemId },
        select: {
          orderId: true,
          deadline: true,
          service: { select: { name: true } },
          order: { select: { orderNumber: true, deadline: true, createdAt: true } },
        },
      }),
      deadline ? Promise.resolve(null) : getWorkerDeadlineSettings(tx),
    ]);
    if (!item) throw new ServiceRejection("That item no longer exists.");

    const next = deadline ?? computeWorkerDeadline(item.order.deadline, item.order.createdAt, settings!);
    const overridden = deadline !== null;
    await tx.orderItem.update({ where: { id: itemId }, data: { deadline: next, deadlineOverridden: overridden } });

    const label = next ? `${next.toISOString().slice(0, 16).replace("T", " ")} UTC` : "none";
    const summary = overridden
      ? `Set the deadline of "${item.service.name}" on order #${item.order.orderNumber} to ${label}`
      : `Reset the deadline of "${item.service.name}" on order #${item.order.orderNumber} to automatic (${label})`;
    await logActivity(tx, item.orderId, actor, "order_item.deadline_changed", summary);
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order_item.deadline_changed",
      entityType: "Order",
      entityId: item.orderId,
      summary,
      previousValue: { itemId, deadline: item.deadline?.toISOString() ?? null },
      newValue: { itemId, deadline: next?.toISOString() ?? null, overridden },
    });

    return { deadline: next, overridden };
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
    await refreshOrderStatus(tx, item.orderId, actor);
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

/**
 * Assignment is External-Worker-only going forward — owner-directed,
 * confirmed directly (2026-10-08): "employees wont be assigned a order
 * item its assigned to oursourced(external) only." Pass `outsourcedWorkerId:
 * null` to unassign. `cost`/`costCurrency` are optional:
 * - Omitted entirely → auto-computed from `ServiceRate` (rate × the
 *   metric's required count — target minus starting, never charging for
 *   units the channel already had — or a flat rate for a non-metric
 *   service), left blank if no rate is configured. Never blocks the
 *   assignment either way.
 * - Provided (including `""`, meaning "no cost") → used exactly as given.
 *   "anyone putting the item there should be able to change the amount
 *   for it" — the auto-fill is a UX convenience, not a locked value.
 */
export async function assignOrderItemWorker(
  actor: Actor,
  itemId: string,
  assignment: { outsourcedWorkerId: string | null; cost?: string | null; costCurrency?: string },
): Promise<ServiceResult> {
  const outsourcedWorkerId = assignment.outsourcedWorkerId || null;

  return runTransaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: itemId },
      select: {
        orderId: true,
        serviceId: true,
        targetCount: true,
        startingCount: true,
        status: true,
        outsourcedWorkerId: true,
        order: { select: { orderNumber: true, deadline: true } },
        service: { select: { name: true, metricType: true } },
      },
    });
    if (!item) throw new ServiceRejection("That item no longer exists.");
    // Owner's choice, 2026-11-03: the deadline is needed before work is handed
    // out (it used to be needed for the removed "Process order" step), and the
    // worker's own deadline is calculated from it.
    if (outsourcedWorkerId && !item.order.deadline) {
      throw new ServiceRejection("Set the order deadline before assigning a worker.");
    }

    let cost: string | null = null;
    let costCurrency = "PKR";
    let assigneeName: string | null = null;
    let assigneeUserId: string | null = null;

    if (outsourcedWorkerId) {
      const worker = await tx.outsourcedWorker.findUnique({
        where: { id: outsourcedWorkerId },
        select: { name: true, isActive: true, userId: true },
      });
      if (!worker || !worker.isActive) throw new ServiceRejection("That outsourced worker is not active.");
      assigneeName = worker.name;
      assigneeUserId = worker.userId;

      if (assignment.cost !== undefined) {
        cost = assignment.cost?.trim() || null;
        costCurrency = (assignment.costCurrency?.trim() || "PKR").toUpperCase();
      } else {
        const rate = await tx.serviceRate.findUnique({
          where: { serviceId_outsourcedWorkerId: { serviceId: item.serviceId, outsourcedWorkerId } },
          select: { rate: true, currency: true },
        });
        const computed = computeAssignmentCost(
          { metricType: item.service.metricType, targetCount: item.targetCount, startingCount: item.startingCount },
          rate ? { rate: rate.rate.toString(), currency: rate.currency } : null,
        );
        if (computed) {
          cost = computed.cost;
          costCurrency = computed.currency;
        }
      }
    }

    // A changed assignee (a new worker, or clearing one) restarts the
    // accept → start → pause/resume cycle for whoever holds the item now —
    // owner-directed, confirmed directly (2026-10-15): acceptance is a
    // deliberate per-assignment step, so a reassignment must not inherit the
    // previous assignee's ASSIGNED/IN_PROGRESS/PAUSED progress. A finished
    // item (COMPLETED/CANCELLED) is left alone — reassignment there is just
    // a record correction, not a new work cycle.
    const reassigned = outsourcedWorkerId !== item.outsourcedWorkerId;
    const resetStatus = reassigned && item.status !== "DONE" && item.status !== "CANCELLED";

    await tx.orderItem.update({
      where: { id: itemId },
      data: {
        workerId: null, // the deprecated path — see its schema doc comment
        outsourcedWorkerId,
        assignedById: outsourcedWorkerId ? actor.user.id : null,
        workerCost: cost,
        workerCostCurrency: costCurrency,
        ...(reassigned ? { assignedAt: outsourcedWorkerId ? new Date() : null } : {}),
        ...(resetStatus ? { status: "PENDING" as const } : {}),
      },
    });

    const summary = assigneeName
      ? `Assigned "${item.service.name}" on order #${item.order.orderNumber} to ${assigneeName}${cost ? ` at ${cost} ${costCurrency}` : ""}`
      : `Unassigned "${item.service.name}" on order #${item.order.orderNumber}`;
    await logActivity(tx, item.orderId, actor, "order_item.assigned", summary);
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order_item.assigned",
      entityType: "Order",
      entityId: item.orderId,
      summary,
      newValue: { itemId, outsourcedWorkerId, cost, costCurrency },
    });
    await refreshOrderStatus(tx, item.orderId, actor);

    // Notify the assignee only if they're onboarded with portal access
    // (`OutsourcedWorker.userId` — see its schema doc comment); a pure
    // cost-tracking worker with no login has nothing to receive this in.
    if (reassigned && assigneeUserId) {
      await emitNotificationEvent(
        tx,
        "ORDER_ASSIGNED",
        [
          {
            userId: assigneeUserId,
            title: `New task: ${item.service.name}`,
            message: `You've been assigned "${item.service.name}" on order #${item.order.orderNumber}. Accept it to get started.`,
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
        outsourcedWorkerId: true,
        order: { select: { orderNumber: true } },
        service: { select: { name: true } },
        outsourcedWorker: { select: { userId: true } },
      },
    });
    if (!item) throw new ServiceRejection("That item no longer exists.");

    const actingAsAssignedWorkerOnly =
      !actor.permissions.has("orders.view.all") &&
      isAssignedToIdentity(item, { userId: actor.user.id, outsourcedWorkerId: actor.outsourcedWorkerId });

    if (!canTransitionItem(item.status, targetStatus, { asAssignedWorkerOnly: actingAsAssignedWorkerOnly })) {
      throw new ServiceRejection(
        `Cannot move this item from ${ORDER_ITEM_STATUS_LABELS[item.status]} to ${ORDER_ITEM_STATUS_LABELS[targetStatus]}.`,
      );
    }
    if (targetStatus === "PROCESSING" && !item.outsourcedWorkerId && !item.workerId) {
      throw new ServiceRejection("Assign a worker to this item before it can be accepted.");
    }

    // finishedAt marks the two "earned" states (D5); a done item sent to Refill clears it.
    const finishedAt = targetStatus === "DONE" || targetStatus === "CANCELLED" ? new Date() : null;
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

    // A refill is new work for the worker: tell them (if they can log in).
    if (targetStatus === "REFILL" && item.outsourcedWorker?.userId) {
      await emitNotificationEvent(
        tx,
        "ORDER_REVISED",
        [
          {
            userId: item.outsourcedWorker.userId,
            title: `Refill needed: ${item.service.name}`,
            message: `"${item.service.name}" on order #${item.order.orderNumber} needs a refill.`,
            entityType: "Order",
            entityId: item.orderId,
            actionUrl: `/orders/${item.orderId}`,
          },
        ],
        { orderId: item.orderId, orderItemId: itemId },
      );
    }
    await refreshOrderStatus(tx, item.orderId, actor);
  });
}

/**
 * Updates ONLY `currentCount` — a deliberately narrow sibling of the full
 * `updateOrderItem` edit, confirmed directly (2026-10-05): "worker or myself
 * should be able to update progress at any time so that i know 1500/6000
 * views are completed." The same actors who may change this item's status
 * may update its progress (the assigned worker on their own item, or anyone
 * with `orders.view.all`) — a worker gets a quick way to report progress
 * without the broader edit rights `orders.edit` would otherwise require
 * (changing the service, the deadline, the worker cost, ...).
 *
 * Not capped at `targetCount`: over-delivery is a real, meaningful state
 * (worth seeing as "6200 / 6000", not silently clamped to 100%) — only the
 * aggregate progress bar on the orders list clamps per item, for the bar
 * itself to never visually exceed full.
 */
export async function updateOrderItemProgress(
  actor: Actor,
  itemId: string,
  currentCount: number,
): Promise<ServiceResult> {
  if (!Number.isInteger(currentCount) || currentCount < 0) {
    return failure("Enter a whole number, zero or more.");
  }

  return runTransaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: itemId },
      select: {
        orderId: true,
        workerId: true,
        outsourcedWorkerId: true,
        currentCount: true,
        targetCount: true,
        order: { select: { orderNumber: true } },
        service: { select: { name: true, metricType: true } },
      },
    });
    if (!item) throw new ServiceRejection("That item no longer exists.");
    if (!item.service.metricType) throw new ServiceRejection("This item has no progress to track.");

    const isAssignedWorker = isAssignedToIdentity(item, { userId: actor.user.id, outsourcedWorkerId: actor.outsourcedWorkerId });
    if (!actor.permissions.has("orders.view.all") && !isAssignedWorker) {
      throw new ServiceRejection("You may only update progress on an item assigned to you.");
    }

    await tx.orderItem.update({ where: { id: itemId }, data: { currentCount } });

    const summary = `${actor.user.fullName} updated progress on "${item.service.name}" on order #${item.order.orderNumber} to ${currentCount} / ${item.targetCount ?? 0}`;
    await logActivity(tx, item.orderId, actor, "order_item.progress_updated", summary);
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order_item.progress_updated",
      entityType: "Order",
      entityId: item.orderId,
      summary,
      previousValue: { currentCount: item.currentCount },
      newValue: { currentCount },
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

    const actingAsAssignedWorkerOnly =
      !actor.permissions.has("orders.view.all") &&
      isAssignedToIdentity(item, { userId: actor.user.id, outsourcedWorkerId: actor.outsourcedWorkerId });
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
    await refreshOrderStatus(tx, item.orderId, actor);
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
