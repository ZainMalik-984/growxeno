import "server-only";

import { Prisma, type OrderStatus } from "@/generated/prisma/client";
import type { TransactionClient } from "@/lib/db/transaction";
import { getWorkerDeadlineSettings } from "@/lib/settings/queries";
import { computeWorkerDeadline, type WorkerDeadlineSettings } from "@/lib/settings/worker-deadline";

const DONE: OrderStatus[] = ["DELIVERED", "FINALIZED", "CANCELLED"];

/**
 * Rewrites the stored worker deadline of every item that still follows its
 * order (`deadline_overridden = false`), for the given orders. Called whenever
 * an order's deadline changes, and for all open orders when the settings
 * change. Items someone set by hand are never touched.
 *
 * Two round trips whatever the number of orders: read the orders, then one
 * UPDATE … FROM (VALUES …). One update per order would cost ~200ms each to
 * this project's database region (see src/lib/db/prisma.ts).
 *
 * Returns how many items were updated.
 */
export async function syncWorkerDeadlines(
  tx: TransactionClient,
  target: readonly string[] | { openOnly: true },
  settings?: WorkerDeadlineSettings,
): Promise<number> {
  const config = settings ?? (await getWorkerDeadlineSettings(tx));
  const orders = await tx.order.findMany({
    where: Array.isArray(target) ? { id: { in: [...target] } } : { status: { notIn: DONE } },
    select: { id: true, deadline: true, createdAt: true },
  });
  if (orders.length === 0) return 0;

  const rows = orders.map((order) => {
    const deadline = computeWorkerDeadline(order.deadline, order.createdAt, config);
    return Prisma.sql`(${order.id}::uuid, ${deadline}::timestamptz)`;
  });

  return tx.$executeRaw`
    UPDATE order_items AS i
    SET deadline = v.deadline, updated_at = now()
    FROM (VALUES ${Prisma.join(rows)}) AS v(order_id, deadline)
    WHERE i.order_id = v.order_id
      AND i.deadline_overridden = false
      AND i.deadline IS DISTINCT FROM v.deadline
  `;
}

/** The worker deadline a new item on this order starts with. */
export async function workerDeadlineForNewItem(tx: TransactionClient, orderId: string): Promise<Date | null> {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { deadline: true, createdAt: true } });
  if (!order?.deadline) return null;
  return computeWorkerDeadline(order.deadline, order.createdAt, await getWorkerDeadlineSettings(tx));
}
