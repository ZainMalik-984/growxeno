import { timingSafeEqual } from "node:crypto";

import { getCronSecret } from "@/lib/env";
import { refreshDueItemStats } from "@/lib/youtube/stats-service";

/**
 * Scheduled YouTube stats refresh (owner request, 2026-11-10). Call it on a
 * timer — hourly is plenty; the interval in Settings decides which items are
 * due — with `Authorization: Bearer $CRON_SECRET`. Vercel Cron sends that
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
  const result = await refreshDueItemStats({ limit: 500 });
  return Response.json(result);
}
