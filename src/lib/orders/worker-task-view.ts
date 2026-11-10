import type { OrderItemStatus } from "@/generated/prisma/client";

/**
 * Which of an External Worker's tasks the Orders page shows, and in what
 * order (owner request, 2026-11-11): "he should see processing, refill and
 * pending order items by default; completed and cancelled shouldn't be on the
 * main page. Sort by status, pending first, processing later, all sorted by
 * descending elapsed time." Pure, so it is unit-tested.
 */

export const WORKER_TASK_VIEWS = ["active", "pending", "processing", "refill", "done", "cancelled"] as const;
export type WorkerTaskView = (typeof WORKER_TASK_VIEWS)[number];

export const WORKER_TASK_VIEW_LABELS: Record<WorkerTaskView, string> = {
  active: "To do",
  pending: "Pending",
  processing: "Processing",
  refill: "Refill",
  done: "Completed",
  cancelled: "Cancelled",
};

export const WORKER_TASK_VIEW_STATUSES: Record<WorkerTaskView, readonly OrderItemStatus[]> = {
  active: ["PENDING", "PROCESSING", "REFILL"],
  pending: ["PENDING"],
  processing: ["PROCESSING"],
  refill: ["REFILL"],
  done: ["DONE"],
  cancelled: ["CANCELLED"],
};

const STATUS_RANK: Record<OrderItemStatus, number> = { PENDING: 0, PROCESSING: 1, REFILL: 2, DONE: 3, CANCELLED: 4 };

/**
 * Pending first, then Processing, then Refill; within each, the task given out
 * longest ago first (most time elapsed). Tasks with no assignment time go last.
 */
export function sortWorkerTasks<T extends { status: OrderItemStatus; assignedAt: Date | null; createdAt: Date }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (byStatus !== 0) return byStatus;
    const at = a.assignedAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bt = b.assignedAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}
