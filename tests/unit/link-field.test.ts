import { describe, expect, it } from "vitest";

import { linkFieldFor, platformOf } from "@/lib/services/link-field";

describe("order item link field", () => {
  it("recognises platforms from category names", () => {
    expect(platformOf("Youtube")).toBe("youtube");
    expect(platformOf("YouTube")).toBe("youtube");
    expect(platformOf("TikTok")).toBe("tiktok");
    expect(platformOf("X")).toBe("x");
    expect(platformOf("Twitter")).toBe("x");
    expect(platformOf("Instagram")).toBe("instagram");
    expect(platformOf("Facebook")).toBe("facebook");
    expect(platformOf("Design")).toBe("other");
    expect(platformOf("Xbox")).toBe("other");
  });

  it("asks for the channel for YouTube subscribers and watch hours", () => {
    expect(linkFieldFor("SUBSCRIBERS", "Youtube")).toMatchObject({ label: "Channel link", noun: "channel" });
    expect(linkFieldFor("WATCH_HOURS", "Youtube").label).toBe("Channel link");
  });

  it("asks for a video or post for views, likes and comments", () => {
    expect(linkFieldFor("VIEWS", "Youtube")).toMatchObject({ label: "Video link", placeholder: "https://youtube.com/watch?v=…" });
    expect(linkFieldFor("VIEWS", "TikTok").label).toBe("Video link");
    expect(linkFieldFor("LIKES", "X").label).toBe("Post link");
    expect(linkFieldFor("COMMENTS", "Instagram").label).toBe("Post or reel link");
    expect(linkFieldFor("LIKES", "Facebook").label).toBe("Post link");
  });

  it("asks for the profile or page for followers", () => {
    expect(linkFieldFor("FOLLOWERS", "TikTok")).toMatchObject({ label: "Profile link", placeholder: "https://tiktok.com/@username" });
    expect(linkFieldFor("FOLLOWERS", "Instagram").label).toBe("Profile link");
    expect(linkFieldFor("FOLLOWERS", "Facebook").label).toBe("Page link");
  });
});
