import { YOUTUBE_NOT_FOUND } from "./link";
import type { YoutubeLinkTarget, YoutubeStats } from "./link";

/**
 * YouTube Data API v3 calls (2026-11-10). One `channels.list` or `videos.list`
 * request per lookup, 1 quota unit each (the free daily quota is 10,000).
 * The fetch function is injectable so the parsing is unit-tested without a
 * network. Only ids parsed from the link reach Google; the link is never fetched.
 */

export type YoutubeLookup = YoutubeStats & {
  kind: "CHANNEL" | "VIDEO";
  /** UC… channel id, or the 11-character video id. */
  id: string;
  title: string;
  /** The channel the video belongs to (same as `id` for a channel). */
  channelId: string;
  channelTitle: string;
  /** The channel's @handle without the @, when YouTube gives one (channels only). */
  handle: string | null;
};

export type YoutubeLookupResult = { ok: true; data: YoutubeLookup } | { ok: false; error: string };

const API = "https://www.googleapis.com/youtube/v3";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

function count(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

type ApiItem = {
  id?: string;
  snippet?: { title?: string; channelId?: string; channelTitle?: string; customUrl?: string };
  statistics?: Record<string, unknown>;
};

/** Turns a `channels.list` / `videos.list` response into a lookup. Exported for tests. */
export function parseYoutubeResponse(kind: "CHANNEL" | "VIDEO", body: unknown): YoutubeLookupResult {
  const item = (body as { items?: ApiItem[] } | null)?.items?.[0];
  if (!item?.id) {
    return { ok: false, error: YOUTUBE_NOT_FOUND[kind] };
  }
  const stats = item.statistics ?? {};
  const title = item.snippet?.title?.trim() || item.id;
  if (kind === "CHANNEL") {
    return {
      ok: true,
      data: {
        kind,
        id: item.id,
        title,
        channelId: item.id,
        channelTitle: title,
        // customUrl is "@handle" on today's channels; older custom names have no @ and aren't handles.
        handle: item.snippet?.customUrl?.startsWith("@") ? item.snippet.customUrl.slice(1) : null,
        // Hidden subscriber counts come back as hiddenSubscriberCount: true and no number.
        subscribers: stats.hiddenSubscriberCount === true ? null : count(stats.subscriberCount),
        views: count(stats.viewCount),
        likes: null,
        comments: null,
      },
    };
  }
  return {
    ok: true,
    data: {
      kind,
      id: item.id,
      title,
      channelId: item.snippet?.channelId ?? "",
      channelTitle: item.snippet?.channelTitle?.trim() ?? "",
      handle: null,
      subscribers: null,
      views: count(stats.viewCount),
      // Absent when the owner hides likes or turns comments off.
      likes: count(stats.likeCount),
      comments: count(stats.commentCount),
    },
  };
}

/** A user-facing message for an API error response. */
export function describeApiError(status: number, body: unknown): string {
  const reason = (body as { error?: { errors?: { reason?: string }[] } } | null)?.error?.errors?.[0]?.reason;
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") return "YouTube's daily request limit is used up. Try again tomorrow.";
  if (reason === "keyInvalid" || status === 400 && reason === "badRequest") return "The YouTube API key is not valid.";
  if (status === 403) return "YouTube refused the request. Check that the API key allows the YouTube Data API v3.";
  if (status === 404) return "Not found on YouTube.";
  return `YouTube returned an error (${status}). Try again later.`;
}

/** Looks up a channel or video's public stats. */
export async function lookupYoutube(target: YoutubeLinkTarget, apiKey: string, fetchImpl: Fetch = fetch): Promise<YoutubeLookupResult> {
  const params = new URLSearchParams({ part: "snippet,statistics", key: apiKey });
  let kind: "CHANNEL" | "VIDEO" = "CHANNEL";
  if (target.kind === "video") {
    kind = "VIDEO";
    params.set("id", target.videoId);
  } else if (target.kind === "channel") params.set("id", target.channelId);
  else if (target.kind === "handle") params.set("forHandle", `@${target.handle}`);
  else params.set("forUsername", target.username);

  let response: Response;
  try {
    response = await fetchImpl(`${API}/${kind === "VIDEO" ? "videos" : "channels"}?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, error: "Couldn't reach YouTube. Check the connection and try again." };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, error: describeApiError(response.status, body) };
  return parseYoutubeResponse(kind, body);
}
