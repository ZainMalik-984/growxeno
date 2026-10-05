"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/authorize";
import { SERVICE_METRIC_TYPES } from "./metric-type";
import {
  createServiceRecord,
  deleteServiceRecord,
  setServiceActive,
  updateServiceRecord,
} from "./service";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const uuid = z.uuid("Invalid identifier.");

/** A signed decimal with at most two fraction digits, e.g. "1200" or "1200.50". */
const moneyString = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount.");

const serviceInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
  categoryId: uuid,
  description: z.string().trim().max(4000).optional(),
  basePrice: z.union([moneyString, z.literal("")]).optional(),
  currency: z.string().trim().length(3).optional(),
  // Which of the three growth metrics this service sells, if any (owner-directed
  // redesign, confirmed directly 2026-09-27) — see src/lib/services/metric-type.ts.
  metricType: z.enum(SERVICE_METRIC_TYPES).nullable().optional(),
});

export type CreateServiceActionResult =
  | { ok: true; message: string; serviceId: string }
  | { ok: false; error: string };

export async function createServiceAction(input: unknown): Promise<CreateServiceActionResult> {
  const parsed = serviceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("services.create");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createServiceRecord(auth.actor, {
    ...parsed.data,
    basePrice: parsed.data.basePrice || null,
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/services");
  return { ok: true, message: "Service created.", serviceId: result.data.id };
}

const serviceIdSchema = z.object({ serviceId: uuid });

export async function updateServiceAction(input: unknown): Promise<ActionResult> {
  const parsed = serviceIdSchema.extend(serviceInputSchema.shape).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("services.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await updateServiceRecord(auth.actor, parsed.data.serviceId, {
    ...parsed.data,
    basePrice: parsed.data.basePrice || null,
  });
  if (result.ok) {
    revalidatePath(`/services/${parsed.data.serviceId}`);
    revalidatePath("/services");
  }
  return result.ok ? { ok: true, message: "Service updated." } : { ok: false, error: result.error };
}

const setActiveSchema = z.object({ serviceId: uuid, isActive: z.boolean() });

export async function setServiceActiveAction(input: unknown): Promise<ActionResult> {
  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("services.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setServiceActive(auth.actor, parsed.data.serviceId, parsed.data.isActive);
  if (result.ok) {
    revalidatePath(`/services/${parsed.data.serviceId}`);
    revalidatePath("/services");
  }
  return result.ok
    ? { ok: true, message: parsed.data.isActive ? "Service reactivated." : "Service deactivated." }
    : { ok: false, error: result.error };
}

export async function deleteServiceAction(input: unknown): Promise<ActionResult> {
  const parsed = serviceIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("services.delete");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await deleteServiceRecord(auth.actor, parsed.data.serviceId);
  if (result.ok) revalidatePath("/services");
  return result.ok ? { ok: true, message: "Service deleted." } : { ok: false, error: result.error };
}
