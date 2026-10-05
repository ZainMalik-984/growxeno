"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/authorize";
import {
  createFiverrAccount,
  createGig,
  createGigStat,
  revealFiverrPaypalPassword,
  setFiverrAccountActive,
  setGigActive,
  updateFiverrAccount,
  updateGig,
  updateGigStat,
} from "./service";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const uuid = z.uuid("Invalid identifier.");
const dateOnly = z.iso.date("Enter a valid date.");
const toDate = (dateOnlyString: string) => new Date(`${dateOnlyString}T00:00:00.000Z`);

// ---------------------------------------------------------------------------
// Fiverr accounts
// ---------------------------------------------------------------------------

const accountInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
  email: z.email("Enter a valid email address.").optional().or(z.literal("")),
  paypalEmail: z.email("Enter a valid PayPal email address.").optional().or(z.literal("")),
  // Absent = leave unchanged; "" = clear; anything else = new password to encrypt.
  paypalPassword: z.string().max(500).optional(),
});

export type CreateFiverrAccountActionResult = { ok: true; message: string; accountId: string } | { ok: false; error: string };

export async function createFiverrAccountAction(input: unknown): Promise<CreateFiverrAccountActionResult> {
  const parsed = accountInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createFiverrAccount(auth.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/fiverr-accounts");
  return { ok: true, message: "Fiverr account added.", accountId: result.data.id };
}

export async function updateFiverrAccountAction(input: unknown): Promise<ActionResult> {
  const parsed = accountInputSchema.extend({ accountId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const { accountId, ...rest } = parsed.data;
  const result = await updateFiverrAccount(auth.actor, accountId, rest);
  if (result.ok) {
    revalidatePath(`/fiverr-accounts/${accountId}`);
    revalidatePath("/fiverr-accounts");
  }
  return result.ok ? { ok: true, message: "Fiverr account updated." } : { ok: false, error: result.error };
}

export async function setFiverrAccountActiveAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ accountId: uuid, isActive: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setFiverrAccountActive(auth.actor, parsed.data.accountId, parsed.data.isActive);
  if (result.ok) {
    revalidatePath(`/fiverr-accounts/${parsed.data.accountId}`);
    revalidatePath("/fiverr-accounts");
  }
  return result.ok
    ? { ok: true, message: parsed.data.isActive ? "Account reactivated." : "Account deactivated." }
    : { ok: false, error: result.error };
}

export type RevealPasswordActionResult = { ok: true; password: string } | { ok: false; error: string };

export async function revealFiverrPaypalPasswordAction(input: unknown): Promise<RevealPasswordActionResult> {
  const parsed = z.object({ accountId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.credentials.view");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await revealFiverrPaypalPassword(auth.actor, parsed.data.accountId);
  return result.ok ? { ok: true, password: result.data.password } : { ok: false, error: result.error };
}

// ---------------------------------------------------------------------------
// Gigs
// ---------------------------------------------------------------------------

const gigInputSchema = z.object({ name: z.string().trim().min(1, "Name is required.").max(160) });

export type CreateGigActionResult = { ok: true; message: string; gigId: string } | { ok: false; error: string };

export async function createGigAction(input: unknown): Promise<CreateGigActionResult> {
  const parsed = gigInputSchema.extend({ accountId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createGig(auth.actor, parsed.data.accountId, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/fiverr-accounts/${parsed.data.accountId}`);
  revalidatePath("/fiverr-accounts/gigs");
  return { ok: true, message: "Gig added.", gigId: result.data.id };
}

export async function updateGigAction(input: unknown): Promise<ActionResult> {
  const parsed = gigInputSchema.extend({ gigId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await updateGig(auth.actor, parsed.data.gigId, parsed.data);
  if (result.ok) {
    revalidatePath("/fiverr-accounts/gigs");
    revalidatePath("/fiverr-accounts");
  }
  return result.ok ? { ok: true, message: "Gig updated." } : { ok: false, error: result.error };
}

export async function setGigActiveAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ gigId: uuid, isActive: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setGigActive(auth.actor, parsed.data.gigId, parsed.data.isActive);
  if (result.ok) {
    revalidatePath("/fiverr-accounts/gigs");
    revalidatePath("/fiverr-accounts");
  }
  return result.ok
    ? { ok: true, message: parsed.data.isActive ? "Gig reactivated." : "Gig deactivated." }
    : { ok: false, error: result.error };
}

// ---------------------------------------------------------------------------
// Gig daily stats
// ---------------------------------------------------------------------------

const gigStatInputSchema = z.object({
  gigId: uuid,
  statDate: dateOnly,
  impressions: z.coerce.number().int().min(0, "Cannot be negative.").max(1_000_000_000),
  clicks: z.coerce.number().int().min(0, "Cannot be negative.").max(1_000_000_000),
});

export async function createGigStatAction(input: unknown): Promise<ActionResult> {
  const parsed = gigStatInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createGigStat(auth.actor, parsed.data.gigId, {
    statDate: toDate(parsed.data.statDate),
    impressions: parsed.data.impressions,
    clicks: parsed.data.clicks,
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/fiverr-accounts/gigs");
  return { ok: true, message: "Stats recorded." };
}

export async function updateGigStatAction(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      statId: uuid,
      impressions: z.coerce.number().int().min(0, "Cannot be negative.").max(1_000_000_000),
      clicks: z.coerce.number().int().min(0, "Cannot be negative.").max(1_000_000_000),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await updateGigStat(auth.actor, parsed.data.statId, { impressions: parsed.data.impressions, clicks: parsed.data.clicks });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/fiverr-accounts/gigs");
  return { ok: true, message: "Stats updated." };
}
