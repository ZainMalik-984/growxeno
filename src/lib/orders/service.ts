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
import { notifyEveryoneOnItem } from "@/lib/order-updates/service";
import { SERVICE_METRIC_TYPE_LABELS } from "@/lib/services/metric-type";
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
import { linkFieldFor } from "@/lib/services/link-field";
import { serviceLabel } from "@/lib/services/label";
import type { ServiceMetricType } from "@/lib/services/metric-type";
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
  service: { name: string; metricType: string | null; category?: { name: string } | null },
  input: OrderItemInput,
): { channelLink: string | null; targetCount: number | null; currentCount: number | null } {
  if (!service.metricType) {
    return { channelLink: null, targetCount: null, currentCount: null };
  }
  const channelLink = input.channelLink?.trim() || null;
  const noun = linkFieldFor(service.metricType as ServiceMetricType, service.category?.name).noun;
  if (!channelLink) throw new ServiceRejection(`"${service.name}" needs a ${noun} link.`);
  if (!safeExternalHref(channelLink)) {
    throw new ServiceRejection(`Enter a valid ${noun} link, including https://.`);
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
        select: { id: true, name: true, categoryId: true, metricType: true, category: { select: { name: true } } },
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
): Promise<ServiceResult<{ linkChanged: boolean }>> {
  return runTransaction(async (tx) => {
    const existing = await tx.orderItem.findUnique({
      where: { id: itemId },
      select: { orderId: true, channelLink: true, order: { select: { orderNumber: true } }, service: { select: { name: true } } },
    });
    if (!existing) throw new ServiceRejection("That item no longer exists.");

    const service = await tx.service.findUnique({
      where: { id: input.serviceId },
      select: { id: true, name: true, categoryId: true, metricType: true },
    });
    if (!service) throw new ServiceRejection("That service no longer exists.");

    const metric = resolveMetricFields(service, input);
    const linkChanged = (existing.channelLink ?? null) !== metric.channelLink;

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
        // A new link is a different channel/video: its stats start over
        // (the old readings stay in the history under their own source id).
        ...(linkChanged
          ? { statsSourceId: null, statsSourceKind: null, statsTitle: null, statsFetchedAt: null, statsCheckedAt: null, statsError: null }
          : {}),
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
    return { linkChanged };
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
): Promise<ServiceResult<{ notify: boolean }>> {
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
        service: { select: { name: true, metricType: true, category: { select: { name: true } } } },
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
            title: `New task: ${serviceLabel(item.service.name, item.service.category.name)}`,
            message: `You've been assigned "${serviceLabel(item.service.name, item.service.category.name)}" on order #${item.order.orderNumber}. Accept it to get started.`,
            entityType: "Order",
            entityId: item.orderId,
            // Opens the task's popup with Accept (2026-11-11), like the emailed link.
            actionUrl: `/orders?open=${itemId}`,
          },
        ],
        { orderId: item.orderId, orderItemId: itemId },
      );
    }

    // The caller sends the email / prepares WhatsApp after this commits (assignment-notify.ts).
    return { notify: reassigned && outsourcedWorkerId !== null };
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
    // Someone who doesn't see every order may only touch items assigned to them
    // (2026-11-12 access review: without this, the full admin transitions applied
    // to anyone else's item).
    if (!actor.permissions.has("orders.view.all") && !actingAsAssignedWorkerOnly) {
      throw new ServiceRejection("This item isn't assigned to you.");
    }

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
    // Someone who doesn't see every order may only touch items assigned to them
    // (2026-11-12 access review: without this, the full admin transitions applied
    // to anyone else's item).
    if (!actor.permissions.has("orders.view.all") && !actingAsAssignedWorkerOnly) {
      throw new ServiceRejection("This item isn't assigned to you.");
    }
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
  // Internal notes are the team's (2026-11-12 access review): an External
  // Worker holds orders.comment but must not write to orders' internal notes,
  // which they can't see. Workers talk to the team in an item's updates.
  if (!actor.permissions.has("orders.view.all")) return failure("Only the team can add internal notes. Use the task's updates instead.");

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


/**
 * Moves what's left of a task to another worker (2026-11-11, owner request):
 * the worker said they can't continue (a "WITHDRAW" request, see
 * src/lib/order-updates/service.ts), e.g. after 400 of 1,000 subscribers.
 * In one transaction:
 *   1. the old item is marked COMPLETED with its target cut to what was
 *      delivered (500 of 1,000 → a done item of 500), paid for that part
 *      (the admin confirms or edits the amount); with nothing delivered it is
 *      cancelled instead;
 *   2. a new item is created with the same service, link, links, worker
 *      deadline and target, STARTING where the old one stopped (so it asks for
 *      the remaining 600), and assigned to the new worker at the given cost;
 *   3. the request is closed with a note of what happened, the order's
 *      activity and audit log record it, and everyone on the order is told.
 * The caller then emails / prepares WhatsApp for the new worker, as for any assignment.
 */
