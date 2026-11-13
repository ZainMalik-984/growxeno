import { describe, expect, it, vi } from "vitest";

import { describeApiError, lookupYoutube, parseYoutubeResponse } from "@/lib/youtube/api";
import {
  countsAfterReading,
  kindMismatch,
  metricValueFrom,
  parseYoutubeLink,
  readableChannelLink,
  studioAnalyticsUrl,
  youtubeKindFor,
} from "@/lib/youtube/link";
import { parseYoutubeStatsSettings, DEFAULT_YOUTUBE_STATS_SETTINGS, formatInterval } from "@/lib/settings/youtube-stats";

const CHANNEL = "UCMZRwA4rN6Pjg7fttsSLuVQ";

describe("parseYoutubeLink", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("reads the video id from %s", (url, id) => {
    expect(parseYoutubeLink(url)).toEqual({ ok: true, target: { kind: "video", videoId: id } });
  });

  it("reads channel ids, handles and legacy usernames", () => {
    expect(parseYoutubeLink(`https://www.youtube.com/channel/${CHANNEL}/videos`)).toEqual({
      ok: true,
      target: { kind: "channel", channelId: CHANNEL },
    });
    expect(parseYoutubeLink("https://www.youtube.com/@MrBeast")).toEqual({ ok: true, target: { kind: "handle", handle: "MrBeast" } });
    expect(parseYoutubeLink("https://youtube.com/@some.channel-1/featured")).toEqual({
      ok: true,
      target: { kind: "handle", handle: "some.channel-1" },
    });
    expect(parseYoutubeLink("https://www.youtube.com/user/pewdiepie")).toEqual({
      ok: true,
      target: { kind: "username", username: "pewdiepie" },
    });
  });

  it("explains links it cannot use", () => {
    expect(parseYoutubeLink("")).toMatchObject({ ok: false });
    expect(parseYoutubeLink("https://vimeo.com/123")).toEqual({ ok: false, error: "That isn't a YouTube link." });
    expect(parseYoutubeLink("https://youtube.com/watch?v=short")).toMatchObject({ ok: false });
    expect(parseYoutubeLink("https://youtube.com/channel/notanid")).toMatchObject({ ok: false });
    expect(parseYoutubeLink("https://youtube.com/c/SomeName")).toMatchObject({ ok: false, error: expect.stringContaining("@handle") });
    expect(parseYoutubeLink("https://evil.com/youtube.com/watch?v=dQw4w9WgXcQ")).toMatchObject({ ok: false });
  });
});

describe("service kinds", () => {
  it("maps services to channel or video links", () => {
    expect(youtubeKindFor("SUBSCRIBERS")).toBe("channel");
    expect(youtubeKindFor("WATCH_HOURS")).toBe("channel");
    expect(youtubeKindFor("VIEWS")).toBe("video");
    expect(youtubeKindFor("LIKES")).toBe("video");
    expect(youtubeKindFor(null)).toBeNull();
  });

  it("flags a video link on a channel service and vice versa", () => {
    expect(kindMismatch("SUBSCRIBERS", { kind: "video", videoId: "dQw4w9WgXcQ" })).toMatch(/channel link/);
    expect(kindMismatch("VIEWS", { kind: "handle", handle: "x" })).toMatch(/video link/);
    expect(kindMismatch("VIEWS", { kind: "video", videoId: "dQw4w9WgXcQ" })).toBeNull();
  });

  it("builds the Studio analytics link", () => {
    expect(studioAnalyticsUrl(CHANNEL)).toBe(`https://studio.youtube.com/channel/${CHANNEL}/analytics/tab-overview/period-default`);
  });

  it("picks the reading that counts as progress", () => {
    const stats = { subscribers: 10, views: 20, likes: 30, comments: 40 };
    expect(metricValueFrom(stats, "SUBSCRIBERS")).toBe(10);
    expect(metricValueFrom(stats, "VIEWS")).toBe(20);
    expect(metricValueFrom(stats, "LIKES")).toBe(30);
    expect(metricValueFrom(stats, "COMMENTS")).toBe(40);
    expect(metricValueFrom(stats, "WATCH_HOURS")).toBeNull();
  });
});

describe("countsAfterReading", () => {
  it("makes the first reading the baseline when no starting count was given, keeping how many more were asked for", () => {
    expect(countsAfterReading({ startingCount: 0, currentCount: 0, targetCount: 5000 }, 1200, true)).toEqual({
      startingCount: 1200,
      currentCount: 1200,
      targetCount: 6200,
    });
    expect(countsAfterReading({ startingCount: null, currentCount: null, targetCount: null }, 50, true)).toEqual({
      startingCount: 50,
      currentCount: 50,
      targetCount: null,
    });
  });

  it("keeps a starting count someone entered and only moves the current count", () => {
    expect(countsAfterReading({ startingCount: 1000, currentCount: 1000, targetCount: 6000 }, 1003, true)).toEqual({
      startingCount: 1000,
      currentCount: 1003,
      targetCount: 6000,
    });
    expect(countsAfterReading({ startingCount: 1200, currentCount: 1500, targetCount: 6200 }, 2400, false)).toEqual({
      startingCount: 1200,
      currentCount: 2400,
      targetCount: 6200,
    });
  });

  it("leaves counts alone when there is no usable reading", () => {
    expect(countsAfterReading({ startingCount: 0, currentCount: 0, targetCount: 10 }, null, true)).toBeNull();
    expect(countsAfterReading({ startingCount: 0, currentCount: 0, targetCount: 10 }, 3_000_000_000, false)).toBeNull();
  });
});

