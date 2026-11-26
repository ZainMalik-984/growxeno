import "server-only";

import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/audit/record";
import type { ParsedFiverrOrder } from "./parser";

export type ProcessResult =
  | { status: "created"; orderId: string; orderNumber: number }
  | { status: "duplicate" }
  | { status: "no_account" };

/**
 * Create an Order from a parsed Fiverr order email.
 *
 * Uses Prisma directly (no Actor layer) because this runs in a trusted,
 * signature-verified webhook context. The first active admin user in the
 * database is recorded as the creator so the audit trail is meaningful.
 */
export async function createOrderFromEmail(
  parsed: ParsedFiverrOrder,
  fiverrAccountId: string,
): Promise<ProcessResult> {
  // Dedup: if we already have an order for this Fiverr order ID, skip it.
  const existing = await prisma.order.findFirst({
    where: { externalReference: parsed.orderId },
    select: { id: true },
  });
  if (existing) return { status: "duplicate" };

  // Find the first active admin user to record as the creator.
  const adminUser = await prisma.user.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, fullName: true },
  });
  if (!adminUser) {
    // Edge case: no users at all — shouldn't happen in a live app.
    throw new Error("No active users found to attribute the auto-created order to.");
  }

  const gigNote = parsed.gigTitle ? ` Gig: ${parsed.gigTitle}.` : "";
  const buyerNote = parsed.buyerName ? ` Buyer: ${parsed.buyerName}.` : "";

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        source: "FIVERR",
        fiverrAccountId,
        externalReference: parsed.orderId,
        orderDate: parsed.orderDate,
        status: "PENDING",
        totalAmount: parsed.amount,
        currency: parsed.currency,
        notes: `Auto-imported from Fiverr email.${buyerNote}${gigNote}`,
        createdById: adminUser.id,
      },
      select: { id: true, orderNumber: true },
    });

    await tx.orderActivity.create({
      data: {
        orderId: order.id,
        actorId: adminUser.id,
        actorLabel: "System (Fiverr Email Import)",
        action: "order.created",
        summary: `Order #${order.orderNumber} auto-created from Fiverr order email ${parsed.orderId}`,
      },
    });

    await recordAudit(tx, {
      actorUserId: adminUser.id,
      actorEmail: adminUser.email,
      action: "order.created",
      entityType: "Order",
      entityId: order.id,
      summary: `Auto-created order #${order.orderNumber} from Fiverr email (${parsed.orderId})`,
      newValue: {
        source: "FIVERR",
        fiverrAccountId,
        externalReference: parsed.orderId,
        buyerName: parsed.buyerName,
      },
    });

    return { status: "created" as const, orderId: order.id, orderNumber: order.orderNumber };
  });
}
