/**
 * A Service's growth-metric type (owner-directed order-item redesign,
 * confirmed directly 2026-09-27): "like in youtube category there would be 3
 * things, views, subscribers, watch hours, each item would be of one type."
 *
 * The type lives on the SERVICE, not directly on the Order Item — set up a
 * "Views" / "Subscribers" / "Watch Hours" service once (typically under a
 * "YouTube" category), and every Order Item created against it automatically
 * gets the matching structured fields (channel link, target/current count —
 * see `prisma/schema/orders.prisma`'s `OrderItem`) with the right labels,
 * rather than a second, disconnected "item type" concept duplicating the
 * catalog. Most services have no metric type at all (`null`) — this only
 * applies to the handful that are this kind of growth-metric sale.
 *
 * Pure — no database, no `server-only` — so it is unit-tested and safe to
 * import from both server and client code.
 */

// FOLLOWERS, LIKES, COMMENTS added 2026-11-10 (owner request) for TikTok, X,
// Instagram and Facebook alongside YouTube.
export const SERVICE_METRIC_TYPES = ["SUBSCRIBERS", "FOLLOWERS", "VIEWS", "WATCH_HOURS", "LIKES", "COMMENTS"] as const;
export type ServiceMetricType = (typeof SERVICE_METRIC_TYPES)[number];

export const SERVICE_METRIC_TYPE_LABELS: Record<ServiceMetricType, string> = {
  VIEWS: "Views",
  SUBSCRIBERS: "Subscribers",
  WATCH_HOURS: "Watch Hours",
  FOLLOWERS: "Followers",
  LIKES: "Likes",
  COMMENTS: "Comments",
};

/** Label for the Order Item's "how many are wanted" field, e.g. "Subscribers required". */
export const METRIC_TARGET_LABELS: Record<ServiceMetricType, string> = {
  VIEWS: "Views required",
  SUBSCRIBERS: "Subscribers required",
  WATCH_HOURS: "Watch hours required",
  FOLLOWERS: "Followers required",
  LIKES: "Likes required",
  COMMENTS: "Comments required",
};

/** Label for the Order Item's "where it stands right now" field, e.g. "Current subscribers". */
export const METRIC_CURRENT_LABELS: Record<ServiceMetricType, string> = {
  VIEWS: "Current views",
  SUBSCRIBERS: "Current subscribers",
  WATCH_HOURS: "Current watch hours",
  FOLLOWERS: "Current followers",
  LIKES: "Current likes",
  COMMENTS: "Current comments",
};

export function isServiceMetricType(value: string): value is ServiceMetricType {
  return (SERVICE_METRIC_TYPES as readonly string[]).includes(value);
}
