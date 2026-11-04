"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/lib/auth/authorize";
import { saveWorkerDeadlineSettings } from "./service";
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
