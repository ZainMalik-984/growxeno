/**
 * Turns an order activity entry into parts the feed can lay out (owner
 * request, 2026-11-16: "the activity is simple text and can't really tell the
 * context"): who did it, what kind of thing happened, which item, and the
 * details (a status change from → to, who it went to and for how much, the
 * count read from YouTube). Entries only store a sentence (`summary`) and an
 * action code, so the sentence is read back here; anything unrecognised falls
 * back to the sentence itself. Pure, so it is unit-tested.
 */

export type ActivityKind =
  | "created"
  | "order-status"
  | "item-added"
  | "item-status"
  | "assigned"
  | "reassigned"
  | "update"
  | "stats"
  | "screenshots"
  | "withdraw"
  | "note"
  | "other";

export type ActivityDetail =
  | { type: "change"; from: string | null; to: string }
  | { type: "text"; text: string }
  | { type: "person"; name: string; extra?: string | null }
  | { type: "handover"; from: string; to: string };

export type ActivityParts = {
  kind: ActivityKind;
  /** Who did it, when known. */
  actor: string | null;
  /** "changed the status", "assigned", … */
  verb: string;
  /** The item it was about, e.g. "Youtube · Subscribers". */
  item: string | null;
  detail: ActivityDetail | null;
  /** Done by the system rather than a person (e.g. a status worked out from the items). */
  automatic: boolean;
};

const ON_ORDER = / on order #\d+/g;

export function describeActivity(action: string, summary: string, actorLabel: string | null): ActivityParts {
  const base: ActivityParts = { kind: "other", actor: actorLabel, verb: "", item: null, detail: null, automatic: false };
  let m: RegExpExecArray | null;

  switch (action) {
    case "order.created":
      return { ...base, kind: "created", verb: "created the order" };

    case "order.status_changed":
      if ((m = /is now (.+?)( \(updated automatically from its items\))?$/.exec(summary))) {
        const automatic = Boolean(m[2]);
        return { ...base, kind: "order-status", verb: "Order is now", detail: { type: "change", from: null, to: m[1]! }, automatic, actor: automatic ? null : actorLabel };
      }
      break;

    case "order_item.added":
      if ((m = /^(?:(.+?) )?[Aa]dded item "(.+?)"/.exec(summary))) {
        return { ...base, kind: "item-added", actor: m[1] ?? actorLabel, verb: "added an item", item: m[2]! };
      }
      break;

    case "order_item.status_changed":
      if ((m = /^(.+?) changed the item status of "(.+?)" on order #\d+ from (.+?) to (.+)$/.exec(summary))) {
        return { ...base, kind: "item-status", actor: m[1]!, verb: "changed the status", item: m[2]!, detail: { type: "change", from: m[3]!, to: m[4]! } };
      }
      break;

    case "order_item.assigned":
      if ((m = /^(?:(.+?) )?[Aa]ssigned "(.+?)" on order #\d+ to (.+?)(?: at (.+))?$/.exec(summary))) {
        return { ...base, kind: "assigned", actor: m[1] ?? actorLabel, verb: "assigned", item: m[2]!, detail: { type: "person", name: m[3]!, extra: m[4] ?? null } };
      }
      break;

    case "order_item.reassigned_remainder":
      if ((m = /^(.+?) moved the rest of "(.+?)" on order #\d+ from (.+?) to (.+)$/.exec(summary))) {
        return { ...base, kind: "reassigned", actor: m[1]!, verb: "moved the rest", item: m[2]!, detail: { type: "handover", from: m[3]!, to: m[4]! } };
      }
      break;

    case "order_item.update_posted":
      if ((m = /^(.+?) posted an update on "(.+?)" on order #\d+(?:: (.+))?$/.exec(summary))) {
        return { ...base, kind: "update", actor: m[1]!, verb: "posted an update", item: m[2]!, detail: m[3] ? { type: "text", text: m[3] } : null };
      }
      break;

    case "order_item.stats_refreshed":
      if ((m = /^YouTube (starting|latest) count for "(.+?)" on order #\d+: (.+)$/.exec(summary))) {
        return {
          ...base,
          kind: "stats",
          actor: null,
          verb: m[1] === "starting" ? "Starting count read from YouTube" : "Count read from YouTube",
          item: m[2]!,
          detail: { type: "text", text: m[3]! },
          automatic: true,
        };
      }
      break;

    case "order_item.screenshots_requested":
      if ((m = /^(.+?) asked for screenshots on "(.+?)"/.exec(summary))) {
        return { ...base, kind: "screenshots", actor: m[1]!, verb: "asked for screenshots", item: m[2]! };
      }
      break;

    case "order_item.withdraw_requested":
      if ((m = /^(.+?) can't continue "(.+?)" on order #\d+(?: after (.+))?$/.exec(summary))) {
        return { ...base, kind: "withdraw", actor: m[1]!, verb: "can't continue", item: m[2]!, detail: m[3] ? { type: "text", text: `${m[3]} done` } : null };
      }
      break;

    case "order.note_added":
      return { ...base, kind: "note", verb: "added a note" };
  }

  // Unrecognised: the sentence itself, without the order number the page already shows.
  return { ...base, verb: summary.replace(ON_ORDER, "") };
}
