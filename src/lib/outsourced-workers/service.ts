import { inviteByEmail } from "@/lib/auth/invite";
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { recordAudit } from "@/lib/audit/record";
import type { Actor } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  runTransaction,
  ServiceRejection,
  serviceFailure as failure,
  type ServiceResult,
} from "@/lib/db/transaction";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeRate } from "./rate-input";
import type { WorkerNotifyChannel } from "./notify-via";

export type { ServiceResult };

/**
 * Outsourced worker write operations. Uses the `outsourced_workers.*`
 * permission catalog keys — split out of the old shared `workers.*`
 * module, 2026-10-08 (owner-directed: "keep the External Workers separate
 * from employees").
 */

export type OutsourcedWorkerInput = {
  name: string;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  notes?: string;
  /** Where new-task messages go (2026-11-11). Left as it is when omitted. */
  notifyVia?: WorkerNotifyChannel;
};

function normalize(input: OutsourcedWorkerInput) {
  return {
    name: input.name.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    whatsappNumber: input.whatsappNumber?.trim() || null,
    notes: input.notes?.trim() || null,
    ...(input.notifyVia ? { notifyVia: input.notifyVia } : {}),
  };
}

export async function createOutsourcedWorker(
  actor: Actor,
  input: OutsourcedWorkerInput,
): Promise<ServiceResult<{ id: string }>> {
  const data = normalize(input);
  if (!data.name) return failure("Give the worker a name.");

  return runTransaction(async (tx) => {
    const worker = await tx.outsourcedWorker.create({ data, select: { id: true } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "outsourced_worker.created",
      entityType: "OutsourcedWorker",
      entityId: worker.id,
      summary: `Added outsourced worker ${data.name}`,
      newValue: { name: data.name },
    });

    return { id: worker.id };
  });
}

export async function updateOutsourcedWorker(
  actor: Actor,
  workerId: string,
  input: OutsourcedWorkerInput,
): Promise<ServiceResult> {
  const data = normalize(input);
  if (!data.name) return failure("Give the worker a name.");

  return runTransaction(async (tx) => {
    const existing = await tx.outsourcedWorker.findUnique({
      where: { id: workerId },
      select: { name: true },
    });
    if (!existing) throw new ServiceRejection("That worker no longer exists.");

    await tx.outsourcedWorker.update({ where: { id: workerId }, data });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "outsourced_worker.updated",
      entityType: "OutsourcedWorker",
      entityId: workerId,
      summary: `Updated outsourced worker ${data.name}`,
      previousValue: { name: existing.name },
      newValue: { name: data.name },
    });
  });
}

export type ServiceRateInput = { serviceId: string; rate: string; currency?: string };

/**
 * One rate per (service, worker) pair — owner-directed, confirmed directly
 * (2026-10-08), worked example: "subscriber service by Zia charges are
 * 3.5pkr for 1 subscriber." Upserted, since a rate is a current price to
 * set going forward, not a history to append to — `OrderItem.workerCost`
 * is the per-assignment snapshot that preserves history (see its doc
 * comment in `prisma/schema/orders.prisma`).
 */
export async function setServiceRate(
  actor: Actor,
  outsourcedWorkerId: string,
  input: ServiceRateInput,
): Promise<ServiceResult> {
  // ".4" and "25.23" are both fine (2026-11-11); stored as "0.4" / "25.23".
  const rate = normalizeRate(input.rate);
  if (rate === null) return failure("Enter a valid rate, e.g. 0.4 or 25.23 (up to two decimals).");
  const currency = (input.currency?.trim() || "PKR").toUpperCase();

  return runTransaction(async (tx) => {
    const [worker, service] = await Promise.all([
      tx.outsourcedWorker.findUnique({ where: { id: outsourcedWorkerId }, select: { name: true } }),
      tx.service.findUnique({ where: { id: input.serviceId }, select: { name: true } }),
    ]);
    if (!worker) throw new ServiceRejection("That worker no longer exists.");
    if (!service) throw new ServiceRejection("That service no longer exists.");

    await tx.serviceRate.upsert({
      where: { serviceId_outsourcedWorkerId: { serviceId: input.serviceId, outsourcedWorkerId } },
      create: { serviceId: input.serviceId, outsourcedWorkerId, rate, currency },
      update: { rate, currency },
    });

    const summary = `Set ${worker.name}'s rate for "${service.name}" to ${rate} ${currency}`;
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "service_rate.set",
      entityType: "OutsourcedWorker",
      entityId: outsourcedWorkerId,
      summary,
      newValue: { serviceId: input.serviceId, rate, currency },
    });
  });
}

