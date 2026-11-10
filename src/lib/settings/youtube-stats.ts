import { z } from "zod";

/**
 * How often YouTube stats on open order items refresh by themselves (owner
 * request, 2026-11-10: "the system should update this periodically, set time
 * delay in settings"). Pure, so it is unit-tested.
 */

export const YOUTUBE_STATS_SETTING_KEY = "youtube_stats";

export const YOUTUBE_STATS_INTERVAL_OPTIONS = [1, 2, 3, 6, 12, 24, 48, 72, 168] as const;

export const youtubeStatsSettingsSchema = z.object({
  enabled: z.boolean(),
  intervalHours: z.coerce
    .number({ message: "Choose how often." })
    .int("Use whole hours.")
    .min(1, "At least every hour.")
    .max(168, "At most once a week."),
});

export type YoutubeStatsSettings = z.infer<typeof youtubeStatsSettingsSchema>;

/** Also seeded by the migration that added this setting — keep the two in step. */
export const DEFAULT_YOUTUBE_STATS_SETTINGS: YoutubeStatsSettings = { enabled: true, intervalHours: 6 };

export function parseYoutubeStatsSettings(value: unknown): YoutubeStatsSettings {
  const parsed = youtubeStatsSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_YOUTUBE_STATS_SETTINGS;
}

export function formatInterval(hours: number): string {
  if (hours % 168 === 0) return hours === 168 ? "week" : `${hours / 168} weeks`;
  if (hours % 24 === 0) return hours === 24 ? "day" : `${hours / 24} days`;
  return hours === 1 ? "hour" : `${hours} hours`;
}
