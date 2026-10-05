import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Deletes the throwaway category/service/outsourced-worker/order created by
 * tests/e2e/orders.spec.ts for one run, identified by its timestamp.
 *
 * Run as a separate `tsx` process, not imported into the spec file directly:
 * Playwright's test transform loads .spec.ts files as ESM and cannot resolve
 * the generated Prisma client's CommonJS `exports` — `ReferenceError: exports
 * is not defined in ES module scope`. Shelling out sidesteps the mismatch
 * entirely, the same as every other manual cleanup run during development.
 *
 * Usage: tsx scripts/e2e-cleanup-orders.ts <stamp>
 *        tsx scripts/e2e-cleanup-orders.ts --order-id <uuid>   (a bare throwaway order with no
 *        customer or expenses — e.g. the refund-toggle test's; refuses anything else)
 */
async function main() {
  const stamp = process.argv[2];
  if (!stamp) throw new Error("Usage: tsx scripts/e2e-cleanup-orders.ts <stamp> | --order-id <uuid>");

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) return;

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    if (stamp === "--order-id") {
      const id = process.argv[3];
      const order = await prisma.order.findUnique({
        where: { id },
        select: { customerId: true, _count: { select: { expenses: true } } },
      });
      // Only ever a bare throwaway order — never something with real relationships.
      if (!order || order.customerId || order._count.expenses) return;
      await prisma.notification.deleteMany({ where: { entityType: "Order", entityId: id } });
      await prisma.orderActivity.deleteMany({ where: { orderId: id } });
      await prisma.orderNote.deleteMany({ where: { orderId: id } });
      await prisma.orderItem.deleteMany({ where: { orderId: id } });
      await prisma.order.delete({ where: { id } });
      return;
    }
    const categoryName = `E2E Test Category ${stamp}`;
    const serviceName = `E2E Test Service ${stamp}`;
    const workerName = `E2E Test Worker ${stamp}`;

    const orders = await prisma.order.findMany({
      where: { items: { some: { service: { name: serviceName } } } },
      select: { id: true },
    });
    for (const order of orders) {
      // Notification.entityId has no FK to Order (it's a generic optional
      // reference, per messaging.prisma), so these would otherwise become
      // orphaned rows pointing at a deleted order once cleanup runs below.
      await prisma.notification.deleteMany({ where: { entityType: "Order", entityId: order.id } });
      await prisma.orderActivity.deleteMany({ where: { orderId: order.id } });
      await prisma.orderNote.deleteMany({ where: { orderId: order.id } });
      await prisma.orderItemLink.deleteMany({ where: { orderItem: { orderId: order.id } } });
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
    await prisma.outsourcedWorker.deleteMany({ where: { name: workerName } });
    await prisma.service.deleteMany({ where: { name: serviceName } });
    await prisma.category.deleteMany({ where: { name: categoryName } });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // Best-effort cleanup: log and exit non-zero, but never mask the test's own result.
  console.error("e2e-cleanup-orders failed:", error);
  process.exitCode = 1;
});
