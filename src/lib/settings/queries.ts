import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { TransactionClient } from "@/lib/db/transaction";
import {
  parseWorkerDeadlineSettings,
  WORKER_DEADLINE_SETTING_KEY,
  type WorkerDeadlineSettings,
} from "./worker-deadline";
import { DEFAULT_SITE_CONTACT, parseSiteContact, SITE_CONTACT_SETTING_KEY, type SiteContact } from "./site-contact";
import { FIVERR_FEE_SETTING_KEY, type FiverrFeeSettings, parseFiverrFeeSettings } from "./fiverr-fee";
import { parseYoutubeStatsSettings, YOUTUBE_STATS_SETTING_KEY, type YoutubeStatsSettings } from "./youtube-stats";

/** The saved worker-deadline settings, or the defaults if none are saved. */
export async function getWorkerDeadlineSettings(
  client: TransactionClient | typeof prisma = prisma,
): Promise<WorkerDeadlineSettings> {
  const row = await client.appSetting.findUnique({
    where: { key: WORKER_DEADLINE_SETTING_KEY },
    select: { value: true },
  });
  return parseWorkerDeadlineSettings(row?.value ?? null);
}

/** The saved Fiverr fee, or the default (20%) if none is saved. */
export async function getFiverrFeeSettings(): Promise<FiverrFeeSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: FIVERR_FEE_SETTING_KEY }, select: { value: true } });
  return parseFiverrFeeSettings(row?.value ?? null);
}

/** How often YouTube stats refresh by themselves, or the default (every 6 hours). */
export async function getYoutubeStatsSettings(): Promise<YoutubeStatsSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: YOUTUBE_STATS_SETTING_KEY }, select: { value: true } });
  return parseYoutubeStatsSettings(row?.value ?? null);
}

/** When a setting was last saved, and by whom. */
export async function getSettingMeta(key: string): Promise<{ updatedAt: Date | null; updatedBy: string | null }> {
  const row = await prisma.appSetting.findUnique({ where: { key }, select: { updatedAt: true, updatedById: true } });
  if (!row) return { updatedAt: null, updatedBy: null };
  const user = row.updatedById ? await prisma.user.findUnique({ where: { id: row.updatedById }, select: { fullName: true } }) : null;
  return { updatedAt: row.updatedAt, updatedBy: user?.fullName ?? null };
}

/**
 * The public contact details. Never throws: the home page is prerendered,
 * and an unreachable database must not take it down — it falls back to the
 * defaults until the next regeneration.
 */
export async function getSiteContact(): Promise<SiteContact> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SITE_CONTACT_SETTING_KEY }, select: { value: true } });
    return parseSiteContact(row?.value ?? null);
  } catch {
    return DEFAULT_SITE_CONTACT;
  }
}
