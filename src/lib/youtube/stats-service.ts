import "server-only";

import type { StatSnapshotTrigger } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { runTransaction, serviceFailure as failure, type ServiceResult } from "@/lib/db/transaction";
import { getYoutubeApiKey } from "@/lib/env";
import { isAssignedToIdentity } from "@/lib/orders/assignment";
import { platformOf } from "@/lib/services/link-field";
import { SERVICE_METRIC_TYPE_LABELS, type ServiceMetricType } from "@/lib/services/metric-type";
import { serviceLabel } from "@/lib/services/label";
import { getYoutubeStatsSettings } from "@/lib/settings/queries";
import { lookupYoutube, type YoutubeLookup } from "./api";
import { countsAfterReading, kindMismatch, metricValueFrom, parseYoutubeLink } from "./link";

/**
 * Public YouTube stats for order items (owner request, 2026-11-10):
 *   - read when an item is added or its link changes (the INITIAL reading,
 *     kept as the baseline in the history),
 *   - re-read when anyone who can see the item presses Refresh,
 *   - re-read on a schedule, every N hours as set in Settings.
 * Each reading is a row in order_item_stat_snapshots and moves the item's
 * current count to the live number, so progress keeps itself up to date.
 */

export const YOUTUBE_NOT_CONFIGURED = "YouTube stats aren't set up yet: add a YOUTUBE_API_KEY to the server's environment.";

/** A manual Refresh this soon after the last reading returns that reading instead of asking YouTube again. */
const MANUAL_COOLDOWN_MS = 30_000;

/** Item statuses still worth tracking. Done stays in: a refill is decided by numbers dropping after delivery. */
const TRACKED_ITEM_STATUSES = ["PENDING", "PROCESSING", "DONE", "REFILL"] as const;
/** Orders that are over: no more automatic readings. */
const FINISHED_ORDER_STATUSES = ["FINALIZED", "CANCELLED"] as const;

/** Looks up a link for the New Order / item forms, before anything is saved. */
export async function lookupYoutubeLink(url: string, metric: ServiceMetricType | null): Promise<ServiceResult<YoutubeLookup>> {
  const parsed = parseYoutubeLink(url);
  if (!parsed.ok) return failure(parsed.error);
  const mismatch = kindMismatch(metric, parsed.target);
  if (mismatch) return failure(mismatch);
  const apiKey = getYoutubeApiKey();
  if (!apiKey) return failure(YOUTUBE_NOT_CONFIGURED);
  const result = await lookupYoutube(parsed.target, apiKey);
  return result.ok ? { ok: true, data: result.data } : failure(result.error);
}

type RefreshOptions = {
  trigger: Exclude<StatSnapshotTrigger, "INITIAL">;
  /** Who pressed Refresh; null for the scheduled refresh. */
  actor: Actor | null;
};

export type RefreshOutcome = {
  /** False when the last reading was too recent to ask again. */
  fetched: boolean;
  value: number | null;
};

/**
 * Reads one item's stats now. A manual refresh checks that the actor can see
 * the item (anyone who can see it may refresh it, owner request). Failures are
 * stored on the item and returned; they never throw.
 */