export async function reassignRemainder(
  actor: Actor,
  input: {
    requestId: string;
    outsourcedWorkerId: string;
    cost: string;
    costCurrency: string;
    /** What the worker who gave up is paid for the part they did. */
    previousWorkerCost: string;
  },
): Promise<ServiceResult<{ newItemId: string }>> {
  return runTransaction(async (tx) => {
    const request = await tx.orderItemUpdate.findUnique({
      where: { id: input.requestId },
      select: { isRequest: true, requestType: true, resolvedAt: true, orderItemId: true, authorLabel: true },
    });
    if (!request || !request.isRequest || request.requestType !== "WITHDRAW") throw new ServiceRejection("That request no longer exists.");
    if (request.resolvedAt) throw new ServiceRejection("That request was already handled.");

    const item = await tx.orderItem.findUnique({
      where: { id: request.orderItemId },
      select: {
        id: true,
        orderId: true,
        serviceId: true,
        categoryId: true,
        description: true,
        channelLink: true,
        startingCount: true,
        currentCount: true,
        targetCount: true,
        deadline: true,
        deadlineOverridden: true,
        status: true,
        workerCost: true,
        workerCostCurrency: true,
        outsourcedWorkerId: true,
        statsSourceId: true,
        statsSourceKind: true,
        statsTitle: true,
        statsFetchedAt: true,
        order: { select: { orderNumber: true, deadline: true } },
        service: { select: { name: true, metricType: true, category: { select: { name: true } } } },
        outsourcedWorker: { select: { name: true, userId: true } },
        links: { select: { url: true, normalizedUrl: true, domain: true, path: true, label: true } },
      },
    });
    if (!item) throw new ServiceRejection("That item no longer exists.");
    if (!["PENDING", "PROCESSING", "REFILL"].includes(item.status)) throw new ServiceRejection("This task is already finished or cancelled.");
    if (!item.order.deadline) throw new ServiceRejection("Set the order deadline before assigning a worker.");
    if (input.outsourcedWorkerId === item.outsourcedWorkerId) throw new ServiceRejection("Choose a different worker for what's left.");

    const worker = await tx.outsourcedWorker.findUnique({ where: { id: input.outsourcedWorkerId }, select: { name: true, isActive: true, userId: true } });
    if (!worker || !worker.isActive) throw new ServiceRejection("That outsourced worker is not active.");

    const name = serviceLabel(item.service.name, item.service.category.name);
    const unit = item.service.metricType ? SERVICE_METRIC_TYPE_LABELS[item.service.metricType as ServiceMetricType].toLowerCase() : null;
    const start = Math.max(0, item.startingCount ?? 0);
    const now = item.currentCount ?? start;
    const done = Math.max(0, now - start);
    const left = Math.max(0, (item.targetCount ?? 0) - now);
    const previousName = item.outsourcedWorker?.name ?? request.authorLabel;
    const cost = input.cost.trim() || null;
    const costCurrency = (input.costCurrency.trim() || "PKR").toUpperCase();
    const previousCost = input.previousWorkerCost.trim() || "0";

    // 1. The old item (owner request, 2026-11-12): COMPLETED at what was
    //    delivered. Its target becomes the count it reached (500 of 1,000 →
    //    a done item of 500), paid for that part. With nothing delivered there
    //    is nothing to complete, so it is cancelled instead (unless a count
    //    exists for it, a metric-less item counts as nothing delivered).
    const completed = item.service.metricType !== null && done > 0;
    await tx.orderItem.update({
      where: { id: item.id },
      data: completed
        ? { status: "DONE", targetCount: now, finishedAt: new Date(), workerCost: previousCost }
        : { status: "CANCELLED", finishedAt: new Date(), workerCost: previousCost },
    });

    // 2. The new item: same work, starting where the old one stopped.
    const created = await tx.orderItem.create({
      data: {
        orderId: item.orderId,
        serviceId: item.serviceId,
        categoryId: item.categoryId,
        description: item.description,
        channelLink: item.channelLink,
        startingCount: now,
        currentCount: now,
        targetCount: item.targetCount,
        deadline: item.deadline,
        deadlineOverridden: item.deadlineOverridden,
        statsSourceId: item.statsSourceId,
        statsSourceKind: item.statsSourceKind,
        statsTitle: item.statsTitle,
        statsFetchedAt: item.statsFetchedAt,
        outsourcedWorkerId: input.outsourcedWorkerId,
        assignedById: actor.user.id,
        assignedAt: new Date(),
        workerCost: cost,
        workerCostCurrency: costCurrency,
        links: { create: item.links.map((link) => ({ url: link.url, normalizedUrl: link.normalizedUrl, domain: link.domain, path: link.path, label: link.label })) },
      },
      select: { id: true },
    });

    // 3. Close the request and record it.
    const moved = unit ? `${left.toLocaleString("en-US")} ${unit} moved to ${worker.name}` : `Moved to ${worker.name}`;
    await tx.orderItemUpdate.update({
      where: { id: input.requestId },
      data: { resolvedAt: new Date(), resolvedByLabel: actor.user.fullName.slice(0, 200), resolutionNote: moved.slice(0, 300) },
    });

    const summary = unit
      ? `${actor.user.fullName} marked ${previousName}'s part of "${name}" on order #${item.order.orderNumber} ${completed ? `completed at ${done.toLocaleString("en-US")} ${unit}` : "cancelled (nothing delivered)"} and moved the remaining ${left.toLocaleString("en-US")} ${unit} to ${worker.name}`
      : `${actor.user.fullName} moved "${name}" on order #${item.order.orderNumber} from ${previousName} to ${worker.name}`;
    await logActivity(tx, item.orderId, actor, "order_item.reassigned_remainder", summary);
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order_item.reassigned_remainder",
      entityType: "Order",
      entityId: item.orderId,
      summary: `${summary}. ${previousName} paid ${previousCost} ${item.workerCostCurrency} (was ${item.workerCost?.toString() ?? "unset"}); ${worker.name} at ${cost ?? "no cost"} ${costCurrency}.`,
      previousValue: { itemId: item.id, status: item.status, targetCount: item.targetCount, workerCost: item.workerCost?.toString() ?? null },
      newValue: {
        itemId: item.id,
        status: completed ? "DONE" : "CANCELLED",
        targetCount: completed ? now : item.targetCount,
        workerCost: previousCost,
        newItemId: created.id,
        outsourcedWorkerId: input.outsourcedWorkerId,
        cost,
        costCurrency,
      },
    });

    // Tell everyone on the order (and the worker who gave up), then the new worker their task.
    await notifyEveryoneOnItem(tx, actor, { id: item.id, orderId: item.orderId, workerId: null, outsourcedWorker: item.outsourcedWorker }, {
      title: `Reassigned: ${name} · #${item.order.orderNumber}`,
      message: `${actor.user.fullName}: ${moved}.`,
      // The worker who stopped isn't told who took over, or their pay.
      workerMessage: completed ? "Your part is marked completed and paid. What's left was given to another worker." : "What's left was given to another worker.",
    });
    if (worker.userId && worker.userId !== actor.user.id) {
      await emitNotificationEvent(
        tx,
        "ORDER_ASSIGNED",
        [
          {
            userId: worker.userId,
            title: `New task: ${name}`,
            message: unit
              ? `You've been assigned ${left.toLocaleString("en-US")} ${unit} of "${name}" on order #${item.order.orderNumber}. Accept it to get started.`
              : `You've been assigned "${name}" on order #${item.order.orderNumber}. Accept it to get started.`,
            entityType: "Order",
            entityId: item.orderId,
            actionUrl: `/orders?open=${created.id}`,
          },
        ],
        { orderId: item.orderId, orderItemId: created.id },
      );
    }
    await refreshOrderStatus(tx, item.orderId, actor);
    return { newItemId: created.id };
  });
}


