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
 * Customer write operations (specification Section 49).
 *
 * Deliberately small: no active/inactive lifecycle, so `customers.delete` is
 * the only removal path (no deactivation to choose between). Buyer — a
 * recurring-commercial-client concept Customer used to optionally link to —
 * was removed from the system entirely, post-Phase-10 (2026-09-27,
 * owner-directed; see `crm.prisma`'s file header).
 */

export type CustomerInput = {
  name: string;
  type: "INDIVIDUAL" | "COMPANY";
  email?: string;
  phone?: string;
  notes?: string;
};

function normalizeCustomerInput(input: CustomerInput) {
  return {
    name: input.name.trim(),
    type: input.type,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}

export async function createCustomer(
  actor: Actor,
  input: CustomerInput,
): Promise<ServiceResult<{ id: string }>> {
  const data = normalizeCustomerInput(input);
  if (!data.name) return failure("Give the customer a name.");

  return runTransaction(async (tx) => {
    const customer = await tx.customer.create({ data, select: { id: true } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "customer.created",
      entityType: "Customer",
      entityId: customer.id,
      summary: `Created customer ${data.name}`,
      newValue: { name: data.name, type: data.type },
    });

    return { id: customer.id };
  });
}

export async function updateCustomer(
  actor: Actor,
  customerId: string,
  input: CustomerInput,
): Promise<ServiceResult> {
  const data = normalizeCustomerInput(input);
  if (!data.name) return failure("Give the customer a name.");

  return runTransaction(async (tx) => {
    const existing = await tx.customer.findUnique({ where: { id: customerId }, select: { name: true } });
    if (!existing) throw new ServiceRejection("That customer no longer exists.");

    await tx.customer.update({ where: { id: customerId }, data });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "customer.updated",
      entityType: "Customer",
      entityId: customerId,
      summary: `Updated customer ${data.name}`,
      previousValue: { name: existing.name },
      newValue: { name: data.name },
    });
  });
}

export async function deleteCustomer(actor: Actor, customerId: string): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { name: true } });
    if (!customer) throw new ServiceRejection("That customer no longer exists.");

    await tx.customer.delete({ where: { id: customerId } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "customer.deleted",
      entityType: "Customer",
      entityId: customerId,
      summary: `Deleted customer ${customer.name}`,
      previousValue: { name: customer.name },
    });
  });
}
