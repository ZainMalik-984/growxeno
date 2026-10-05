import { z } from "zod";

import { resolveStatsRange, type RangePreset } from "@/lib/daily-stats/date-ranges";
import { chooseBucket, clampRange, type Bucket } from "./range";

const searchParamsSchema = z.object({
  range: z.enum(["today", "7d", "30d", "90d", "custom"]).catch("30d").optional(),
  from: z.iso.date().catch(undefined as never).optional(),
  to: z.iso.date().catch(undefined as never).optional(),
});

/** Query-string -> a bounded range and bucket. Bad input falls back to 30 days rather than erroring. */
export function resolveReportRange(raw: Record<string, string | string[] | undefined>): {
  range: { start: Date; end: Date };
  bucket: Bucket;
  clamped: boolean;
} {
  const params = searchParamsSchema.parse({
    range: typeof raw.range === "string" ? raw.range : undefined,
    from: typeof raw.from === "string" ? raw.from : undefined,
    to: typeof raw.to === "string" ? raw.to : undefined,
  });
  const resolved = resolveStatsRange((params.range ?? "30d") as RangePreset, { from: params.from, to: params.to });
  const { clamped, ...range } = clampRange(resolved);
  return { range, bucket: chooseBucket(range), clamped };
}

export function formatPeriod(period: Date, bucket: Bucket): string {
  const opts: Intl.DateTimeFormatOptions =
    bucket === "month" ? { month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" };
  const label = new Intl.DateTimeFormat("en-GB", opts).format(period);
  return bucket === "week" ? `Week of ${label}` : label;
}
