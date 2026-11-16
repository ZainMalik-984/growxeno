import "server-only";

import { prisma } from "@/lib/db/prisma";
import { countUnreadByItem } from "./item-updates-unread";

/**
 * The signed-in person's unread update notifications, per item id. Not tied to
 * the orders on the page, so it runs alongside the page's other queries
 * instead of after them (2026-11-16, page speed); it only reads their own
 * notifications (indexed on recipient + read).
 */
export async function unreadUpdatesByItem(userId: string): Promise<Record<string, number>> {
  const rows = await prisma.notification.findMany({
    where: { recipientId: userId, isRead: false, entityType: "Order", actionUrl: { contains: "updates=" } },
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