export async function clearServiceRate(
  actor: Actor,
  outsourcedWorkerId: string,
  serviceId: string,
): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const existing = await tx.serviceRate.findUnique({
      where: { serviceId_outsourcedWorkerId: { serviceId, outsourcedWorkerId } },
      select: { rate: true, currency: true, service: { select: { name: true } }, outsourcedWorker: { select: { name: true } } },
    });
    if (!existing) throw new ServiceRejection("That rate no longer exists.");

    await tx.serviceRate.delete({ where: { serviceId_outsourcedWorkerId: { serviceId, outsourcedWorkerId } } });

    const summary = `Cleared ${existing.outsourcedWorker.name}'s rate for "${existing.service.name}"`;
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "service_rate.cleared",
      entityType: "OutsourcedWorker",
      entityId: outsourcedWorkerId,
      summary,
      previousValue: { serviceId, rate: existing.rate.toString(), currency: existing.currency },
    });
  });
}

/**
 * Give this External Worker portal access — owner-directed, confirmed
 * directly (2026-10-08): "External or outsourced workers should be able
 * to login and have there own dashboard." Mirrors `createUser`
 * (`src/lib/access/service.ts`): invite via Supabase Auth first (the
 * person sets their own password from the emailed link — no administrator
 * ever handles another person's credential), then create the application
 * profile and link it, in one transaction. If the DB step fails after the
 * invite succeeded, the orphaned auth identity is removed rather than left
 * dangling.
 *
 * Reuses the existing Supabase Auth + `User`/`Role` machinery rather than
 * a second, bespoke auth system — the SAME login page as an Employee,
 * just the much narrower seeded "External Worker" role (see
 * `prisma/seed.ts`). `OutsourcedWorker` itself is NOT merged into `User` —
 * only linked by `userId` — per "keep the External Workers separate from
 * employees."
 */
export async function inviteOutsourcedWorkerToLogin(actor: Actor, workerId: string): Promise<ServiceResult> {
  const worker = await prisma.outsourcedWorker.findUnique({
    where: { id: workerId },
    select: { name: true, email: true, userId: true, isActive: true },
  });
  if (!worker) return failure("That worker no longer exists.");
  if (worker.userId) return failure(`${worker.name} already has portal access.`);
  if (!worker.isActive) return failure("Reactivate this worker before inviting them to log in.");
  const email = worker.email?.trim().toLowerCase();
  if (!email) return failure("Add an email address for this worker first.");

  const existingProfile = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingProfile) return failure(`${email} is already a user.`);

  const externalWorkerRole = await prisma.role.findUnique({ where: { slug: "external-worker" }, select: { id: true } });
  if (!externalWorkerRole) return failure("The External Worker role is missing — re-run the seed.");

  let admin: SupabaseClient;
  try {
    admin = createSupabaseAdminClient();
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Supabase administrative access is not configured.");
  }

  // Emailed by the app through Resend (2026-11-12): Supabase's own invite email failed.
  const invited = await inviteByEmail(admin, { email, fullName: worker.name, kind: "worker" });
  if (!invited.ok) return failure(invited.error);
  const authUserId = invited.authUserId;

  const result = await runTransaction(async (tx) => {
    const profile = await tx.user.create({
      data: { email, fullName: worker.name, authUserId, isActive: true, createdById: actor.user.id },
      select: { id: true },
    });
    await tx.userRole.create({ data: { userId: profile.id, roleId: externalWorkerRole.id, assignedById: actor.user.id } });
    await tx.outsourcedWorker.update({ where: { id: workerId }, data: { userId: profile.id } });

    const summary = `Invited ${worker.name} (${email}) to log in as an External Worker`;
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "outsourced_worker.invited",
      entityType: "OutsourcedWorker",
      entityId: workerId,
      summary,
      newValue: { email, userId: profile.id },
    });
  });

  if (!result.ok) {
    await admin.auth.admin.deleteUser(authUserId).catch(() => {});
  }
  return result;
}

export async function setOutsourcedWorkerActive(
  actor: Actor,
  workerId: string,
  isActive: boolean,
): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const worker = await tx.outsourcedWorker.findUnique({
      where: { id: workerId },
      select: { name: true, isActive: true },
    });
    if (!worker) throw new ServiceRejection("That worker no longer exists.");
    if (worker.isActive === isActive) {
      throw new ServiceRejection(`${worker.name} is already ${isActive ? "active" : "inactive"}.`);
    }

    await tx.outsourcedWorker.update({ where: { id: workerId }, data: { isActive } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: isActive ? "outsourced_worker.reactivated" : "outsourced_worker.deactivated",
      entityType: "OutsourcedWorker",
      entityId: workerId,
      summary: `${isActive ? "Reactivated" : "Deactivated"} outsourced worker ${worker.name}`,
      previousValue: { isActive: worker.isActive },
      newValue: { isActive },
    });
  });
}
