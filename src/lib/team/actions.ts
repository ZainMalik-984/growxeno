"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAuthenticatedAction } from "@/lib/auth/authorize";
import { memberWork, type MemberShareView } from "./queries";
import { addTeamMember, assignShare, removeShare, setShareStatus, setTeamMemberActive, updateShare, updateTeamMember } from "./service";

/**
 * Server Actions for an outsourced worker's own team (2026-11-17). No
 * permission key: every call acts only on the signed-in worker's own members
 * and on items assigned to them (enforced in ./service), and refuses anyone
 * who isn't an outsourced worker.
 */

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const uuid = z.uuid("Invalid identifier.");
const memberSchema = z.object({
  name: z.string().trim().min(1, "Enter their name.").max(160, "That name is too long."),
  whatsappNumber: z.string().trim().max(32, "That number is too long.").optional().nullable(),
});
const amountSchema = z.number().int("Use a whole number.").positive("Enter how much they'll do.").max(2_000_000_000).nullable();

function invalid(error: z.ZodError): ActionResult {
  return { ok: false, error: error.issues[0]?.message ?? "Invalid request." };
}

/** Signed in, active, and an outsourced worker (they are the only ones with a team). */
function asWorker(auth: Awaited<ReturnType<typeof authorizeAuthenticatedAction>>) {
  if (!auth.ok) return { ok: false as const, error: auth.message };
  if (!auth.actor.outsourcedWorkerId) return { ok: false as const, error: "Only outsourced workers have a team." };
  return { ok: true as const, actor: auth.actor };
}

function refresh() {
  revalidatePath("/team");
  revalidatePath("/orders");
}

export async function addTeamMemberAction(input: unknown): Promise<ActionResult & { memberId?: string }> {
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const w = asWorker(await authorizeAuthenticatedAction());
  if (!w.ok) return w;
  const result = await addTeamMember(w.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  refresh();
  return { ok: true, message: `${parsed.data.name} added to your team.`, memberId: result.data.id };
}

export async function updateTeamMemberAction(input: unknown): Promise<ActionResult> {
  const parsed = memberSchema.extend({ memberId: uuid }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const w = asWorker(await authorizeAuthenticatedAction());
  if (!w.ok) return w;
  const result = await updateTeamMember(w.actor, parsed.data.memberId, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  refresh();
  return { ok: true, message: "Saved." };
}

export async function setTeamMemberActiveAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ memberId: uuid, isActive: z.boolean() }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const w = asWorker(await authorizeAuthenticatedAction());
  if (!w.ok) return w;
  const result = await setTeamMemberActive(w.actor, parsed.data.memberId, parsed.data.isActive);
  if (!result.ok) return { ok: false, error: result.error };
  refresh();
  return { ok: true, message: parsed.data.isActive ? "Reactivated." : "Deactivated." };
}

export async function getMemberWorkAction(input: unknown): Promise<{ ok: true; shares: MemberShareView[] } | { ok: false; error: string }> {
  const parsed = z.object({ memberId: uuid }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as { ok: false; error: string };
  const w = asWorker(await authorizeAuthenticatedAction());
  if (!w.ok) return w;
  const shares = await memberWork(w.actor, parsed.data.memberId);
  if (!shares) return { ok: false, error: "That member is no longer on your team." };
  return { ok: true, shares };
}

export async function assignShareAction(input: unknown): Promise<ActionResult & { shareId?: string }> {
  const parsed = z
    .object({ itemId: uuid, memberId: uuid, amount: amountSchema, note: z.string().trim().max(500, "Keep the note under 500 characters.").optional().nullable() })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const w = asWorker(await authorizeAuthenticatedAction());
  if (!w.ok) return w;
  const result = await assignShare(w.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  refresh();
  return { ok: true, message: "Assigned.", shareId: result.data.id };
}

export async function updateShareAction(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      shareId: uuid,
      amount: amountSchema.optional(),
      done: z.number().int("Use a whole number.").min(0, "Can't be below 0.").max(2_000_000_000).optional(),
      note: z.string().trim().max(500).optional().nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const w = asWorker(await authorizeAuthenticatedAction());
  if (!w.ok) return w;
  const result = await updateShare(w.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  refresh();
  return { ok: true, message: "Saved." };
}

export async function setShareStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ shareId: uuid, status: z.enum(["PROCESSING", "DONE"]) }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const w = asWorker(await authorizeAuthenticatedAction());
  if (!w.ok) return w;
  const result = await setShareStatus(w.actor, parsed.data.shareId, parsed.data.status);
  if (!result.ok) return { ok: false, error: result.error };
  refresh();
  return { ok: true, message: parsed.data.status === "DONE" ? "Marked done." : "Reopened." };
}

export async function removeShareAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ shareId: uuid }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const w = asWorker(await authorizeAuthenticatedAction());
  if (!w.ok) return w;
  const result = await removeShare(w.actor, parsed.data.shareId);
  if (!result.ok) return { ok: false, error: result.error };
  refresh();
  return { ok: true, message: "Removed from this task." };
}
