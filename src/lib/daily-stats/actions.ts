"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/authorize";
import {
  bulkUpsertDailyStats,
  copyPreviousDay,
  createDailyStat,
  deleteDailyStat,
  updateDailyStat,
} from "./service";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const uuid = z.uuid("Invalid identifier.");
const dateOnly = z.iso.date("Enter a valid date.");
const nonNegativeInt = z.coerce.number().int().min(0, "Cannot be negative.");
const moneyString = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount.");

function toDate(dateOnlyString: string): Date {
  return new Date(`${dateOnlyString}T00:00:00.000Z`);
}

const dailyStatInputSchema = z.object({
  userId: uuid,
  statDate: dateOnly,
  orders: nonNegativeInt,
  completed: nonNegativeInt,
  pending: nonNegativeInt,
  revenue: moneyString,
  revenueCurrency: z.string().trim().length(3).default("USD"),
  notes: z.string().trim().max(2000).optional(),
});

export type CreateDailyStatActionResult = { ok: true; message: string; id: string } | { ok: false; error: string };

export async function createDailyStatAction(input: unknown): Promise<CreateDailyStatActionResult> {
  const parsed = dailyStatInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("daily_stats.create");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createDailyStat(auth.actor, { ...parsed.data, statDate: toDate(parsed.data.statDate) });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/daily-stats");
  return { ok: true, message: "Entry saved.", id: result.data.id };
}

const idSchema = z.object({ id: uuid });

export async function updateDailyStatAction(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.extend(dailyStatInputSchema.shape).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("daily_stats.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await updateDailyStat(auth.actor, parsed.data.id, {
    ...parsed.data,
    statDate: toDate(parsed.data.statDate),
  });
  if (result.ok) revalidatePath("/daily-stats");
  return result.ok ? { ok: true, message: "Entry updated." } : { ok: false, error: result.error };
}

export async function deleteDailyStatAction(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("daily_stats.delete");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await deleteDailyStat(auth.actor, parsed.data.id);
  if (result.ok) revalidatePath("/daily-stats");
  return result.ok ? { ok: true, message: "Entry deleted." } : { ok: false, error: result.error };
}

const bulkEntrySchema = z.object({
  userId: uuid,
  orders: nonNegativeInt,
  completed: nonNegativeInt,
  pending: nonNegativeInt,
  revenue: moneyString,
  revenueCurrency: z.string().trim().length(3).default("USD"),
  notes: z.string().trim().max(2000).optional(),
});

const bulkSchema = z.object({
  statDate: dateOnly,
  entries: z.array(bulkEntrySchema).min(1, "Enter at least one row."),
});

export async function bulkUpsertDailyStatsAction(input: unknown): Promise<ActionResult> {
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("daily_stats.create");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await bulkUpsertDailyStats(auth.actor, toDate(parsed.data.statDate), parsed.data.entries);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/daily-stats");
  return { ok: true, message: `Saved ${result.data.count} ${result.data.count === 1 ? "entry" : "entries"}.` };
}

const copyPreviousDaySchema = z.object({ statDate: dateOnly });

export async function copyPreviousDayAction(input: unknown): Promise<ActionResult> {
  const parsed = copyPreviousDaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("daily_stats.create");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await copyPreviousDay(auth.actor, toDate(parsed.data.statDate));
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/daily-stats");
  return {
    ok: true,
    message:
      result.data.copied === 0
        ? "Nothing to copy — no entries the day before, or every user already has one."
        : `Copied ${result.data.copied} ${result.data.copied === 1 ? "entry" : "entries"}${result.data.skipped > 0 ? ` (${result.data.skipped} skipped — already had an entry)` : ""}.`,
  };
}
