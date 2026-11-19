"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/lib/audit/record";
import { authorizeAuthenticatedAction } from "@/lib/auth/authorize";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The signed-in person's own profile (owner request, 2026-11-19): change their
 * password, and, for an outsourced worker, say how they want to be paid.
 * Self-scoped by construction: no target id is accepted; everything acts on
 * the session's own account.
 */

export type ProfileActionResult = { ok: true; message: string } | { ok: false; error: string; field?: "currentPassword" | "password" | "confirmPassword" };

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: z.string().min(12, "Use at least 12 characters.").max(72, "Use 72 characters or fewer."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "The two passwords don't match." })
  .refine((v) => v.password !== v.currentPassword, { path: ["password"], message: "Choose a password different from the current one." });

export async function changePasswordAction(input: unknown): Promise<ProfileActionResult> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return {
      ok: false,
      error: issue?.message ?? "Invalid request.",
      field: field === "currentPassword" || field === "password" || field === "confirmPassword" ? field : undefined,
    };
  }

  const auth = await authorizeAuthenticatedAction();
  if (!auth.ok) return { ok: false, error: auth.message };

  const supabase = await createSupabaseServerClient();
  // Prove it's really them before changing it (a session left open on a shared device isn't enough).
  const check = await supabase.auth.signInWithPassword({ email: auth.actor.user.email, password: parsed.data.currentPassword });
  if (check.error) return { ok: false, error: "That's not your current password.", field: "currentPassword" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: "Couldn't change the password. Try again." };

  await recordAudit(prisma, {
    actorUserId: auth.actor.user.id,
    actorEmail: auth.actor.user.email,
    action: "user.password_changed",
    entityType: "User",
    entityId: auth.actor.user.id,
    summary: `${auth.actor.user.fullName} changed their password`,
  });
  return { ok: true, message: "Password changed." };
}

const paymentSchema = z.object({
  paymentDetails: z.string().trim().max(500, "Keep it under 500 characters."),
});

/** Only an outsourced worker, and only their own record. */
export async function savePaymentDetailsAction(input: unknown): Promise<ProfileActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAuthenticatedAction();
  if (!auth.ok) return { ok: false, error: auth.message };
  const workerId = auth.actor.outsourcedWorkerId;
  if (!workerId) return { ok: false, error: "Only outsourced workers have payment details here." };

  const paymentDetails = parsed.data.paymentDetails || null;
  await prisma.outsourcedWorker.update({ where: { id: workerId }, data: { paymentDetails } });
  await recordAudit(prisma, {
    actorUserId: auth.actor.user.id,
    actorEmail: auth.actor.user.email,
    action: "outsourced_worker.payment_details_updated",
    entityType: "OutsourcedWorker",
    entityId: workerId,
    summary: `${auth.actor.user.fullName} ${paymentDetails ? "updated" : "cleared"} their payment details`,
  });
  revalidatePath("/profile");
  revalidatePath(`/outsourced-workers/${workerId}`);
  return { ok: true, message: paymentDetails ? "Payment details saved." : "Payment details cleared." };
}
