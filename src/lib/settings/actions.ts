"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/lib/auth/authorize";
import { saveFiverrFeeSettings, saveSiteContact, saveWorkerDeadlineSettings, saveYoutubeStatsSettings } from "./service";
import { youtubeStatsSettingsSchema } from "./youtube-stats";
import { siteContactSchema } from "./site-contact";
import { fiverrFeeSettingsSchema } from "./fiverr-fee";
import { workerDeadlineSettingsSchema } from "./worker-deadline";

export type SettingsActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function saveWorkerDeadlineSettingsAction(input: unknown): Promise<SettingsActionResult> {
  const parsed = workerDeadlineSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the values and try again." };
  }

  const auth = await authorizeAction("settings.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await saveWorkerDeadlineSettings(auth.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings/system");
  const n = result.data.updatedItems;
  return {
    ok: true,
    message: n === 0 ? "Settings saved." : `Settings saved. ${n} open item ${n === 1 ? "deadline was" : "deadlines were"} updated.`,
  };
}

export async function saveFiverrFeeSettingsAction(input: unknown): Promise<SettingsActionResult> {
  const parsed = fiverrFeeSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the value and try again." };
  }

  const auth = await authorizeAction("settings.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await saveFiverrFeeSettings(auth.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings/system");
  return { ok: true, message: "Fiverr fee saved." };
}

export async function saveYoutubeStatsSettingsAction(input: unknown): Promise<SettingsActionResult> {
  const parsed = youtubeStatsSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the values and try again." };
  }

  const auth = await authorizeAction("settings.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await saveYoutubeStatsSettings(auth.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings/system");
  return { ok: true, message: "YouTube stats settings saved." };
}

export async function saveSiteContactAction(input: unknown): Promise<SettingsActionResult> {
  const parsed = siteContactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the values and try again." };
  }

  const auth = await authorizeAction("settings.edit");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await saveSiteContact(auth.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings/system");
  // The home page is prerendered: regenerate it with the new details.
  revalidatePath("/");
  return { ok: true, message: "Contact details saved. The website shows them now." };
}
