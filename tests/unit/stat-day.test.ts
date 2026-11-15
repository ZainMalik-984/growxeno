import { describe, expect, it } from "vitest";

import { isDayEndReading, pktDay, statDayFor, statTakenAt } from "@/lib/youtube/stat-day";

// Pakistan is UTC+5: 00:00 PKT on 2 Jan = 19:00 UTC on 1 Jan.
const utc = (iso: string) => new Date(iso);

describe("Pakistan days for YouTube readings (2026-11-13)", () => {
  it("finds the Pakistan day a moment falls in", () => {
    expect(pktDay(utc("2026-01-01T19:30:00Z"))).toEqual({ start: utc("2026-01-01T19:00:00Z"), end: utc("2026-01-02T19:00:00Z") });
    expect(pktDay(utc("2026-01-01T18:59:59Z")).start).toEqual(utc("2025-12-31T19:00:00Z"));
  });

  it("records the 00:00 PKT reading under the day that just ended", () => {
    // Checked at 00:00 PKT on 2 Jan → counts for 1 Jan.
    const at = utc("2026-01-01T19:00:00Z");
    expect(statDayFor(at, true).start).toEqual(utc("2025-12-31T19:00:00Z"));
    expect(statTakenAt(at, true)).toEqual(utc("2026-01-01T18:59:59Z"));
    expect(isDayEndReading(statTakenAt(at, true))).toBe(true);
  });

  it("still lands on the previous day when the cron runs late", () => {
    expect(statDayFor(utc("2026-01-01T19:55:00Z"), true).start).toEqual(utc("2025-12-31T19:00:00Z"));
  });

  it("puts a daytime refresh on that same day", () => {
    // 15:00 PKT on 2 Jan.
    const at = utc("2026-01-02T10:00:00Z");
    expect(statDayFor(at, false).start).toEqual(utc("2026-01-01T19:00:00Z"));
    expect(statTakenAt(at, false)).toEqual(at);
    expect(isDayEndReading(at)).toBe(false);
  });
});

import { defaultTrackedStats, effectiveTrackedStats } from "@/lib/services/tracked-stats";

describe("tracked stats per service (2026-11-13)", () => {
  it("starts watch hours with nothing and a video service with views, likes and comments", () => {
    expect(defaultTrackedStats("WATCH_HOURS")).toEqual([]);
    expect(defaultTrackedStats("VIEWS")).toEqual(["views", "likes", "comments"]);
    expect(defaultTrackedStats("SUBSCRIBERS")).toEqual(["subscribers"]);
  });
  it("always includes the progress stat, in a fixed order", () => {
    expect(effectiveTrackedStats([], "VIEWS")).toEqual(["views"]);
    expect(effectiveTrackedStats(["comments", "subscribers"], "VIEWS")).toEqual(["subscribers", "views", "comments"]);
    expect(effectiveTrackedStats(["bogus"], "WATCH_HOURS")).toEqual([]);
  });
});
