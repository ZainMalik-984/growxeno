import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, chmodSync, existsSync, unlinkSync } from "node:fs";

import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * A throwaway LOW-PRIVILEGE login for the data-boundary E2E tests
 * (tests/e2e/worker-boundaries.spec.ts): a real Supabase Auth identity holding
 * only the seeded Worker role, plus one outsourced worker and a customer, and the id of one
 * existing order that worker is NOT assigned to. Created before the test run
 * and deleted after, so no standing test account with a known password exists.
 *
 * Talks to Supabase Auth's admin REST endpoint directly rather than through
 * supabase-js, which does not run under Node 20. No email is sent
 * (`email_confirm: true`). The credentials go to a mode-600 file, never stdout.
 *
 *   tsx scripts/e2e-worker-fixture.ts create <credentials-file>
 *   tsx scripts/e2e-worker-fixture.ts delete <credentials-file>
 */

type Fixture = { email: string; password: string; userId: string; authUserId: string; outsourcedWorkerId: string; customerId: string; foreignOrderId: string | null; assignedOrderId: string; assignedOrderNumber: number; stamp: number; categoryId: string; serviceIds: string[] };

async function adminApi(path: string, init: RequestInit) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
  return fetch(`${url}/auth/v1/admin${path}`, {
    ...init,
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...init.headers },
  });
}

async function main() {
  const [mode, file] = process.argv.slice(2);
  if (!file || (mode !== "create" && mode !== "delete")) throw new Error("Usage: tsx scripts/e2e-worker-fixture.ts create|delete <credentials-file>");

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DIRECT_URL is required.");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    if (mode === "create") {
      const stamp = Date.now();
      const email = `e2e-worker-${stamp}@example.com`;
      const password = randomBytes(18).toString("base64url");

      const role = await prisma.role.findUniqueOrThrow({ where: { slug: "worker" }, select: { id: true } });
      const response = await adminApi("/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) });
      if (!response.ok) throw new Error(`Could not create the auth identity (HTTP ${response.status}).`);
      const authUserId = ((await response.json()) as { id: string }).id;

      const user = await prisma.user.create({
        data: { email, fullName: `E2E Test Worker ${stamp}`, authUserId, roles: { create: { roleId: role.id } } },
        select: { id: true },
      });
      const outsourced = await prisma.outsourcedWorker.create({ data: { name: `E2E Test Outsourced ${stamp}`, phone: "+92 300 7770000" }, select: { id: true } });
      const customer = await prisma.customer.create({ data: { name: `E2E Test Customer ${stamp}`, type: "INDIVIDUAL", email: `e2e-customer-${stamp}@example.com` }, select: { id: true } });
      const foreign = await prisma.order.findFirst({ select: { id: true }, orderBy: { orderNumber: "asc" } });

      // An order the worker IS assigned to: one item theirs, one item someone else's, with distinctive
      // prices/costs, so the test can prove none of the other data reaches them.
      const category = await prisma.category.create({ data: { name: `E2E Test Category ${stamp}`, slug: `e2e-test-category-${stamp}` }, select: { id: true } });
      const ownService = await prisma.service.create({ data: { name: `E2E Own Service ${stamp}`, categoryId: category.id, basePrice: 100 }, select: { id: true } });
      const otherService = await prisma.service.create({ data: { name: `E2E Other Service ${stamp}`, categoryId: category.id, basePrice: 100 }, select: { id: true } });
      const admin = await prisma.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
      const assigned = await prisma.order.create({
        data: { source: "EXTERNAL", customerId: customer.id, currency: "USD", totalAmount: 679, status: "IN_PROGRESS", deadline: new Date(Date.now() + 86400000), createdById: admin.id },
        select: { id: true, orderNumber: true },
      });
      await prisma.orderItem.create({ data: { orderId: assigned.id, serviceId: ownService.id, categoryId: category.id, workerId: user.id, workerCost: 67.89, workerCostCurrency: "PKR", status: "IN_PROGRESS" } });
      await prisma.orderItem.create({ data: { orderId: assigned.id, serviceId: otherService.id, categoryId: category.id, outsourcedWorkerId: outsourced.id, workerCost: 9999.99, workerCostCurrency: "PKR", status: "IN_PROGRESS" } });

      const fixture: Fixture = { email, password, userId: user.id, authUserId, outsourcedWorkerId: outsourced.id, customerId: customer.id, foreignOrderId: foreign?.id ?? null, assignedOrderId: assigned.id, assignedOrderNumber: assigned.orderNumber, stamp, categoryId: category.id, serviceIds: [ownService.id, otherService.id] };
      writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
      chmodSync(file, 0o600);
      console.log("created a throwaway worker login (credentials written to the file, not printed)");
      return;
    }

    if (!existsSync(file)) return;
    const fixture = JSON.parse(readFileSync(file, "utf8")) as Fixture;
    await prisma.notification.deleteMany({ where: { recipientId: fixture.userId } });
    await prisma.notificationPreference.deleteMany({ where: { userId: fixture.userId } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: fixture.userId } });
    await prisma.user.deleteMany({ where: { id: fixture.userId } });
    await prisma.orderActivity.deleteMany({ where: { orderId: fixture.assignedOrderId } });
    await prisma.orderItem.deleteMany({ where: { orderId: fixture.assignedOrderId } });
    await prisma.order.deleteMany({ where: { id: fixture.assignedOrderId } });
    await prisma.service.deleteMany({ where: { id: { in: fixture.serviceIds } } });
    await prisma.category.deleteMany({ where: { id: fixture.categoryId } });
    await prisma.outsourcedWorker.deleteMany({ where: { id: fixture.outsourcedWorkerId } });
    await prisma.customer.deleteMany({ where: { id: fixture.customerId } });
    const removed = await adminApi(`/users/${fixture.authUserId}`, { method: "DELETE" });
    unlinkSync(file);
    console.log(`deleted the throwaway worker (auth identity removal: HTTP ${removed.status})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("e2e-worker-fixture failed:", (error as Error).message);
  process.exitCode = 1;
});