/**
 * A worker turns down a task they haven't accepted (2026-11-12, owner request:
 * "he should have only two buttons, Accept and Reject"). The item goes back to
 * unassigned (no worker, no cost), the team is told with the reason, and it
 * shows as Unassigned for them to give to someone else.
 */
export async function rejectTask(actor: Actor, itemId: string, reason: string): Promise<ServiceResult> {
  const note = reason.trim().slice(0, 500);
  return runTransaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        orderId: true,
        status: true,
        workerId: true,
        outsourcedWorkerId: true,
        order: { select: { orderNumber: true } },
        service: { select: { name: true, category: { select: { name: true } } } },
        outsourcedWorker: { select: { name: true, userId: true } },
      },
    });
    if (!item) throw new ServiceRejection("That task no longer exists.");
    if (!isAssignedToIdentity(item, { userId: actor.user.id, outsourcedWorkerId: actor.outsourcedWorkerId })) {
      throw new ServiceRejection("This task isn't assigned to you.");
    }
    if (item.status !== "PENDING") throw new ServiceRejection("You've already accepted this task. Use Can't continue instead.");

    await tx.orderItem.update({
      where: { id: itemId },
      data: { workerId: null, outsourcedWorkerId: null, assignedById: null, assignedAt: null, workerCost: null },
    });

    const name = serviceLabel(item.service.name, item.service.category.name);
    const who = item.outsourcedWorker?.name ?? actor.user.fullName;
    const summary = `${who} rejected "${name}" on order #${item.order.orderNumber}${note ? `: "${note}"` : ""}`;
    await logActivity(tx, item.orderId, actor, "order_item.rejected", summary);
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "order_item.rejected",
      entityType: "Order",
      entityId: item.orderId,
      summary,
      previousValue: { itemId, outsourcedWorkerId: item.outsourcedWorkerId },
      newValue: { itemId, outsourcedWorkerId: null, reason: note || null },
    });
    // The team only: the item has no worker any more.
    await notifyEveryoneOnItem(tx, actor, { id: item.id, orderId: item.orderId, workerId: null, outsourcedWorker: null }, {
      title: `Task rejected: ${name} · #${item.order.orderNumber}`,
      message: `${who} rejected it${note ? `: "${note}"` : "."} Assign it to someone else.`,
    });
    await refreshOrderStatus(tx, item.orderId, actor);
  });
}
