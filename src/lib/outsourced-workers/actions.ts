"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/authorize";
import { createOutsourcedWorker, setOutsourcedWorkerActive, updateOutsourcedWorker } from "./service";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const uuid = z.uuid("Invalid identifier.");

const workerInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
  email: z.email("Enter a valid email address.").optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional(),
  whatsappNumber: z.string().trim().max(32).optional(),
  notes: z.string().trim().max(4000).optional(),
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

  const auth = await authorizeAction("workers.create");
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

  const auth = await authorizeAction("workers.edit");
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

  const auth = await authorizeAction("workers.edit");
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
