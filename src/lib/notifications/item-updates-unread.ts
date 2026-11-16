/**
 * Unread update notifications per order item (owner request, 2026-11-15: "show
 * the notification in each row so we know there is an update, removed once we
 * open it from there"). Update notifications already link to their item
 * (".../orders?updates=<itemId>"), so no new table is needed. Pure helpers
 * here; the queries are in item-updates-unread.server.ts.
 */

const ITEM_IN_URL = /[?&]updates=([0-9a-f-]{36})(?:&|$)/i;

/** The item an update notification's link opens, or null. */
export function itemIdFromActionUrl(url: string | null | undefined): string | null {
  const match = url ? ITEM_IN_URL.exec(url) : null;
  return match ? match[1]!.toLowerCase() : null;
}

/** Unread counts per item from notification links. */
export function countUnreadByItem(urls: ReadonlyArray<string | null>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const url of urls) {
    const itemId = itemIdFromActionUrl(url);
    if (itemId) counts[itemId] = (counts[itemId] ?? 0) + 1;
  }
  return counts;
}
