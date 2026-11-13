import { describe, expect, it } from "vitest";

import { workerPayStage } from "@/lib/finance/worker-pay-stage";
import { completionBlocker, isCheckedOnYoutube } from "@/lib/orders/completion";

describe("workerPayStage (2026-11-12: balance only from accepted deliveries)", () => {
  it("counts a done item once the team accepted the delivery", () => {
    expect(workerPayStage("DONE", true)).toBe("earned");
  });
  it("keeps a done item awaiting confirmation until it's accepted", () => {
    // Inzmam's Watch Hours on order #2, marked done by him.
    expect(workerPayStage("DONE", false)).toBe("awaiting");
  });
  it("counts an item the team closed with pay", () => {
    expect(workerPayStage("CANCELLED", false)).toBe("earned");
  });
  it("shows work not marked done yet as in progress", () => {
    for (const item of ["PENDING", "PROCESSING", "REFILL"] as const) {
      expect(workerPayStage(item, false)).toBe("inProgress");
    }
  });
});

describe("completionBlocker (2026-11-12: Done only when YouTube shows the target)", () => {
  const subs = { metricType: "SUBSCRIBERS" as const, categoryName: "Youtube", targetCount: 3170 };

  it("blocks below the target and says how far off it is", () => {
    expect(completionBlocker({ ...subs, currentCount: 1120 })).toBe("YouTube shows 1,120 of 3,170 subscribers, 2,050 to go.");
  });
  it("allows it at or past the target", () => {
    expect(completionBlocker({ ...subs, currentCount: 3170 })).toBeNull();
    expect(completionBlocker({ ...subs, currentCount: 3300 })).toBeNull();
  });
  it("checks views too", () => {
    expect(completionBlocker({ metricType: "VIEWS", categoryName: "YouTube", targetCount: 1000, currentCount: 10 })).toMatch(/990 to go/);
  });
  it("doesn't check watch hours or other platforms", () => {
    expect(isCheckedOnYoutube("WATCH_HOURS", "Youtube")).toBe(false);
    expect(isCheckedOnYoutube("FOLLOWERS", "Instagram")).toBe(false);
    expect(completionBlocker({ metricType: "WATCH_HOURS", categoryName: "Youtube", targetCount: 4001, currentCount: 1000 })).toBeNull();
  });
});
