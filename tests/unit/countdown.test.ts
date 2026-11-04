import { describe, expect, it } from "vitest";

import { describeDeadline, formatDuration } from "@/lib/time/countdown";

const M = 60 * 1000;
const H = 60 * M;
const D = 24 * H;

describe("countdown", () => {
  it("formats days, hours and minutes", () => {
    expect(formatDuration(3 * D + 4 * H + 12 * M + 30_000)).toBe("3d 4h 12m");
    expect(formatDuration(4 * H + 5 * M)).toBe("4h 5m");
    expect(formatDuration(12 * M)).toBe("12m");
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(2 * D)).toBe("2d 0h 0m");
  });

  it("labels time left and overdue, with urgency", () => {
    const deadline = new Date(10 * D);
    expect(describeDeadline(deadline, 10 * D - 5 * D)).toEqual({ label: "5d 0h 0m left", urgency: "later" });
    expect(describeDeadline(deadline, 10 * D - 2 * D)).toEqual({ label: "2d 0h 0m left", urgency: "near" });
    expect(describeDeadline(deadline, 10 * D - 3 * H)).toEqual({ label: "3h 0m left", urgency: "soon" });
    expect(describeDeadline(deadline, 10 * D + D + 2 * H)).toEqual({ label: "Overdue by 1d 2h 0m", urgency: "overdue" });
  });
});
