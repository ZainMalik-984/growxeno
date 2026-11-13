import type { ServiceMetricType } from "@/lib/services/metric-type";

/**
 * YouTube link handling (owner request, 2026-11-10): work out which channel or
 * video a pasted link points at, so its public stats can be pulled from the
 * YouTube Data API. Pure — no network — so it is unit-tested and safe in the
 * browser. The link itself is never fetched; only the id taken from it is sent
 * to Google's API.
 */

export type YoutubeLinkTarget =
  | { kind: "video"; videoId: string }
  | { kind: "channel"; channelId: string }
  | { kind: "handle"; handle: string }
  | { kind: "username"; username: string };

export type ParsedYoutubeLink = { ok: true; target: YoutubeLinkTarget } | { ok: false; error: string };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
// YouTube handles: 3–30 letters, digits, underscores, hyphens and periods.
const HANDLE = /^[\p{L}\p{N}_.-]{3,30}$/u;

const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"]);

/** The channel or video a link points at, or why it can't be used. */
export function parseYoutubeLink(input: string): ParsedYoutubeLink {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Enter a YouTube link." };

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: "That isn't a valid link." };
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p));

  if (host === "youtu.be") {
    return VIDEO_ID.test(parts[0] ?? "") ? video(parts[0]) : { ok: false, error: "That youtu.be link has no video id." };
  }
  if (!YOUTUBE_HOSTS.has(host)) return { ok: false, error: "That isn't a YouTube link." };

  const [first = "", second = ""] = parts;
  if (first === "watch") {
    const v = url.searchParams.get("v") ?? "";
    return VIDEO_ID.test(v) ? video(v) : { ok: false, error: "That watch link has no video id." };
  }
  if (["shorts", "live", "embed", "v", "e"].includes(first)) {
    return VIDEO_ID.test(second) ? video(second) : { ok: false, error: "That link has no video id." };
  }
  if (first === "channel") {
    return CHANNEL_ID.test(second)
      ? { ok: true, target: { kind: "channel", channelId: second } }
      : { ok: false, error: "That channel link has no valid channel id (UC…)." };
  }
  if (first.startsWith("@")) {
    const handle = first.slice(1);
    return HANDLE.test(handle)
      ? { ok: true, target: { kind: "handle", handle } }
      : { ok: false, error: "That @handle doesn't look right." };
  }
  if (first === "user" && second) return { ok: true, target: { kind: "username", username: second } };
  if (first === "c" || (first && parts.length === 1 && !["playlist", "feed", "results"].includes(first))) {
    // Old custom URLs (/c/name, /name) can't be looked up without a costly search.
    return { ok: false, error: "Use the channel's @handle link or its /channel/UC… link instead of a custom URL." };
  }
  return { ok: false, error: "Use a channel link (@handle or /channel/UC…) or a video link." };
}

function video(videoId: string): ParsedYoutubeLink {
  return { ok: true, target: { kind: "video", videoId } };
}

/** Whether a service measures a channel (subscribers, watch hours) or a single video. */
export function youtubeKindFor(metric: ServiceMetricType | null | undefined): "channel" | "video" | null {
  if (metric === "SUBSCRIBERS" || metric === "WATCH_HOURS" || metric === "FOLLOWERS") return "channel";
  if (metric === "VIEWS" || metric === "LIKES" || metric === "COMMENTS") return "video";
  return null;
}

/** "This service needs a channel link" when a video link was given, and vice versa. */
export function kindMismatch(metric: ServiceMetricType | null | undefined, target: YoutubeLinkTarget): string | null {
  const wanted = youtubeKindFor(metric);
  if (!wanted) return null;
  const given = target.kind === "video" ? "video" : "channel";
  if (wanted === given) return null;
  return wanted === "channel" ? "This service needs a channel link, not a video link." : "This service needs a video link, not a channel link.";
}

