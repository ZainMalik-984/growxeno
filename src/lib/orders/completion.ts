import { platformOf } from "@/lib/services/link-field";
import { SERVICE_METRIC_TYPE_LABELS, type ServiceMetricType } from "@/lib/services/metric-type";

/**
 * Whether a worker may mark an item done yet (owner request, 2026-11-12:
 * "when clicking done, it should check whether it's really completed —
 * fetch the details from YouTube and check the count"). Only for YouTube
 * counts the public API reports (subscribers, views, likes, comments);
 * watch hours are private and other platforms aren't read, so those aren't
 * checked. Pure, so the button and the server use the same rule.
 */

const READ_FROM_YOUTUBE: readonly ServiceMetricType[] = ["SUBSCRIBERS", "FOLLOWERS", "VIEWS", "LIKES", "COMMENTS"];

export function isCheckedOnYoutube(metricType: ServiceMetricType | null | undefined, categoryName: string | null | undefined): boolean {
  return Boolean(metricType && READ_FROM_YOUTUBE.includes(metricType) && platformOf(categoryName) === "youtube");
}

/** Why it can't be marked done yet, or null when it can. */
export function completionBlocker(item: {
  metricType: ServiceMetricType | null | undefined;
  categoryName: string | null | undefined;
  currentCount: number | null;
  targetCount: number | null;
}): string | null {
  if (!isCheckedOnYoutube(item.metricType, item.categoryName) || item.targetCount === null) return null;
  const current = item.currentCount ?? 0;
  if (current >= item.targetCount) return null;
  const unit = SERVICE_METRIC_TYPE_LABELS[item.metricType as ServiceMetricType].toLowerCase();
  const n = (value: number) => value.toLocaleString("en-US");
  return `YouTube shows ${n(current)} of ${n(item.targetCount)} ${unit}, ${n(item.targetCount - current)} to go.`;
}
