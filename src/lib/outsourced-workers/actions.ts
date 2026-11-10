"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/authorize";
import {
  clearServiceRate,
  createOutsourcedWorker,
  inviteOutsourcedWorkerToLogin,
  setOutsourcedWorkerActive,
  setServiceRate,
  updateOutsourcedWorker,
} from "./service";
import { WORKER_NOTIFY_CHANNELS } from "./notify-via";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const uuid = z.uuid("Invalid identifier.");

const workerInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
  email: z.email("Enter a valid email address.").optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional(),
  whatsappNumber: z.string().trim().max(32).optional(),
  notes: z.string().trim().max(4000).optional(),
  notifyVia: z.enum(WORKER_NOTIFY_CHANNELS).optional(),
});

export type CreateOutsourcedWorkerActionResult =
  | { ok: true; message: string; workerId: string }
  | { ok: false; error: string };

export async function createOutsourcedWorkerAction(
  input: unknown,
): Promise<CreateOutsourcedWorkerActionResult> {
  const parsed = workerInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("outsourced_workers.create");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createOutsourcedWorker(auth.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/outsourced-workers");
  return { ok: true, message: "Worker added.", workerId: result.data.id };
}

const workerIdSchema = z.object({ workerId: uuid });

export async function updateOutsourcedWorkerAction(input: unknown): Promise<ActionResult> {
  const parsed = workerIdSchema.extend(workerInputSchema.shape).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const auth = await authorizeAction("outsourced_workers.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await updateOutsourcedWorker(auth.actor, parsed.data.workerId, parsed.data);
  if (result.ok) {
    revalidatePath(`/outsourced-workers/${parsed.data.workerId}`);
    revalidatePath("/outsourced-workers");
  }
  return result.ok ? { ok: true, message: "Worker updated." } : { ok: false, error: result.error };
}

const setActiveSchema = z.object({ workerId: uuid, isActive: z.boolean() });

export async function setOutsourcedWorkerActiveAction(input: unknown): Promise<ActionResult> {
  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("outsourced_workers.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setOutsourcedWorkerActive(auth.actor, parsed.data.workerId, parsed.data.isActive);
  if (result.ok) {
    revalidatePath(`/outsourced-workers/${parsed.data.workerId}`);
    revalidatePath("/outsourced-workers");
  }
  return result.ok
    ? { ok: true, message: parsed.data.isActive ? "Worker reactivated." : "Worker deactivated." }
    : { ok: false, error: result.error };
}

// The rate itself is checked (and ".4" accepted) by the service — see rate-input.ts.
const setRateSchema = z.object({
  workerId: uuid,
  serviceId: uuid,
  rate: z.string().trim().min(1, "Enter a rate.").max(20),
  currency: z.string().trim().length(3).optional(),
});

export async function setServiceRateAction(input: unknown): Promise<ActionResult> {
  const parsed = setRateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("outsourced_workers.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setServiceRate(auth.actor, parsed.data.workerId, parsed.data);
  if (result.ok) revalidatePath(`/outsourced-workers/${parsed.data.workerId}`);
  return result.ok ? { ok: true, message: "Rate saved." } : { ok: false, error: result.error };
}

const clearRateSchema = z.object({ workerId: uuid, serviceId: uuid });

export async function clearServiceRateAction(input: unknown): Promise<ActionResult> {
  const parsed = clearRateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("outsourced_workers.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await clearServiceRate(auth.actor, parsed.data.workerId, parsed.data.serviceId);
  if (result.ok) revalidatePath(`/outsourced-workers/${parsed.data.workerId}`);
  return result.ok ? { ok: true, message: "Rate cleared." } : { ok: false, error: result.error };
}

export async function inviteOutsourcedWorkerToLoginAction(input: unknown): Promise<ActionResult> {
  const parsed = workerIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("outsourced_workers.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await inviteOutsourcedWorkerToLogin(auth.actor, parsed.data.workerId);
  if (result.ok) revalidatePath(`/outsourced-workers/${parsed.data.workerId}`);
  return result.ok ? { ok: true, message: "Invitation sent." } : { ok: false, error: result.error };
}
