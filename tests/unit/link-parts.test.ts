import { describe, expect, it } from "vitest";

import { itemLinkParts } from "@/lib/youtube/link-parts";

const UC = "UCy-i8IvDtFI7Lrpd-aev2-Q";
const channel = { kind: "CHANNEL" as const, sourceId: UC, title: "Courtnie" };

describe("itemLinkParts", () => {
  it("shows @handle, the channel-id link and Studio for a handle link", () => {
    expect(itemLinkParts("https://www.youtube.com/@courtniecotterell", channel)).toEqual({
      label: "@courtniecotterell",
      href: "https://www.youtube.com/@courtniecotterell",
      idHref: `https://www.youtube.com/channel/${UC}`,
      studioHref: `https://studio.youtube.com/channel/${UC}/analytics/tab-overview/period-default`,
    });
  });

  it("uses the title and skips the duplicate id link for a /channel/ link", () => {
    const parts = itemLinkParts(`https://www.youtube.com/channel/${UC}`, channel);
    expect(parts?.label).toBe("Courtnie");
    expect(parts?.idHref).toBeNull();
    expect(parts?.studioHref).toContain(UC);
  });

  it("has no Studio for a video", () => {
    const parts = itemLinkParts("https://youtu.be/dQw4w9WgXcQ", { kind: "VIDEO", sourceId: "dQw4w9WgXcQ", title: "A video" });
    expect(parts).toMatchObject({ label: "A video", idHref: null, studioHref: null });
  });

  it("shows the host for a non-YouTube link, and nothing without a link", () => {
    expect(itemLinkParts("https://www.instagram.com/someone", null)).toMatchObject({ label: "instagram.com", idHref: null, studioHref: null });
    expect(itemLinkParts(null, null)).toBeNull();
  });
});
