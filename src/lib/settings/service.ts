import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit/record";
import type { Actor } from "@/lib/auth/session";
import { runTransaction, type ServiceResult } from "@/lib/db/transaction";
import { syncWorkerDeadlines } from "@/lib/orders/worker-deadline-sync";
import { getWorkerDeadlineSettings } from "./queries";
import { FIVERR_FEE_SETTING_KEY, type FiverrFeeSettings } from "./fiverr-fee";
import { SITE_CONTACT_SETTING_KEY, type SiteContact } from "./site-contact";
import { formatInterval, YOUTUBE_STATS_SETTING_KEY, type YoutubeStatsSettings } from "./youtube-stats";
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

/** Saves the Fiverr fee used for employee commission on Fiverr orders. */
export async function saveFiverrFeeSettings(actor: Actor, input: FiverrFeeSettings): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const existing = await tx.appSetting.findUnique({ where: { key: FIVERR_FEE_SETTING_KEY }, select: { value: true } });
    await tx.appSetting.upsert({
      where: { key: FIVERR_FEE_SETTING_KEY },
      create: { key: FIVERR_FEE_SETTING_KEY, value: input, updatedById: actor.user.id },
      update: { value: input, updatedById: actor.user.id },
    });
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "settings.fiverr_fee.updated",
      entityType: "AppSetting",
      entityId: FIVERR_FEE_SETTING_KEY,
      summary: `Set the Fiverr fee to ${input.percent}%`,
      ...(existing ? { previousValue: existing.value as Prisma.InputJsonValue } : {}),
      newValue: input,
    });
  });
}

/** Saves how often YouTube stats on open order items refresh by themselves. */
export async function saveYoutubeStatsSettings(actor: Actor, input: YoutubeStatsSettings): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const existing = await tx.appSetting.findUnique({ where: { key: YOUTUBE_STATS_SETTING_KEY }, select: { value: true } });
    await tx.appSetting.upsert({
      where: { key: YOUTUBE_STATS_SETTING_KEY },
      create: { key: YOUTUBE_STATS_SETTING_KEY, value: input, updatedById: actor.user.id },
      update: { value: input, updatedById: actor.user.id },
    });
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "settings.youtube_stats.updated",
      entityType: "AppSetting",
      entityId: YOUTUBE_STATS_SETTING_KEY,
      summary: input.enabled
        ? `Set YouTube stats to refresh every ${formatInterval(input.intervalHours)}`
        : "Turned off automatic YouTube stats refresh",
      ...(existing ? { previousValue: existing.value as Prisma.InputJsonValue } : {}),
      newValue: input,
    });
  });
}

/** Saves the contact details shown on the public home page. */
export async function saveSiteContact(actor: Actor, input: SiteContact): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const existing = await tx.appSetting.findUnique({ where: { key: SITE_CONTACT_SETTING_KEY }, select: { value: true } });
    await tx.appSetting.upsert({
      where: { key: SITE_CONTACT_SETTING_KEY },
      create: { key: SITE_CONTACT_SETTING_KEY, value: input, updatedById: actor.user.id },
      update: { value: input, updatedById: actor.user.id },
    });
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "settings.site_contact.updated",
      entityType: "AppSetting",
      entityId: SITE_CONTACT_SETTING_KEY,
      summary: "Updated the website contact details",
      ...(existing ? { previousValue: existing.value as Prisma.InputJsonValue } : {}),
      newValue: input,
    });
  });
}
