/**
 * "Is this actor the assignee of this Order Item?" — one shared answer,
 * since there are now two ways to be one: the deprecated internal
 * `workerId` path (pre-2026-10-08 history only, see its schema doc
 * comment) and the live `outsourcedWorkerId` path (External Worker login,
 * confirmed directly 2026-10-08: "External or outsourced workers should
 * be able to login and have there own dashboard").
 *
 * Pure, no imports — safe to use from both server code (query WHERE
 * clauses) and client components (the item panel's own-item checks),
 * which is why this isn't folded into `visibility.ts` (server-only) or
 * `session.ts` (server-only, owns the `Actor` type this takes its shape
 * from without importing it — a type-only import would also work, but
 * duplicating the two fields here keeps this file import-free).
 */

export type AssignmentIdentity = {
  userId: string;
  outsourcedWorkerId: string | null;
};

export function isAssignedToIdentity(
  item: { workerId: string | null; outsourcedWorkerId: string | null },
  identity: AssignmentIdentity,
): boolean {
  return (
    item.workerId === identity.userId ||
    (identity.outsourcedWorkerId != null && item.outsourcedWorkerId === identity.outsourcedWorkerId)
  );
}

/** The Prisma `OrderItemWhereInput`-shaped filter for "assigned to this identity" — merge into a larger `where` with other keys (plain object spread ANDs them). */
export function assignedItemWhere(identity: AssignmentIdentity) {
  return {
    OR: [
      { workerId: identity.userId },
      ...(identity.outsourcedWorkerId ? [{ outsourcedWorkerId: identity.outsourcedWorkerId }] : []),
    ],
  };
}

/**
 * The Prisma `OrderItemWhereInput` for "items this actor may see on the
 * board" (`src/app/(app)/orders/orders-board.tsx`) — confirmed directly,
 * 2026-10-08: an Employee without `orders.view.all` sees items on orders
 * THEY CREATED (`Order.createdById`), not just items literally assigned to
 * them (they're never assigned any, going forward — see
 * `isAssignedToIdentity`'s doc comment). An External Worker still only
 * sees their own assigned items — `assignedItemWhere` alone covers that,
 * since `createdById` will never match a non-Employee actor's id anyway.
 * `canViewAll` gets everything, same as the list page.
 */
export function boardItemWhere(identity: AssignmentIdentity, canViewAll: boolean) {
  if (canViewAll) return {};
  return {
    OR: [...assignedItemWhere(identity).OR, { order: { createdById: identity.userId } }],
  };
}
