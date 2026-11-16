import "server-only";

import type { OrderStatus } from "@/generated/prisma/client";
import type { AssignmentIdentity } from "@/lib/orders/assignment";
import { isAssignedToIdentity } from "@/lib/orders/assignment";
import { aggregateProgress } from "@/lib/orders/progress";
import type { OrderListItemRow, OrderListRow } from "@/lib/orders/queries";
import { CLOSED_ORDER_STATUSES, deriveOrderStatus, ORDER_ITEM_STATUS_LABELS, ORDER_STATUS_LABELS } from "@/lib/orders/state-machine";
import { ITEM_STATUS_TONE, ORDER_STATUS_TONE } from "@/lib/orders/status-tone";
import { safeExternalHref } from "@/lib/orders/url-normalize";
import { earliest, redactOrderListItems, type OrderVisibility } from "@/lib/orders/visibility";
import { SERVICE_METRIC_TYPE_LABELS } from "@/lib/services/metric-type";
import { orderSourceInfo } from "@/lib/orders/source-info";
import type { OrdersTableRow } from "./orders-table";

/**
 * Orders-list rows for the client table, built on the SERVER so a value the
 * actor may not see never reaches the browser (src/lib/orders/visibility.ts).
 * Shared by the Orders page and a customer's page (2026-11-15).
 */
export function toOrdersTableRows(
  rows: readonly OrderListRow[],
  {
    identity,
    visibility,
    canChangeItemStatus,
    now = new Date(),
    unreadByItem = {},
  }: {
    identity: AssignmentIdentity;
    visibility: OrderVisibility;
    canChangeItemStatus: boolean;
    now?: Date;
    /** Unread update notifications per item for the viewer (2026-11-15). */
    unreadByItem?: Record<string, number>;
  },
): OrdersTableRow[] {
  // A worker's own pending items get Accept, the same rule as the order page's Accept.
  const canAcceptItem = (item: OrderListItemRow) =>
    canChangeItemStatus &&
    item.status === "PENDING" &&
    isAssignedToIdentity({ workerId: item.workerId, outsourcedWorkerId: item.outsourcedWorker?.id ?? null }, identity);

  return rows.map((order) => {
    const visibleItems = redactOrderListItems(order.items, identity, visibility);
    const progress = aggregateProgress(
      visibleItems.map((item) => ({ targetCount: item.targetCount, currentCount: item.currentCount, startingCount: item.startingCount })),
    );
    // A worker's deadline is the earliest of their own items' deadlines, never the order's (2026-11-03).
    const deadline = visibility.orderDetails ? order.deadline : earliest(visibleItems.map((item) => item.deadline));
    // Same rule as redactOrderDetail: a worker's status comes from their own items.
    const rowStatus = visibility.orderDetails
      ? order.status
      : deriveOrderStatus(order.status, visibleItems.map((item) => ({ status: item.status, assigned: Boolean(item.worker || item.outsourcedWorker) })));

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      // Must match `showCustomer` exactly: this is a client component prop, so an unconditional value
      // would leak the customer's name into the page payload (tests/e2e/worker-boundaries.spec.ts).
      customerName: visibility.parties ? order.customerName : null,
      // Where the order came from (owner request, 2026-11-15): admins and employees only.
      source: orderSourceInfo(order, visibility),
      statusLabel: ORDER_STATUS_LABELS[rowStatus],
      statusTone: ORDER_STATUS_TONE[rowStatus],
      deadline,
      finished: CLOSED_ORDER_STATUSES.includes(order.status),
      isOverdue: isOrderOverdue(deadline, order.status, now),
      // A restricted worker counts only their own items, never the order's total.
      itemCount: visibility.allItems ? order.itemCount : visibleItems.length,
      amountLabel: visibility.prices ? `${order.totalAmount} ${order.currency}` : null,
      progressPercent: progress?.percent ?? null,
      channels: channelLinks(visibleItems.map((item) => ({ link: item.channelLink, title: item.channelTitle }))),
      openRequests: visibility.allItems ? visibleItems.filter((item) => item.hasOpenRequest).length : 0,
      withdrawRequests: visibility.allItems ? visibleItems.filter((item) => item.hasWithdrawRequest).length : 0,
      unreadUpdates: visibleItems.reduce((sum, item) => sum + (unreadByItem[item.id] ?? 0), 0),
      items: visibleItems.map((item) => ({
        id: item.id,
        channel: channelLinks([{ link: item.channelLink, title: item.channelTitle }])[0] ?? null,
        canAccept: canAcceptItem(item),
        unreadUpdates: unreadByItem[item.id] ?? 0,
        serviceName: item.serviceName,
        serviceTitle: item.serviceTitle,
        categoryName: item.categoryName,
        categoryImageUrl: item.categoryImageUrl,
        assigneeLabel: item.worker?.fullName ?? item.outsourcedWorker?.name ?? "Unassigned",
        assigned: Boolean(item.worker || item.outsourcedWorker),
        statusLabel: ORDER_ITEM_STATUS_LABELS[item.status],
        statusTone: ITEM_STATUS_TONE[item.status],
        metricLabel: item.metricType ? SERVICE_METRIC_TYPE_LABELS[item.metricType].toLowerCase() : null,
        startingCount: item.startingCount,
        currentCount: item.currentCount,
        targetCount: item.targetCount,
      })),
    };
  });
}

function isOrderOverdue(deadline: Date | null, status: OrderStatus, now: Date): boolean {
  return deadline !== null && deadline < now && !CLOSED_ORDER_STATUSES.includes(status);
}

/**
 * Distinct, safe-to-open channel links with a short label ("youtube.com/@channel").
 * A link that is not plain http(s) is dropped rather than rendered (safeExternalHref).
 */
export function channelLinks(
  links: ReadonlyArray<{ link: string | null; title: string | null }>,
): Array<{ href: string; label: string; title: string | null }> {
  const seen = new Set<string>();
  const result: Array<{ href: string; label: string; title: string | null }> = [];
  for (const { link, title } of links) {
    const href = link ? safeExternalHref(link) : null;
    if (!href || seen.has(href)) continue;
    seen.add(href);
    result.push({ href, label: shortLink(href), title });
  }
  return result;
}

export function shortLink(href: string): string {
  return href.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "");
}
