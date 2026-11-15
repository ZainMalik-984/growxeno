import type { ServiceMetricType } from "@/lib/services/metric-type";

/**
 * Which public YouTube numbers a service follows (owner request, 2026-11-13:
 * "give all stats to be selected as switches, show only those and update
 * only those"). Watch hours need none (YouTube keeps them private); a video
 * service typically wants views, likes and comments, maybe the channel's
 * subscribers. The stat that measures the service's progress is always on.
 * Pure, so the forms, the reader and the pages share it.
 */

export const STAT_KEYS = ["subscribers", "views", "likes", "comments"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_KEY_LABELS: Record<StatKey, string> = {
  subscribers: "Subscribers",
  views: "Views",
  likes: "Likes",
  comments: "Comments",
};

export function isStatKey(value: string): value is StatKey {
  return (STAT_KEYS as readonly string[]).includes(value);
}

/** The stat a service's progress is measured by, if it's one YouTube reports. */
export function metricStatKey(metric: ServiceMetricType | null | undefined): StatKey | null {
  switch (metric) {
    case "SUBSCRIBERS":
    case "FOLLOWERS":
      return "subscribers";
    case "VIEWS":
      return "views";
    case "LIKES":
      return "likes";
    case "COMMENTS":
      return "comments";
    default:
      return null;
  }
}

/** Sensible switches for a new service of this kind. */
export function defaultTrackedStats(metric: ServiceMetricType | null | undefined): StatKey[] {
  if (metric === "VIEWS" || metric === "LIKES" || metric === "COMMENTS") return ["views", "likes", "comments"];
  const own = metricStatKey(metric);
  return own ? [own] : [];
}

/** What's read and shown: the switched-on stats plus the progress stat, in a fixed order. */
export function effectiveTrackedStats(tracked: readonly string[], metric: ServiceMetricType | null | undefined): StatKey[] {
  const own = metricStatKey(metric);
  return STAT_KEYS.filter((key) => key === own || tracked.includes(key));
}
