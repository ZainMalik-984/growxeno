"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { NotificationChannel, NotificationEvent } from "@/generated/prisma/client";
import { authorizeAction, authorizeAuthenticatedAction } from "@/lib/auth/authorize";
import { ALL_NOTIFICATION_CHANNELS, ALL_NOTIFICATION_EVENTS } from "./events";
import {
  createTemplate,
  deleteTemplate,
  markAllNotificationsRead,
  markNotificationRead,
  setNotificationPreference,
  setTemplateActive,
  updateTemplate,
} from "./service";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const uuid = z.uuid("Invalid identifier.");
const eventEnum = z.enum(ALL_NOTIFICATION_EVENTS as [NotificationEvent, ...NotificationEvent[]]);
const channelEnum = z.enum(ALL_NOTIFICATION_CHANNELS as [NotificationChannel, ...NotificationChannel[]]);

// ---------------------------------------------------------------------------
// In-app notifications (self-service — no permission key)
// ---------------------------------------------------------------------------

export async function markNotificationReadAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAuthenticatedAction();
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await markNotificationRead(auth.actor, parsed.data.id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/notifications");
  return { ok: true, message: "Marked read." };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const auth = await authorizeAuthenticatedAction();
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await markAllNotificationsRead(auth.actor);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/notifications");
  return { ok: true, message: "All notifications marked read." };
}

// ---------------------------------------------------------------------------
// Preferences (self-service — no permission key)
// ---------------------------------------------------------------------------

export async function setNotificationPreferenceAction(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({ event: eventEnum, channel: channelEnum, enabled: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAuthenticatedAction();
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setNotificationPreference(
    auth.actor,
    parsed.data.event,
    parsed.data.channel,
    parsed.data.enabled,
  );
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/notifications");
  return { ok: true, message: "Preference saved." };
}

// ---------------------------------------------------------------------------
// Templates (`templates.manage`)
// ---------------------------------------------------------------------------

const templateSchema = z.object({
  event: eventEnum,
  channel: channelEnum,
  name: z.string().trim().min(1, "Name is required.").max(120),
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1, "Body is required."),
  requiredVariables: z.array(z.string()).default([]),
  metaTemplateName: z.string().trim().max(120).optional(),
  metaTemplateLanguage: z.string().trim().max(10).optional(),
});

export async function createTemplateAction(input: unknown): Promise<ActionResult> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("templates.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createTemplate(auth.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/communication/templates");
  return { ok: true, message: "Template created." };
}

export async function updateTemplateAction(input: unknown): Promise<ActionResult> {
  const parsed = templateSchema.extend({ id: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("templates.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const { id, ...rest } = parsed.data;
  const result = await updateTemplate(auth.actor, id, rest);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/communication/templates");
  return { ok: true, message: "Template updated." };
}

export async function setTemplateActiveAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, isActive: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("templates.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setTemplateActive(auth.actor, parsed.data.id, parsed.data.isActive);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/communication/templates");
  return {
    ok: true,
    message: parsed.data.isActive ? "Template reactivated." : "Template deactivated.",
  };
}

export async function deleteTemplateAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("templates.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await deleteTemplate(auth.actor, parsed.data.id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/communication/templates");
  return { ok: true, message: "Template deleted." };
}
