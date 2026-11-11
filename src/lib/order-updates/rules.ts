/**
 * Order item updates (2026-11-11, owner request): a chat-style thread on each
 * order item where the worker reports progress with a new count, text and
 * screenshots. Pure rules shared by the server and the composer, unit-tested.
 */

export const ITEM_UPDATE_BUCKET = "item-updates";
export const ITEM_UPDATE_MAX_TEXT = 2000;
export const ITEM_UPDATE_MAX_IMAGES = 4;
/** Largest single image the server accepts (the browser shrinks screenshots before sending). */
export const ITEM_UPDATE_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** All images together, to stay under the Server Action body limit (9 MB, next.config.ts). */
export const ITEM_UPDATE_MAX_TOTAL_BYTES = 8.5 * 1024 * 1024;
/** Stored screenshots fit within this many pixels on each side: enough to read numbers in analytics. */
export const ITEM_UPDATE_MAX_DIMENSION = 1600;
export const ITEM_UPDATE_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

export type ItemStatus = "PENDING" | "PROCESSING" | "DONE" | "REFILL" | "CANCELLED";

/**
 * Who may post, and whether they may change the count with it.
 * - The team (anyone who sees every order) may post and set the count on any item.
 * - The assigned worker may post on their own item unless it was cancelled, and
 *   set the count once they've accepted it (processing or refill), the same
 *   rule as the old Update button.
 */
export function updatePermissions(input: {
  isTeam: boolean;
  isAssignedWorker: boolean;
  canChangeStatus: boolean;
  status: ItemStatus;
  hasMetric: boolean;
}): { canPost: boolean; canSetCount: boolean } {
  if (input.isTeam) return { canPost: true, canSetCount: input.hasMetric };
  if (!input.isAssignedWorker || !input.canChangeStatus || input.status === "CANCELLED") {
    return { canPost: false, canSetCount: false };
  }
  return { canPost: true, canSetCount: input.hasMetric && (input.status === "PROCESSING" || input.status === "REFILL") };
}

/**
 * Who is told about a new update (owner request, 2026-11-11: "notification for
 * all who have access to the order, but not other outsourced workers"):
 * everyone on the team who can see every order, plus the item's own worker.
 * Workers on the order's OTHER items are never included (they aren't team and
 * aren't this item's worker), and neither is the person who posted it.
 * Returns each user once, the item's worker marked so their link opens their
 * own task list.
 */
export function updateRecipients(input: {
  teamUserIds: readonly string[];
  itemWorkerUserIds: readonly (string | null)[];
  authorId: string;
}): Array<{ userId: string; isItemWorker: boolean }> {
  const workers = new Set(input.itemWorkerUserIds.filter((id): id is string => Boolean(id)));
  const all = new Set([...input.teamUserIds, ...workers]);
  all.delete(input.authorId);
  return [...all].map((userId) => ({ userId, isItemWorker: workers.has(userId) && !input.teamUserIds.includes(userId) }));
}

/** Reads the count typed in the composer: "2,350" → 2350. Empty → null. Anything else → an error. */
export function parseCount(raw: string | null | undefined): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = (raw ?? "").replace(/[\s,]/g, "");
  if (text === "") return { ok: true, value: null };
  if (!/^\d+$/.test(text)) return { ok: false, error: "Enter the count as a whole number, like 2350." };
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value > 2_147_483_647) return { ok: false, error: "That number is too large." };
  return { ok: true, value };
}

/** An update needs at least one of: text, a new count, a screenshot. */
export function isEmptyUpdate(input: { body: string; count: number | null; imageCount: number }): boolean {
  return input.body.trim() === "" && input.count === null && input.imageCount === 0;
}

/** "+120", "−40", "±0". */
export function signedChange(from: number | null, to: number): string {
  const change = to - (from ?? 0);
  const n = new Intl.NumberFormat("en-US").format(Math.abs(change));
  return change > 0 ? `+${n}` : change < 0 ? `−${n}` : "±0";
}
