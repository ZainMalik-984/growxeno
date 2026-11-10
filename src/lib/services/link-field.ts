import type { ServiceMetricType } from "./metric-type";

/**
 * How an order item's link field is presented, by service (owner request,
 * 2026-11-10): "for views get video link, for yt subscribers take [the
 * channel]; the field should be the same, just the representation should be
 * according to the name." Storage stays one field (`OrderItem.channelLink`);
 * only the label, example and wording change. Pure, so it is unit-tested.
 */

export type Platform = "youtube" | "tiktok" | "x" | "instagram" | "facebook" | "other";

export type LinkField = {
  /** "Channel link", "Video link", "Profile link", … */
  label: string;
  /** A realistic example for the platform. */
  placeholder: string;
  /** Short noun used in messages and as link text: "channel", "video", "profile", … */
  noun: string;
};

/** Which platform a category is, from its name ("Youtube", "TikTok", "X (Twitter)", …). */
export function platformOf(categoryName: string | null | undefined): Platform {
  const name = (categoryName ?? "").trim().toLowerCase();
  if (/you\s*tube|^yt$/.test(name)) return "youtube";
  if (/tik\s*tok/.test(name)) return "tiktok";
  if (/insta/.test(name)) return "instagram";
  if (/face\s*book|^fb$|meta/.test(name)) return "facebook";
  if (/^x$|^x\b|twitter/.test(name)) return "x";
  return "other";
}

type Kind = "channel" | "profile" | "page" | "video" | "post";

const NOUN: Record<Kind, string> = { channel: "channel", profile: "profile", page: "page", video: "video", post: "post" };

const EXAMPLES: Record<Platform, Partial<Record<Kind, string>>> = {
  youtube: { channel: "https://youtube.com/@channel", video: "https://youtube.com/watch?v=…", post: "https://youtube.com/watch?v=…" },
  tiktok: { profile: "https://tiktok.com/@username", video: "https://tiktok.com/@username/video/…", post: "https://tiktok.com/@username/video/…" },
  instagram: { profile: "https://instagram.com/username", video: "https://instagram.com/reel/…", post: "https://instagram.com/p/…" },
  x: { profile: "https://x.com/username", video: "https://x.com/username/status/…", post: "https://x.com/username/status/…" },
  facebook: { page: "https://facebook.com/pagename", video: "https://facebook.com/watch?v=…", post: "https://facebook.com/pagename/posts/…" },
  other: { channel: "https://…", profile: "https://…", page: "https://…", video: "https://…", post: "https://…" },
};

function kindFor(metric: ServiceMetricType, platform: Platform): Kind {
  switch (metric) {
    case "SUBSCRIBERS":
    case "WATCH_HOURS": // watch hours count across the whole channel
      return platform === "youtube" || platform === "other" ? "channel" : platform === "facebook" ? "page" : "profile";
    case "FOLLOWERS":
      return platform === "facebook" ? "page" : platform === "youtube" ? "channel" : "profile";
    case "VIEWS":
      // A video on YouTube/TikTok/Facebook; a reel or post elsewhere.
      return platform === "instagram" || platform === "x" ? "post" : "video";
    case "LIKES":
    case "COMMENTS":
      return platform === "youtube" || platform === "tiktok" ? "video" : "post";
  }
}

export function linkFieldFor(metric: ServiceMetricType, categoryName?: string | null): LinkField {
  const platform = platformOf(categoryName);
  const kind = kindFor(metric, platform);
  const label = kind === "post" && platform === "instagram" ? "Post or reel link" : `${NOUN[kind][0].toUpperCase()}${NOUN[kind].slice(1)} link`;
  return { label, placeholder: EXAMPLES[platform][kind] ?? "https://…", noun: kind === "post" && platform === "instagram" ? "post" : NOUN[kind] };
}
