import { SERVICE_METRIC_TYPE_LABELS, type ServiceMetricType } from "@/lib/services/metric-type";

/**
 * A worker's current workload (2026-11-11, owner request: "when assigning
 * orders it should have the count of pending work towards him… completed /
 * total, remaining"). Pure, so it is unit-tested; the query is in
 * workload-queries.ts.
 *
 * Active = pending, processing or refill. Counts are kept per unit (watch
 * hours, subscribers…) and never added across units.
 */

export type WorkloadItem = {
  outsourcedWorkerId: string;
  status: "PENDING" | "PROCESSING" | "REFILL";
  metricType: ServiceMetricType | null;
  startingCount: number | null;
  currentCount: number | null;
  targetCount: number | null;
};

export type WorkloadLine = {
  metricType: ServiceMetricType;
  /** "watch hours" */
  unit: string;
  tasks: number;
  delivered: number;
  required: number;
  remaining: number;
  percent: number;
};

export type Workload = {
  /** Every active task, of any kind. */
  active: number;
  /** Assigned but not accepted yet. */
  notAccepted: number;
  lines: WorkloadLine[];
};

export const EMPTY_WORKLOAD: Workload = { active: 0, notAccepted: 0, lines: [] };

/** Delivered since the start (never below 0, capped at what was asked) and what was asked. */
function progressOf(item: WorkloadItem): { delivered: number; required: number } {
  const start = Math.max(0, item.startingCount ?? 0);
  const required = Math.max(0, (item.targetCount ?? 0) - start);
  const delivered = Math.min(required, Math.max(0, (item.currentCount ?? start) - start));
  return { delivered, required };
}

export function summarizeWorkload(items: readonly WorkloadItem[]): Workload {
  const byMetric = new Map<ServiceMetricType, WorkloadLine>();
  let notAccepted = 0;
  for (const item of items) {
    if (item.status === "PENDING") notAccepted += 1;
    if (!item.metricType || item.targetCount === null) continue;
    const { delivered, required } = progressOf(item);
    const line =
      byMetric.get(item.metricType) ??
      ({ metricType: item.metricType, unit: SERVICE_METRIC_TYPE_LABELS[item.metricType].toLowerCase(), tasks: 0, delivered: 0, required: 0, remaining: 0, percent: 0 } satisfies WorkloadLine);
    line.tasks += 1;
    line.delivered += delivered;
    line.required += required;
    byMetric.set(item.metricType, line);
  }
  const lines = [...byMetric.values()]
    .map((line) => ({
      ...line,
      remaining: line.required - line.delivered,
      percent: line.required > 0 ? Math.round((line.delivered / line.required) * 100) : 0,
    }))
    .sort((a, b) => b.remaining - a.remaining);
  return { active: items.length, notAccepted, lines };
}

/** One workload per worker. Workers with nothing active get the empty workload. */
export function summarizeWorkloads(items: readonly WorkloadItem[]): Map<string, Workload> {
  const grouped = new Map<string, WorkloadItem[]>();
  for (const item of items) {
    const list = grouped.get(item.outsourcedWorkerId);
    if (list) list.push(item);
    else grouped.set(item.outsourcedWorkerId, [item]);
  }
  return new Map([...grouped].map(([id, list]) => [id, summarizeWorkload(list)]));
}