/**
 * The channel's YouTube Studio analytics page (owner request, 2026-11-10, for
 * watch hours). Opens only for someone signed in to that channel.
 */
export function studioAnalyticsUrl(channelId: string): string {
  return `https://studio.youtube.com/channel/${encodeURIComponent(channelId)}/analytics/tab-overview/period-default`;
}

export function youtubeChannelUrl(channelId: string): string {
  return `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`;
}

/** Public counts as YouTube reports them. A missing value is hidden or switched off by the owner. */
export type YoutubeStats = {
  subscribers: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
};

/** The reading that counts as the item's progress for this service, if any. */
export function metricValueFrom(stats: YoutubeStats, metric: ServiceMetricType | null | undefined): number | null {
  switch (metric) {
    case "SUBSCRIBERS":
    case "FOLLOWERS":
      return stats.subscribers;
    case "VIEWS":
      return stats.views;
    case "LIKES":
      return stats.likes;
    case "COMMENTS":
      return stats.comments;
    default:
      // Watch hours are private: only the channel owner sees them, in Studio.
      return null;
  }
}

/** Largest value an item's Int count columns can hold. */
export const MAX_ITEM_COUNT = 2_147_483_647;

/**
 * New counts for an item after a reading (pure, so it is unit-tested).
 * Progress is current − starting. When this is the link's first reading and
 * no starting count was given (0 or empty), the reading becomes the starting
 * count and the target moves with it, so "5000 more" stays 5000 more instead
 * of the channel's whole history counting as delivered work.
 */
export function countsAfterReading(
  item: { startingCount: number | null; currentCount: number | null; targetCount: number | null },
  value: number | null,
  isFirstReading: boolean,
): { startingCount: number | null; currentCount: number | null; targetCount: number | null } | null {
  if (value === null || value < 0 || value > MAX_ITEM_COUNT) return null;
  if (isFirstReading && !item.startingCount) {
    const required = item.targetCount !== null ? Math.max(0, item.targetCount - (item.startingCount ?? 0)) : null;
    const target = required !== null ? Math.min(MAX_ITEM_COUNT, value + required) : null;
    return { startingCount: value, currentCount: value, targetCount: target };
  }
  return { startingCount: item.startingCount, currentCount: value, targetCount: item.targetCount };
}

/**
 * Why a YouTube item's link can't be saved, or null when it can (owner
 * request, 2026-11-12: a wrong link used to only warn and still let the item
 * be created). Checks the link points at a channel or video, and the right
 * one of the two for the service. Shared by the forms and the server.
 */
export function youtubeLinkProblem(metric: ServiceMetricType | null | undefined, link: string): string | null {
  const parsed = parseYoutubeLink(link);
  if (!parsed.ok) return parsed.error;
  return kindMismatch(metric, parsed.target);
}

/** What YouTube says when a well-formed link points at nothing (shared so the forms can block on it). */
export const YOUTUBE_NOT_FOUND = {
  CHANNEL: "No YouTube channel found for that link.",
  VIDEO: "No YouTube video found for that link (it may be private or deleted).",
} as const;

export function isYoutubeNotFound(error: string): boolean {
  return error === YOUTUBE_NOT_FOUND.CHANNEL || error === YOUTUBE_NOT_FOUND.VIDEO;
}

/**
 * The @handle link for a channel typed by its id (owner request, 2026-11-12):
 * "youtube.com/channel/UCy-i8…" becomes "https://www.youtube.com/@courtniecotterell",
 * which reads as the channel. Null when the link is already a handle link,
 * is a video, or there is no handle. The UC… id is kept on the item
 * (statsSourceId), so nothing is lost.
 */
export function readableChannelLink(link: string, handle: string | null | undefined): string | null {
  if (!handle) return null;
  const parsed = parseYoutubeLink(link);
  if (!parsed.ok || (parsed.target.kind !== "channel" && parsed.target.kind !== "username")) return null;
  return `https://www.youtube.com/@${handle}`;
}
