import type { EffectivePermissions } from "./resolve";

/**
 * Record scopes.
 *
 * A permission answers "may this person perform this action?". It deliberately
 * does NOT answer "on which records?". Mixing the two is how a Worker ends up
 * able to read every order in the business just because they can open the
 * orders page.
 *
 * The two questions are kept separate with a naming convention: for an action
 * key `k`, the companion key `k.all` widens the scope from the actor's own or
 * assigned records to every record.
 *
 *   orders.view            -> ASSIGNED : only items assigned to this worker
 *   orders.view + .all     -> ALL      : every order
 *
 * Query functions take the resulting scope and translate it into a WHERE
 * clause. A scope is never passed from the client.
 */

export type AccessScope = "ALL" | "ASSIGNED" | "NONE";

/** The catalog key that widens `actionKey` to every record. */
export function scopeKeyFor(actionKey: string): string {
  return `${actionKey}.all`;
}

/**
 * Resolve the record scope for an action.
 *
 * NONE      the actor may not perform the action at all
 * ASSIGNED  the actor may act on their own / assigned records
 * ALL       the actor may act on every record
 */
export function resolveScope(
  permissions: EffectivePermissions,
  actionKey: string,
): AccessScope {
  if (!permissions.has(actionKey)) return "NONE";
  return permissions.has(scopeKeyFor(actionKey)) ? "ALL" : "ASSIGNED";
}