describe("YouTube API responses", () => {
  it("parses a channel", () => {
    const result = parseYoutubeResponse("CHANNEL", {
      items: [{ id: CHANNEL, snippet: { title: "My Channel" }, statistics: { subscriberCount: "12300", viewCount: "456789", hiddenSubscriberCount: false } }],
    });
    expect(result).toEqual({
      ok: true,
      data: { kind: "CHANNEL", id: CHANNEL, title: "My Channel", channelId: CHANNEL, channelTitle: "My Channel", handle: null, subscribers: 12300, views: 456789, likes: null, comments: null },
    });
  });

  it("treats hidden subscriber counts and hidden likes as unknown", () => {
    const channel = parseYoutubeResponse("CHANNEL", { items: [{ id: CHANNEL, statistics: { hiddenSubscriberCount: true, viewCount: "5" } }] });
    expect(channel.ok && channel.data.subscribers).toBeNull();
    const video = parseYoutubeResponse("VIDEO", {
      items: [{ id: "dQw4w9WgXcQ", snippet: { title: "Song", channelId: CHANNEL, channelTitle: "Ch" }, statistics: { viewCount: "100" } }],
    });
    expect(video).toMatchObject({ ok: true, data: { views: 100, likes: null, comments: null, channelId: CHANNEL } });
  });

  it("says when nothing was found", () => {
    expect(parseYoutubeResponse("VIDEO", { items: [] })).toMatchObject({ ok: false, error: expect.stringContaining("private or deleted") });
    expect(parseYoutubeResponse("CHANNEL", {})).toMatchObject({ ok: false });
  });

  it("describes API errors", () => {
    expect(describeApiError(403, { error: { errors: [{ reason: "quotaExceeded" }] } })).toMatch(/daily request limit/);
    expect(describeApiError(400, { error: { errors: [{ reason: "keyInvalid" }] } })).toMatch(/not valid/);
    expect(describeApiError(500, null)).toMatch(/500/);
  });

  it("asks for a handle with forHandle and a video with videos.list", async () => {
    const fetchImpl = vi.fn<(url: string) => Promise<Response>>(async () => Response.json({ items: [{ id: CHANNEL, statistics: { subscriberCount: "1" } }] }));
    await lookupYoutube({ kind: "handle", handle: "MrBeast" }, "KEY", fetchImpl);
    const channelUrl = new URL(fetchImpl.mock.calls[0][0]);
    expect(channelUrl.pathname).toBe("/youtube/v3/channels");
    expect(channelUrl.searchParams.get("forHandle")).toBe("@MrBeast");
    expect(channelUrl.searchParams.get("key")).toBe("KEY");

    await lookupYoutube({ kind: "video", videoId: "dQw4w9WgXcQ" }, "KEY", fetchImpl);
    const videoUrl = new URL(fetchImpl.mock.calls[1][0]);
    expect(videoUrl.pathname).toBe("/youtube/v3/videos");
    expect(videoUrl.searchParams.get("id")).toBe("dQw4w9WgXcQ");
  });

  it("reports network failures without throwing", async () => {
    const result = await lookupYoutube({ kind: "video", videoId: "dQw4w9WgXcQ" }, "KEY", async () => {
      throw new Error("offline");
    });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("Couldn't reach YouTube") });
  });
});

describe("YouTube stats settings", () => {
  it("falls back to the defaults for unreadable values", () => {
    expect(parseYoutubeStatsSettings(null)).toEqual(DEFAULT_YOUTUBE_STATS_SETTINGS);
    expect(parseYoutubeStatsSettings({ enabled: true, intervalHours: 0 })).toEqual(DEFAULT_YOUTUBE_STATS_SETTINGS);
    expect(parseYoutubeStatsSettings({ enabled: false, intervalHours: 24 })).toEqual({ enabled: false, intervalHours: 24 });
  });

  it("formats intervals", () => {
    expect(formatInterval(1)).toBe("hour");
    expect(formatInterval(6)).toBe("6 hours");
    expect(formatInterval(24)).toBe("day");
    expect(formatInterval(72)).toBe("3 days");
    expect(formatInterval(168)).toBe("week");
  });
});

describe("channel links shown as the @handle (2026-11-12)", () => {
  it("reads the handle from a channel response", () => {
    const result = parseYoutubeResponse("CHANNEL", {
      items: [{ id: "UCy-i8IvDtFI7Lrpd-aev2-Q", snippet: { title: "Courtnie", customUrl: "@courtniecotterell" }, statistics: {} }],
    });
    expect(result).toMatchObject({ ok: true, data: { id: "UCy-i8IvDtFI7Lrpd-aev2-Q", handle: "courtniecotterell" } });
  });
  it("ignores an old custom name that isn't a handle", () => {
    const result = parseYoutubeResponse("CHANNEL", { items: [{ id: "UCy-i8IvDtFI7Lrpd-aev2-Q", snippet: { customUrl: "oldname" } }] });
    expect(result).toMatchObject({ ok: true, data: { handle: null } });
  });
  it("turns a /channel/UC… link into the handle link", () => {
    expect(readableChannelLink("https://www.youtube.com/channel/UCy-i8IvDtFI7Lrpd-aev2-Q", "courtniecotterell")).toBe(
      "https://www.youtube.com/@courtniecotterell",
    );
  });
  it("leaves handle links, videos and unknown handles alone", () => {
    expect(readableChannelLink("https://www.youtube.com/@courtniecotterell", "courtniecotterell")).toBeNull();
    expect(readableChannelLink("https://youtu.be/dQw4w9WgXcQ", "someone")).toBeNull();
    expect(readableChannelLink("https://www.youtube.com/channel/UCy-i8IvDtFI7Lrpd-aev2-Q", null)).toBeNull();
  });
});
