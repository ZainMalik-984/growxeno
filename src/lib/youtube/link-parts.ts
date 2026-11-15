import { safeExternalHref } from "@/lib/orders/url-normalize";
import { parseYoutubeLink, studioAnalyticsUrl, youtubeChannelUrl } from "@/lib/youtube/link";

/**
 * What an item's link shows in its header (owner request, 2026-11-14):
 * "@username (the handle link) | link icon (the channel-id URL) | Studio",
 * without printing the channel ID. Pure, so it is unit-tested.
 */
export type ItemLinkParts = {
  /** "@handle", the channel or video title, or the link's host. */
  label: string;
  href: string;
  /** The youtube.com/channel/UC… (or watch?v=) URL, when it differs from href. */
  idHref: string | null;
  /** YouTube Studio analytics, for a channel whose id is known. */
  studioHref: string | null;
};

export function itemLinkParts(
  link: string | null | undefined,
  stats: { kind: "CHANNEL" | "VIDEO" | null; sourceId: string | null; title: string | null } | null,
): ItemLinkParts | null {
  const href = link ? safeExternalHref(link) : null;
  if (!link || !href) return null;

  if (!stats) {
    let host = link;
    try {
      host = new URL(href).hostname.replace(/^www\./, "");
    } catch {}
    return { label: host, href, idHref: null, studioHref: null };
  }

  const parsed = parseYoutubeLink(link);
  const target = parsed.ok ? parsed.target : null;
  const channelId = stats.kind === "CHANNEL" && stats.sourceId ? stats.sourceId : target?.kind === "channel" ? target.channelId : null;
  const videoId = stats.kind === "VIDEO" && stats.sourceId ? stats.sourceId : target?.kind === "video" ? target.videoId : null;

  const label =
    target?.kind === "handle"
      ? `@${target.handle}`
      : target?.kind === "username"
        ? target.username
        : (stats.title ?? (videoId ? "Video" : "Channel"));

  let idHref = channelId ? youtubeChannelUrl(channelId) : videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : null;
  if (idHref && target && (target.kind === "channel" || target.kind === "video")) idHref = null; // the link already is it

  return { label, href, idHref, studioHref: channelId ? studioAnalyticsUrl(channelId) : null };
}
