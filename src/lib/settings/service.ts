import "server-only";

import { recordAudit } from "@/lib/audit/record";
import type { Actor } from "@/lib/auth/session";
import { runTransaction, type ServiceResult } from "@/lib/db/transaction";
import { syncWorkerDeadlines } from "@/lib/orders/worker-deadline-sync";
import { getWorkerDeadlineSettings } from "./queries";
import { normalizeSettings, WORKER_DEADLINE_SETTING_KEY, type WorkerDeadlineSettings } from "./worker-deadline";

/**
 * Saves the worker-deadline settings and applies them straight away to every
 * item of an open order that still follows its order's deadline. Items set by
 * hand, and finished orders, are left as they are.
 */
export async function saveWorkerDeadlineSettings(
  actor: Actor,
  input: WorkerDeadlineSettings,
): Promise<ServiceResult<{ updatedItems: number }>> {
  const settings = normalizeSettings(input);
  return runTransaction(async (tx) => {
    const previous = await getWorkerDeadlineSettings(tx);
    await tx.appSetting.upsert({
      where: { key: WORKER_DEADLINE_SETTING_KEY },
      create: { key: WORKER_DEADLINE_SETTING_KEY, value: settings, updatedById: actor.user.id },
      update: { value: settings, updatedById: actor.user.id },
    });
    const updatedItems = await syncWorkerDeadlines(tx, { openOnly: true }, settings);
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "settings.worker_deadline.updated",
      entityType: "AppSetting",
      entityId: WORKER_DEADLINE_SETTING_KEY,
      summary: `Updated worker deadline settings (${updatedItems} open item deadlines recalculated)`,
      previousValue: previous,
      newValue: settings,
    });
    return { updatedItems };
  });
}
