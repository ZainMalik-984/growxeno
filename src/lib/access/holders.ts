import "server-only";

import type { TransactionClient } from "@/lib/db/transaction";

/**
 * Ids of the ACTIVE users who effectively hold `permissionKey`, with the same
 * precedence as the resolver (src/lib/permissions/resolve.ts): a direct DENY
 * removes it even when a role grants it, a direct ALLOW gives it, otherwise any
 * role that grants it. There is no role-name special case (Super Admin is an
 * ordinary role). Only rows for this one permission are loaded.
 */
export async function listActiveUserIdsWithPermission(tx: TransactionClient, permissionKey: string): Promise<string[]> {
  const users = await tx.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      directPermissions: { where: { permission: { key: permissionKey } }, select: { effect: true } },
      roles: {
        select: { role: { select: { permissions: { where: { permission: { key: permissionKey } }, select: { permissionId: true } } } } },
      },
    },
  });
  return users
    .filter((user) => {
      const direct = user.directPermissions[0]?.effect;
      if (direct === "DENY") return false;
      if (direct === "ALLOW") return true;
      return user.roles.some((assignment) => assignment.role.permissions.length > 0);
    })
    .map((user) => user.id);
}
