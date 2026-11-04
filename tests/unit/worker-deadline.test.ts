import { describe, expect, it } from "vitest";

import {
  bufferDaysFor,
  computeWorkerDeadline,
  DEFAULT_WORKER_DEADLINE_SETTINGS,
  parseWorkerDeadlineSettings,
  workerDeadlineSettingsSchema,
} from "@/lib/settings/worker-deadline";

const DAY = 24 * 60 * 60 * 1000;
const created = new Date("2026-11-01T00:00:00Z");
const after = (days: number) => new Date(created.getTime() + days * DAY);

describe("worker deadline", () => {
  it("uses the default gap when no tier fits", () => {
    expect(computeWorkerDeadline(after(5), created, DEFAULT_WORKER_DEADLINE_SETTINGS)).toEqual(after(4));
  });

  it("picks the tier with the largest lead time that fits", () => {
    expect(bufferDaysFor(10 * DAY, DEFAULT_WORKER_DEADLINE_SETTINGS)).toBe(4);
    expect(bufferDaysFor(30 * DAY, DEFAULT_WORKER_DEADLINE_SETTINGS)).toBe(4);
    expect(bufferDaysFor(50 * DAY, DEFAULT_WORKER_DEADLINE_SETTINGS)).toBe(5);
    expect(bufferDaysFor(9.9 * DAY, DEFAULT_WORKER_DEADLINE_SETTINGS)).toBe(1);
    expect(computeWorkerDeadline(after(60), created, DEFAULT_WORKER_DEADLINE_SETTINGS)).toEqual(after(55));
  });

  it("checks tiers longest first, whatever order they were saved in", () => {
    const settings = { defaultDays: 1, tiers: [{ minLeadDays: 10, bufferDays: 4 }, { minLeadDays: 50, bufferDays: 5 }] };
    expect(bufferDaysFor(70 * DAY, settings)).toBe(5);
  });

  it("never takes more than half the lead time", () => {
    // 12-hour order, 1-day default gap -> worker gets 6 hours.
    const deadline = new Date(created.getTime() + 12 * 60 * 60 * 1000);
    expect(computeWorkerDeadline(deadline, created, DEFAULT_WORKER_DEADLINE_SETTINGS)).toEqual(
      new Date(created.getTime() + 6 * 60 * 60 * 1000),
    );
  });

  it("handles no deadline and a deadline before creation", () => {
    expect(computeWorkerDeadline(null, created, DEFAULT_WORKER_DEADLINE_SETTINGS)).toBeNull();
    expect(computeWorkerDeadline(after(-1), created, DEFAULT_WORKER_DEADLINE_SETTINGS)).toEqual(after(-1));
  });

  it("falls back to defaults for unreadable stored values", () => {
    expect(parseWorkerDeadlineSettings(null)).toEqual(DEFAULT_WORKER_DEADLINE_SETTINGS);
    expect(parseWorkerDeadlineSettings({ defaultDays: -3, tiers: [] })).toEqual(DEFAULT_WORKER_DEADLINE_SETTINGS);
    expect(parseWorkerDeadlineSettings({ defaultDays: 2, tiers: [] })).toEqual({ defaultDays: 2, tiers: [] });
  });

  it("rejects two rules with the same lead time", () => {
    const result = workerDeadlineSettingsSchema.safeParse({
      defaultDays: 1,
      tiers: [{ minLeadDays: 10, bufferDays: 4 }, { minLeadDays: 10, bufferDays: 2 }],
    });
    expect(result.success).toBe(false);
  });
});
