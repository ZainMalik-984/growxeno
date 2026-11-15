import { timingSafeEqual } from "node:crypto";

import { getCronSecret } from "@/lib/env";
import { refreshDueItemStats } from "@/lib/youtube/stats-service";

/**
 * Scheduled YouTube stats refresh (owner request, 2026-11-10). With
 * `?dayEnd=1` it is the end-of-day reading: every tracked item, recorded as
 * the close of the Pakistan day that just ended. vercel.json calls it at
 * 19:00 UTC (00:00 PKT) (2026-11-13). Without it, only items due by the
 * interval in Settings, each updating that day's row. Needs
 * `Authorization: Bearer $CRON_SECRET`. Vercel Cron sends that
 * header itself when CRON_SECRET is set (docs/DEPLOYMENT.md). Without the
 * secret configured, every call is refused.
 */

export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const dayEnd = new URL(request.url).searchParams.get("dayEnd") === "1";
  const result = await refreshDueItemStats({ limit: 500, dayEnd });
  return Response.json(result);
}
