import "server-only";

import { prisma } from "@/lib/db/prisma";
import { countUnreadByItem } from "./item-updates-unread";

/** The signed-in person's unread update notifications for these orders, per item id. */
export async function unreadUpdatesByItem(userId: string, orderIds: readonly string[]): Promise<Record<string, number>> {
  if (orderIds.length === 0) return {};
  const rows = await prisma.notification.findMany({
    where: { recipientId: userId, isRead: false, entityType: "Order", entityId: { in: [...orderIds] }, actionUrl: { contains: "updates=" } },
    select: { actionUrl: true },
  });
  return countUnreadByItem(rows.map((row) => row.actionUrl));
}

/** Marks the person's update notifications for this item read (they've opened its updates). */
export async function markItemUpdatesRead(userId: string, itemId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { recipientId: userId, isRead: false, actionUrl: { endsWith: `updates=${itemId}` } },
    data: { isRead: true, readAt: new Date() },
  });
  return result.count;
}
