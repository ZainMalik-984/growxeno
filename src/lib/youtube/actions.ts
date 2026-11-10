"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction, authorizeAuthenticatedAction } from "@/lib/auth/authorize";
import { prisma } from "@/lib/db/prisma";
import type { ServiceMetricType } from "@/lib/services/metric-type";
import { studioAnalyticsUrl } from "./link";
import { lookupYoutubeLink, refreshItemStats } from "./stats-service";

/** What the New Order / item forms show for a pasted YouTube link. */
export type YoutubePreview = {
  kind: "CHANNEL" | "VIDEO";
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  subscribers: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  /** YouTube Studio analytics for the channel (watch hours are only visible there). */
  studioUrl: string | null;
};

export type YoutubePreviewResult = { ok: true; data: YoutubePreview } | { ok: false; error: string };

const lookupSchema = z.object({
  url: z.string().trim().min(1, "Enter a link.").max(2000),
  serviceId: z.uuid().optional(),
});

/** Looks up a pasted link before the item is saved. For people who can add or edit items. */
export async function lookupYoutubeLinkAction(input: unknown): Promise<YoutubePreviewResult> {
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAuthenticatedAction();
  if (!auth.ok) return { ok: false, error: auth.message };
  if (!auth.actor.permissions.has("orders.create") && !auth.actor.permissions.has("orders.edit")) {
    return { ok: false, error: "You don't have permission to add order items." };
  }

  const service = parsed.data.serviceId
    ? await prisma.service.findUnique({ where: { id: parsed.data.serviceId }, select: { metricType: true } })
    : null;
  const result = await lookupYoutubeLink(parsed.data.url, (service?.metricType as ServiceMetricType | null) ?? null);
  if (!result.ok) return result;

  const d = result.data;
  return {
    ok: true,
    data: { ...d, studioUrl: d.channelId ? studioAnalyticsUrl(d.channelId) : null },
  };
}

export type RefreshStatsResult = { ok: true; message: string } | { ok: false; error: string };

/** Refresh button on an item: anyone who can see the item may use it (owner request, 2026-11-10). */
export async function refreshOrderItemStatsAction(input: unknown): Promise<RefreshStatsResult> {
  const parsed = z.object({ itemId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("orders.view");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await refreshItemStats(parsed.data.itemId, { trigger: "MANUAL", actor: auth.actor });
  const item = await prisma.orderItem.findUnique({ where: { id: parsed.data.itemId }, select: { orderId: true } });
  if (item) revalidatePath(`/orders/${item.orderId}`);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, message: result.data.fetched ? "Stats updated from YouTube." : "Already up to date." };
}
