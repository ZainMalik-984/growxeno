import { describe, expect, it } from "vitest";

import { sortWorkerTasks, WORKER_TASK_VIEW_STATUSES } from "@/lib/orders/worker-task-view";

const at = (h: number) => new Date(Date.UTC(2026, 10, 10, h));

describe("worker task views", () => {
  it("shows pending, processing and refill by default; done and cancelled sit apart", () => {
    expect(WORKER_TASK_VIEW_STATUSES.active).toEqual(["PENDING", "PROCESSING", "REFILL"]);
    expect(WORKER_TASK_VIEW_STATUSES.done).toEqual(["DONE"]);
    expect(WORKER_TASK_VIEW_STATUSES.cancelled).toEqual(["CANCELLED"]);
  });

  it("sorts pending first, then processing, then refill, each oldest-given first", () => {
    const rows = [
      { id: "proc-new", status: "PROCESSING" as const, assignedAt: at(10), createdAt: at(1) },
      { id: "refill", status: "REFILL" as const, assignedAt: at(1), createdAt: at(1) },
      { id: "pend-new", status: "PENDING" as const, assignedAt: at(9), createdAt: at(1) },
      { id: "proc-old", status: "PROCESSING" as const, assignedAt: at(2), createdAt: at(1) },
      { id: "pend-unassigned-time", status: "PENDING" as const, assignedAt: null, createdAt: at(0) },
      { id: "pend-old", status: "PENDING" as const, assignedAt: at(3), createdAt: at(1) },
    ];
    expect(sortWorkerTasks(rows).map((r) => r.id)).toEqual([
      "pend-old",
      "pend-new",
      "pend-unassigned-time",
      "proc-old",
      "proc-new",
      "refill",
    ]);
  });
});
