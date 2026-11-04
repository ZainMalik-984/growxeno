import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, chmodSync, existsSync, unlinkSync } from "node:fs";

import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * A throwaway External Worker login, for verifying the 2026-10-08 login
 * portal end to end: a real Supabase Auth identity holding the seeded
 * "External Worker" role, linked to a fresh `OutsourcedWorker` record, with
 * one order item assigned to them (with a service rate, so cost auto-fills
 * are also exercisable) and one item assigned to someone else, to prove
 * scoping.
 *
 * Mirrors scripts/e2e-worker-fixture.ts's shape and admin-REST approach
 * (supabase-js does not run under Node 20; no email is sent).
 *
 *   tsx scripts/e2e-external-worker-fixture.ts create <credentials-file>
 *   tsx scripts/e2e-external-worker-fixture.ts delete <credentials-file>
 */

type Fixture = {
  email: string;
  password: string;
  userId: string;
  authUserId: string;
  outsourcedWorkerId: string;
  otherOutsourcedWorkerId: string;
  customerId: string;
  assignedOrderId: string;
  assignedOrderNumber: number;
  stamp: number;
  categoryId: string;
  serviceIds: string[];
};

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
  if (!file || (mode !== "create" && mode !== "delete")) {
    throw new Error("Usage: tsx scripts/e2e-external-worker-fixture.ts create|delete <credentials-file>");
  }

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DIRECT_URL is required.");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    if (mode === "create") {
      const stamp = Date.now();
      const email = `e2e-external-${stamp}@example.com`;
      const password = randomBytes(18).toString("base64url");

      const role = await prisma.role.findUniqueOrThrow({ where: { slug: "external-worker" }, select: { id: true } });
      const response = await adminApi("/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) });
      if (!response.ok) throw new Error(`Could not create the auth identity (HTTP ${response.status}).`);
      const authUserId = ((await response.json()) as { id: string }).id;

      const outsourced = await prisma.outsourcedWorker.create({
        data: { name: `E2E External Worker ${stamp}`, email },
        select: { id: true },
      });
      const user = await prisma.user.create({
        data: { email, fullName: `E2E External Worker ${stamp}`, authUserId, roles: { create: { roleId: role.id } } },
        select: { id: true },
      });
      await prisma.outsourcedWorker.update({ where: { id: outsourced.id }, data: { userId: user.id } });

      const other = await prisma.outsourcedWorker.create({
        data: { name: `E2E Other External Worker ${stamp}` },
        select: { id: true },
      });
      const customer = await prisma.customer.create({
        data: { name: `E2E External Customer ${stamp}`, type: "INDIVIDUAL", email: `e2e-external-customer-${stamp}@example.com` },
        select: { id: true },
      });

      const category = await prisma.category.create({ data: { name: `E2E External Category ${stamp}`, slug: `e2e-external-category-${stamp}` }, select: { id: true } });
      const ownService = await prisma.service.create({ data: { name: `E2E External Own Service ${stamp}`, categoryId: category.id, basePrice: 100 }, select: { id: true } });
      const otherService = await prisma.service.create({ data: { name: `E2E External Other Service ${stamp}`, categoryId: category.id, basePrice: 100 }, select: { id: true } });
      const admin = await prisma.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });

      await prisma.serviceRate.create({ data: { serviceId: ownService.id, outsourcedWorkerId: outsourced.id, rate: 2.5, currency: "PKR" } });

      const order = await prisma.order.create({
        data: {
          source: "EXTERNAL",
          customerId: customer.id,
          currency: "USD",
          totalAmount: 500,
          status: "PROCESSING",
          deadline: new Date(Date.now() + 86400000),
          createdById: admin.id,
        },
        select: { id: true, orderNumber: true },
      });
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          serviceId: ownService.id,
          categoryId: category.id,
          outsourcedWorkerId: outsourced.id,
          assignedById: admin.id,
          workerCost: 250,
          workerCostCurrency: "PKR",
          status: "PROCESSING",
        },
      });
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          serviceId: otherService.id,
          categoryId: category.id,
          outsourcedWorkerId: other.id,
          workerCost: 9999,
          workerCostCurrency: "PKR",
          status: "PROCESSING",
        },
      });

      const fixture: Fixture = {
        email,
        password,
        userId: user.id,
        authUserId,
        outsourcedWorkerId: outsourced.id,
        otherOutsourcedWorkerId: other.id,
        customerId: customer.id,
        assignedOrderId: order.id,
        assignedOrderNumber: order.orderNumber,
        stamp,
        categoryId: category.id,
        serviceIds: [ownService.id, otherService.id],
      };
      writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
      chmodSync(file, 0o600);
      console.log("created a throwaway External Worker login (credentials written to the file, not printed)");
      return;
    }

    if (!existsSync(file)) return;
    const fixture = JSON.parse(readFileSync(file, "utf8")) as Fixture;
    await prisma.notification.deleteMany({ where: { recipientId: fixture.userId } });
    await prisma.notificationPreference.deleteMany({ where: { userId: fixture.userId } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: fixture.userId } });
    await prisma.orderActivity.deleteMany({ where: { orderId: fixture.assignedOrderId } });
    await prisma.orderItem.deleteMany({ where: { orderId: fixture.assignedOrderId } });
    await prisma.order.deleteMany({ where: { id: fixture.assignedOrderId } });
    await prisma.serviceRate.deleteMany({ where: { outsourcedWorkerId: { in: [fixture.outsourcedWorkerId, fixture.otherOutsourcedWorkerId] } } });
    await prisma.service.deleteMany({ where: { id: { in: fixture.serviceIds } } });
    await prisma.category.deleteMany({ where: { id: fixture.categoryId } });
    await prisma.user.deleteMany({ where: { id: fixture.userId } });
    await prisma.outsourcedWorker.deleteMany({ where: { id: { in: [fixture.outsourcedWorkerId, fixture.otherOutsourcedWorkerId] } } });
    await prisma.customer.deleteMany({ where: { id: fixture.customerId } });
    const removed = await adminApi(`/users/${fixture.authUserId}`, { method: "DELETE" });
    unlinkSync(file);
    console.log(`deleted the throwaway External Worker (auth identity removal: HTTP ${removed.status})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("e2e-external-worker-fixture failed:", (error as Error).message);
  process.exitCode = 1;
});
