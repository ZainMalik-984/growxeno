import { describe, expect, it } from "vitest";

import { summarizeWorkload, summarizeWorkloads, type WorkloadItem } from "@/lib/outsourced-workers/workload";

const watch = (target: number, current: number, overrides: Partial<WorkloadItem> = {}): WorkloadItem => ({
  outsourcedWorkerId: "inzmam",
  status: "PROCESSING",
  metricType: "WATCH_HOURS",
  startingCount: 0,
  currentCount: current,
  targetCount: target,
  ...overrides,
});

describe("worker workload", () => {
  it("adds up the owner's example: five watch-hours tasks, 500 done on each", () => {
    const workload = summarizeWorkload([1000, 1500, 2000, 2500, 3000].map((target) => watch(target, 500)));
    expect(workload.active).toBe(5);
    expect(workload.lines).toEqual([
      { metricType: "WATCH_HOURS", unit: "watch hours", tasks: 5, delivered: 2500, required: 10000, remaining: 7500, percent: 25 },
    ]);
  });

  it("measures from each task's starting count", () => {
    const workload = summarizeWorkload([watch(1655, 775, { startingCount: 655 })]);
    expect(workload.lines[0]).toMatchObject({ delivered: 120, required: 1000, remaining: 880 });
  });

  it("never adds different units together", () => {
    const workload = summarizeWorkload([watch(1000, 200), watch(500, 100, { metricType: "SUBSCRIBERS" })]);
    expect(workload.lines.map((l) => [l.unit, l.remaining])).toEqual([
      ["watch hours", 800],
      ["subscribers", 400],
    ]);
  });

  it("counts not-accepted tasks, tasks without a count, and caps over-delivery", () => {
    const workload = summarizeWorkload([
      watch(1000, 0, { status: "PENDING" }),
      watch(100, 150),
      watch(0, 0, { metricType: null, targetCount: null }),
    ]);
    expect(workload.active).toBe(3);
    expect(workload.notAccepted).toBe(1);
    expect(workload.lines[0]).toMatchObject({ tasks: 2, delivered: 100, required: 1100, remaining: 1000 });
  });

  it("keeps each worker separate", () => {
    const map = summarizeWorkloads([watch(1000, 500), watch(400, 0, { outsourcedWorkerId: "taimoor" })]);
    expect(map.get("inzmam")?.lines[0]?.remaining).toBe(500);
    expect(map.get("taimoor")?.lines[0]?.remaining).toBe(400);
  });
});
