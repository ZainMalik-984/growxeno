import "server-only";

import { recordAudit } from "@/lib/audit/record";
import type { Actor } from "@/lib/auth/session";
import {
  runTransaction,
  ServiceRejection,
  serviceFailure as failure,
  type ServiceResult,
} from "@/lib/db/transaction";
import type { ServiceMetricType } from "./metric-type";

export type { ServiceResult };

/** Service write operations (specification Section 50). */

export type ServiceInput = {
  name: string;
  categoryId: string;
  description?: string;
  basePrice?: string | null;
  currency?: string;
  metricType?: ServiceMetricType | null;
};

function normalizeServiceInput(input: ServiceInput) {
  return {
    name: input.name.trim(),
    categoryId: input.categoryId,
    description: input.description?.trim() || null,
    basePrice: input.basePrice?.trim() || null,
    currency: (input.currency?.trim() || "USD").toUpperCase(),
    metricType: input.metricType || null,
  };
}

export async function createServiceRecord(
  actor: Actor,
  input: ServiceInput,
): Promise<ServiceResult<{ id: string }>> {
  const data = normalizeServiceInput(input);
  if (!data.name) return failure("Give the service a name.");
  if (!data.categoryId) return failure("Choose a category.");

  return runTransaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id: data.categoryId },
      select: { id: true },
    });
    if (!category) throw new ServiceRejection("That category no longer exists.");

    const service = await tx.service.create({
      data: {
        name: data.name,
        categoryId: data.categoryId,
        description: data.description,
        basePrice: data.basePrice,
        currency: data.currency,
        metricType: data.metricType,
      },
      select: { id: true },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "service.created",
      entityType: "Service",
      entityId: service.id,
      summary: `Created service ${data.name}`,
      newValue: { name: data.name, categoryId: data.categoryId },
    });

    return { id: service.id };
  });
}

export async function updateServiceRecord(
  actor: Actor,
  serviceId: string,
  input: ServiceInput,
): Promise<ServiceResult> {
  const data = normalizeServiceInput(input);
  if (!data.name) return failure("Give the service a name.");
  if (!data.categoryId) return failure("Choose a category.");

  return runTransaction(async (tx) => {
    const existing = await tx.service.findUnique({ where: { id: serviceId }, select: { name: true } });
    if (!existing) throw new ServiceRejection("That service no longer exists.");

    const category = await tx.category.findUnique({
      where: { id: data.categoryId },
      select: { id: true },
    });
    if (!category) throw new ServiceRejection("That category no longer exists.");

    await tx.service.update({
      where: { id: serviceId },
      data: {
        name: data.name,
        categoryId: data.categoryId,
        description: data.description,
        basePrice: data.basePrice,
        currency: data.currency,
        metricType: data.metricType,
      },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "service.updated",
      entityType: "Service",
      entityId: serviceId,
      summary: `Updated service ${data.name}`,
      previousValue: { name: existing.name },
      newValue: { name: data.name },
    });
  });
}

export async function setServiceActive(
  actor: Actor,
  serviceId: string,
  isActive: boolean,
): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const service = await tx.service.findUnique({
      where: { id: serviceId },
      select: { name: true, isActive: true },
    });
    if (!service) throw new ServiceRejection("That service no longer exists.");
    if (service.isActive === isActive) {
      throw new ServiceRejection(`${service.name} is already ${isActive ? "active" : "inactive"}.`);
    }

    await tx.service.update({ where: { id: serviceId }, data: { isActive } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: isActive ? "service.reactivated" : "service.deactivated",
      entityType: "Service",
      entityId: serviceId,
      summary: `${isActive ? "Reactivated" : "Deactivated"} ${service.name}`,
      previousValue: { isActive: service.isActive },
      newValue: { isActive },
    });
  });
}

export async function deleteServiceRecord(actor: Actor, serviceId: string): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const service = await tx.service.findUnique({
      where: { id: serviceId },
      select: { name: true },
    });
    if (!service) throw new ServiceRejection("That service no longer exists.");

    await tx.service.delete({ where: { id: serviceId } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "service.deleted",
      entityType: "Service",
      entityId: serviceId,
      summary: `Deleted service ${service.name}`,
      previousValue: { name: service.name },
    });
  });
}
