import "server-only";

import { recordAudit } from "@/lib/audit/record";
import type { Actor } from "@/lib/auth/session";
import {
  runTransaction,
  ServiceRejection,
  serviceFailure as failure,
  type ServiceResult,
} from "@/lib/db/transaction";

export type { ServiceResult };

/**
 * Outsourced worker write operations. Uses the `workers.*` permission
 * catalog keys — they describe "worker profiles" generically, and this is
 * exactly that for a third party.
 */

export type OutsourcedWorkerInput = {
  name: string;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  notes?: string;
};

function normalize(input: OutsourcedWorkerInput) {
  return {
    name: input.name.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    whatsappNumber: input.whatsappNumber?.trim() || null,
    notes: input.notes?.trim() || null,
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
