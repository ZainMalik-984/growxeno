import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { TransactionClient } from "@/lib/db/transaction";
import {
  parseWorkerDeadlineSettings,
  WORKER_DEADLINE_SETTING_KEY,
  type WorkerDeadlineSettings,
} from "./worker-deadline";

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

export async function getWorkerDeadlineSettingsMeta(): Promise<{ updatedAt: Date | null; updatedBy: string | null }> {
  const row = await prisma.appSetting.findUnique({
    where: { key: WORKER_DEADLINE_SETTING_KEY },
    select: { updatedAt: true, updatedById: true },
  });
  if (!row) return { updatedAt: null, updatedBy: null };
  const user = row.updatedById
    ? await prisma.user.findUnique({ where: { id: row.updatedById }, select: { fullName: true } })
    : null;
  return { updatedAt: row.updatedAt, updatedBy: user?.fullName ?? null };
}
