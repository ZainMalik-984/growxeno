"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/authorize";
import { getItemUpdatesThread, keepWithWorker, postItemUpdate, requestScreenshots, requestWithdraw, type ItemUpdatesThread } from "./service";

/**
 * Order item updates (2026-11-11): read an item's thread, and post to it with
 * an optional new count, text and screenshots. Who may see and post is
 * checked per item in the service (the team, or the item's own worker).
 */

const itemIdSchema = z.object({ itemId: z.uuid("Invalid identifier.") });

export async function getItemUpdatesAction(
  input: unknown,
): Promise<{ ok: true; thread: ItemUpdatesThread } | { ok: false; error: string }> {
  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const auth = await authorizeAction("orders.view");
  if (!auth.ok) return { ok: false, error: auth.message };
  const result = await getItemUpdatesThread(auth.actor, parsed.data.itemId);
  return result.ok ? { ok: true, thread: result.data } : { ok: false, error: result.error };
}

/** FormData: `itemId`, `body`, `count` (may be empty), up to four `images`, and `answersRequestId` when answering a screenshot request. */
export async function postItemUpdateAction(
  formData: FormData,
): Promise<{ ok: true; message: string; thread: ItemUpdatesThread | null } | { ok: false; error: string }> {
  const parsed = itemIdSchema.safeParse({ itemId: formData.get("itemId") });
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const auth = await authorizeAction("orders.view");
  if (!auth.ok) return { ok: false, error: auth.message };

  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  const files = formData.getAll("images").filter((value): value is File => value instanceof File);

  const answers = z.uuid().safeParse(text("answersRequestId"));
  const result = await postItemUpdate(auth.actor, {
    itemId: parsed.data.itemId,
    body: text("body"),
    count: text("count"),
    files,
    answersRequestId: answers.success ? answers.data : null,
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/orders", "layout");
  revalidatePath("/dashboard");
  const thread = await getItemUpdatesThread(auth.actor, parsed.data.itemId);
  return {
    ok: true,
    message: result.data.answered
      ? "Screenshots sent. The request is answered."
      : result.data.countChanged
        ? "Update posted and progress saved."
        : "Update posted.",
    thread: thread.ok ? thread.data : null,
  };
}

const requestSchema = z.object({ itemId: z.uuid("Invalid identifier."), message: z.string().max(4000).default("") });

/** The item's worker asks the team for screenshots (2026-11-11). The message is optional. */
export async function requestScreenshotsAction(input: unknown): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const auth = await authorizeAction("orders.view");
  if (!auth.ok) return { ok: false, error: auth.message };
  const result = await requestScreenshots(auth.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/orders", "layout");
  revalidatePath("/dashboard");
  return { ok: true, message: "Request sent. The team has been notified." };
}

const withdrawSchema = z.object({ itemId: z.uuid("Invalid identifier."), reason: z.string().max(4000).default("") });

/** "I can't continue this" (2026-11-11): the worker on a task gives it back to the team. */
export async function requestWithdrawAction(input: unknown): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const parsed = withdrawSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const auth = await authorizeAction("orders.view");
  if (!auth.ok) return { ok: false, error: auth.message };
  const result = await requestWithdraw(auth.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/orders", "layout");
  revalidatePath("/dashboard");
  return { ok: true, message: "Sent. The team will reassign what's left." };
}

const keepSchema = z.object({ requestId: z.uuid("Invalid identifier."), note: z.string().max(300).default("") });

/** The team keeps the task with the same worker instead of reassigning it. */
export async function keepWithWorkerAction(input: unknown): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const parsed = keepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const auth = await authorizeAction("orders.assign");
  if (!auth.ok) return { ok: false, error: auth.message };
  const result = await keepWithWorker(auth.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/orders", "layout");
  revalidatePath("/dashboard");
  return { ok: true, message: "Kept with the same worker." };
}
