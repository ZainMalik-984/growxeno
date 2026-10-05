import { describe, expect, it } from "vitest";

import { thisWeekRangeUtc, todayRangeUtc } from "@/lib/orders/date-ranges";

describe("todayRangeUtc", () => {
  it("spans exactly one UTC day starting at midnight", () => {
    const now = new Date("2026-09-16T14:32:00Z");
    const { start, end } = todayRangeUtc(now);
    expect(start.toISOString()).toBe("2026-09-16T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-17T00:00:00.000Z");
  });
});

describe("thisWeekRangeUtc", () => {
  it("starts on Monday and spans exactly seven days, for a mid-week date", () => {
    // 2026-09-16 is a Wednesday.
    const now = new Date("2026-09-16T14:32:00Z");
    const { start, end } = thisWeekRangeUtc(now);
    expect(start.toISOString()).toBe("2026-09-14T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-21T00:00:00.000Z");
  });

  it("treats Sunday as the last day of the week, not the first", () => {
    // 2026-09-20 is a Sunday.
    const now = new Date("2026-09-20T05:00:00Z");
    const { start, end } = thisWeekRangeUtc(now);
    expect(start.toISOString()).toBe("2026-09-14T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-21T00:00:00.000Z");
  });

  it("resolves Monday itself to the week that starts on it", () => {
    const now = new Date("2026-09-14T00:00:00Z");
    const { start } = thisWeekRangeUtc(now);
    expect(start.toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });
});