export async function refreshItemStats(itemId: string, options: RefreshOptions): Promise<ServiceResult<RefreshOutcome>> {
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      orderId: true,
      channelLink: true,
      statsSourceId: true,
      statsFetchedAt: true,
      startingCount: true,
      currentCount: true,
      targetCount: true,
      workerId: true,
      outsourcedWorkerId: true,
      service: { select: { name: true, metricType: true } },
      category: { select: { name: true } },
      order: { select: { orderNumber: true } },
    },
  });
  if (!item) return failure("That item no longer exists.");

  const { actor } = options;
  if (actor && !actor.permissions.has("orders.view.all")) {
    const own = isAssignedToIdentity(item, { userId: actor.user.id, outsourcedWorkerId: actor.outsourcedWorkerId });
    if (!own) return failure("You can only refresh items assigned to you.");
  }
  if (platformOf(item.category.name) !== "youtube" || !item.channelLink) {
    return failure("Only YouTube items with a link have stats to refresh.");
  }
  if (actor && item.statsFetchedAt && Date.now() - item.statsFetchedAt.getTime() < MANUAL_COOLDOWN_MS) {
    return { ok: true, data: { fetched: false, value: item.currentCount } };
  }

  const metric = item.service.metricType as ServiceMetricType | null;
  const lookup = await lookupYoutubeLink(item.channelLink, metric);
  const checkedAt = new Date();

  if (!lookup.ok) {
    await prisma.orderItem.update({ where: { id: item.id }, data: { statsCheckedAt: checkedAt, statsError: lookup.error.slice(0, 300) } });
    return failure(lookup.error);
  }

  const data = lookup.data;
  const value = metricValueFrom(data, metric);
  const isFirstReading =
    data.id !== item.statsSourceId ||
    (await prisma.orderItemStatSnapshot.count({ where: { orderItemId: item.id, sourceId: data.id } })) === 0;
  const counts = countsAfterReading(item, value, isFirstReading);
  const trigger: StatSnapshotTrigger = isFirstReading ? "INITIAL" : options.trigger;

  const written = await runTransaction(async (tx) => {
    await tx.orderItemStatSnapshot.create({
      data: {
        orderItemId: item.id,
        sourceId: data.id,
        trigger,
        subscribers: data.subscribers !== null ? BigInt(data.subscribers) : null,
        views: data.views !== null ? BigInt(data.views) : null,
        likes: data.likes !== null ? BigInt(data.likes) : null,
        comments: data.comments !== null ? BigInt(data.comments) : null,
        triggeredById: actor?.user.id ?? null,
        triggeredByLabel: actor?.user.fullName ?? null,
        takenAt: checkedAt,
      },
    });
    await tx.orderItem.update({
      where: { id: item.id },
      data: {
        statsSourceId: data.id,
        statsSourceKind: data.kind,
        statsTitle: data.title.slice(0, 300),
        statsFetchedAt: checkedAt,
        statsCheckedAt: checkedAt,
        statsError: null,
        ...(counts ?? {}),
      },
    });
    // Scheduled readings stay out of the activity feed; they would drown it.
    if (trigger !== "SCHEDULED" && value !== null && metric) {
      await tx.orderActivity.create({
        data: {
          orderId: item.orderId,
          actorId: actor?.user.id ?? null,
          actorLabel: actor?.user.fullName ?? "Automatic",
          action: "order_item.stats_refreshed",
          summary: `YouTube ${trigger === "INITIAL" ? "starting" : "latest"} count for "${serviceLabel(item.service.name, item.category.name)}" on order #${item.order.orderNumber}: ${value.toLocaleString("en-US")} ${SERVICE_METRIC_TYPE_LABELS[metric].toLowerCase()}`,
        },
      });
    }
  });
  if (!written.ok) return failure(written.error);

  return { ok: true, data: { fetched: true, value } };
}

/** Reads an item right after it is saved, if it is a YouTube item. Never fails the save. */
export async function readStatsAfterSave(itemId: string, actor: Actor): Promise<void> {
  if (!getYoutubeApiKey()) return;
  await refreshItemStats(itemId, { trigger: "MANUAL", actor }).catch(() => undefined);
}

/**
 * The scheduled refresh: every tracked YouTube item whose last attempt is
 * older than the interval in Settings. `orderId` limits it to one order (used
 * when someone opens that order). Items run one after another, a few at a
 * time, to stay well inside YouTube's per-second limits.
 */
export async function refreshDueItemStats(options: { orderId?: string; limit?: number } = {}): Promise<{
  checked: number;
  failed: number;
  skipped?: string;
}> {
  if (!getYoutubeApiKey()) return { checked: 0, failed: 0, skipped: "no API key" };
  const settings = await getYoutubeStatsSettings();
  if (!settings.enabled) return { checked: 0, failed: 0, skipped: "turned off in Settings" };

  const dueBefore = new Date(Date.now() - settings.intervalHours * 3_600_000);
  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const youtubeCategoryIds = categories.filter((c) => platformOf(c.name) === "youtube").map((c) => c.id);
  if (youtubeCategoryIds.length === 0) return { checked: 0, failed: 0 };

  const due = await prisma.orderItem.findMany({
    where: {
      ...(options.orderId ? { orderId: options.orderId } : {}),
      categoryId: { in: youtubeCategoryIds },
      channelLink: { not: null },
      status: { in: [...TRACKED_ITEM_STATUSES] },
      order: { status: { notIn: [...FINISHED_ORDER_STATUSES] } },
      OR: [{ statsCheckedAt: null }, { statsCheckedAt: { lt: dueBefore } }],
    },
    select: { id: true },
    orderBy: [{ statsCheckedAt: { sort: "asc", nulls: "first" } }],
    take: options.limit ?? 200,
  });

  let failed = 0;
  const BATCH = 5;
  for (let i = 0; i < due.length; i += BATCH) {
    const results = await Promise.all(
      due.slice(i, i + BATCH).map((row) => refreshItemStats(row.id, { trigger: "SCHEDULED", actor: null }).catch(() => failure("error"))),
    );
    failed += results.filter((r) => !r.ok).length;
  }
  return { checked: due.length, failed };
}
