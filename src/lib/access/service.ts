import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit/record";
import type { Actor } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  runTransaction,
  serviceFailure as failure,
  ServiceRejection,
  type ServiceResult,
  type TransactionClient,
} from "@/lib/db/transaction";
import { getAppUrl } from "@/lib/env";
import { isKnownPermissionKey } from "@/lib/permissions/catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/text/slug";

export type { ServiceResult };

/**
 * Access-control write operations.
 *
 * Every function here:
 *   - receives an ALREADY-AUTHORIZED actor (the caller checked the permission);
 *   - runs its change and its audit row in one transaction;
 *   - enforces the two safety rules below.
 *
 * SAFETY RULE 1 — no self-modification of access
 *   A user may not change their own roles or their own direct permissions, even
 *   with users.edit. Otherwise "edit users" quietly means "grant yourself
 *   anything", and the audit trail records a privilege escalation as routine
 *   maintenance. Administrators change each other's access.
 *
 * SAFETY RULE 2 — no administrative lockout
 *   A change is rejected if it would leave the system with no active user
 *   holding users.edit or no active user holding roles.edit. Without this,
 *   revoking one role can make the application permanently unadministrable.
 */

/** Permissions that must always be held by at least one active user. */
const LOCKOUT_GUARDED_PERMISSIONS = ["users.edit", "roles.edit"] as const;

/**
 * Count active users who EFFECTIVELY hold `permissionKey`.
 *
 * Applies the same precedence as the resolver — a direct DENY disqualifies a
 * user even when a role grants the permission — because a lockout check that
 * ignored denies would happily approve a change that locks everyone out.
 *
 * Only rows for this one permission are loaded, so the query stays small.
 */
async function countActiveUsersWithPermission(
  tx: TransactionClient,
  permissionKey: string,
): Promise<number> {
  const users = await tx.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      directPermissions: {
        where: { permission: { key: permissionKey } },
        select: { effect: true },
      },
      roles: {
        select: {
          role: {
            select: {
              permissions: {
                where: { permission: { key: permissionKey } },
                select: { permissionId: true },
              },
            },
          },
        },
      },
    },
  });

  return users.filter((user) => {
    const direct = user.directPermissions[0]?.effect;
    if (direct === "DENY") return false;
    if (direct === "ALLOW") return true;
    return user.roles.some((assignment) => assignment.role.permissions.length > 0);
  }).length;
}

/** Throws (aborting the transaction) if the change would lock administration out. */
async function assertNoLockout(tx: TransactionClient): Promise<void> {
  for (const permissionKey of LOCKOUT_GUARDED_PERMISSIONS) {
    const remaining = await countActiveUsersWithPermission(tx, permissionKey);
    if (remaining === 0) {
      throw new LockoutError(permissionKey);
    }
  }
}

class LockoutError extends ServiceRejection {
  constructor(readonly permissionKey: string) {
    super(
      `This change would leave no active user with "${permissionKey}", ` +
        `which would make the application unadministrable.`,
    );
    this.name = "LockoutError";
  }
}

function isSelf(actor: Actor, userId: string): boolean {
  return actor.user.id === userId;
}

/**
 * Like `runTransaction`, but also asserts no administrative lockout on the way
 * out. A `LockoutError` is a `ServiceRejection` (rather than caught alongside
 * it) so `runTransaction` turns it into a clean failure without knowing
 * anything about lockouts.
 */
async function runGuarded<T>(
  operation: (tx: TransactionClient) => Promise<T>,
): Promise<ServiceResult<T>> {
  return runTransaction(async (tx) => {
    const result = await operation(tx);
    await assertNoLockout(tx);
    return result;
  });
}

// ---------------------------------------------------------------------------
// Role assignment
// ---------------------------------------------------------------------------

export async function assignRoleToUser(
  actor: Actor,
  userId: string,
  roleId: string,
): Promise<ServiceResult> {
  if (isSelf(actor, userId)) {
    return failure("You cannot change your own roles. Ask another administrator.");
  }

  return runGuarded(async (tx) => {
    const [user, role] = await Promise.all([
      tx.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true } }),
      tx.role.findUnique({ where: { id: roleId }, select: { id: true, name: true } }),
    ]);

    if (!user) throw new ServiceRejection("That user no longer exists.");
    if (!role) throw new ServiceRejection("That role no longer exists.");

    const existing = await tx.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
      select: { userId: true },
    });
    if (existing) throw new ServiceRejection(`${user.fullName} already has the ${role.name} role.`);

    await tx.userRole.create({
      data: { userId, roleId, assignedById: actor.user.id },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "user.role.assigned",
      entityType: "User",
      entityId: userId,
      summary: `Assigned role ${role.name} to ${user.fullName}`,
      newValue: { roleId, roleName: role.name },
    });
  });
}

export async function removeRoleFromUser(
  actor: Actor,
  userId: string,
  roleId: string,
): Promise<ServiceResult> {
  if (isSelf(actor, userId)) {
    return failure("You cannot change your own roles. Ask another administrator.");
  }

  return runGuarded(async (tx) => {
    const assignment = await tx.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
      select: {
        user: { select: { fullName: true } },
        role: { select: { name: true } },
      },
    });

    if (!assignment) throw new ServiceRejection("That role is not assigned to this user.");

    await tx.userRole.delete({ where: { userId_roleId: { userId, roleId } } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "user.role.removed",
      entityType: "User",
      entityId: userId,
      summary: `Removed role ${assignment.role.name} from ${assignment.user.fullName}`,
      previousValue: { roleId, roleName: assignment.role.name },
    });
  });
}

// ---------------------------------------------------------------------------
// Direct user permissions (ALLOW / DENY overrides)
// ---------------------------------------------------------------------------

export async function setDirectPermission(
  actor: Actor,
  userId: string,
  permissionKey: string,
  effect: "ALLOW" | "DENY",
  reason?: string,
): Promise<ServiceResult> {
  if (isSelf(actor, userId)) {
    return failure("You cannot change your own permissions. Ask another administrator.");
  }
  if (!isKnownPermissionKey(permissionKey)) {
    return failure("Unknown permission.");
  }

  return runGuarded(async (tx) => {
    const [user, permission] = await Promise.all([
      tx.user.findUnique({ where: { id: userId }, select: { fullName: true } }),
      tx.permission.findUnique({ where: { key: permissionKey }, select: { id: true } }),
    ]);

    if (!user) throw new ServiceRejection("That user no longer exists.");
    if (!permission) {
      throw new ServiceRejection(
        "That permission is not in the database. Run the seed to sync the catalog.",
      );
    }

    const previous = await tx.userPermission.findUnique({
      where: { userId_permissionId: { userId, permissionId: permission.id } },
      select: { effect: true },
    });

    await tx.userPermission.upsert({
      where: { userId_permissionId: { userId, permissionId: permission.id } },
      create: {
        userId,
        permissionId: permission.id,
        effect,
        reason: reason ?? null,
        createdById: actor.user.id,
      },
      update: { effect, reason: reason ?? null, createdById: actor.user.id },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "user.permission.override_set",
      entityType: "User",
      entityId: userId,
      summary: `Set direct ${effect} on ${permissionKey} for ${user.fullName}`,
      previousValue: previous ? { permissionKey, effect: previous.effect } : undefined,
      newValue: { permissionKey, effect, reason: reason ?? null },
    });
  });
}

export async function clearDirectPermission(
  actor: Actor,
  userId: string,
  permissionKey: string,
): Promise<ServiceResult> {
  if (isSelf(actor, userId)) {
    return failure("You cannot change your own permissions. Ask another administrator.");
  }

  return runGuarded(async (tx) => {
    const permission = await tx.permission.findUnique({
      where: { key: permissionKey },
      select: { id: true },
    });
    if (!permission) throw new ServiceRejection("Unknown permission.");

    const existing = await tx.userPermission.findUnique({
      where: { userId_permissionId: { userId, permissionId: permission.id } },
      select: { effect: true, user: { select: { fullName: true } } },
    });
    if (!existing) throw new ServiceRejection("There is no override to remove.");

    await tx.userPermission.delete({
      where: { userId_permissionId: { userId, permissionId: permission.id } },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "user.permission.override_cleared",
      entityType: "User",
      entityId: userId,
      summary: `Removed direct ${existing.effect} on ${permissionKey} for ${existing.user.fullName}`,
      previousValue: { permissionKey, effect: existing.effect },
    });
  });
}

// ---------------------------------------------------------------------------
// Role permissions
// ---------------------------------------------------------------------------

export async function setRolePermission(
  actor: Actor,
  roleId: string,
  permissionKey: string,
  granted: boolean,
): Promise<ServiceResult> {
  if (!isKnownPermissionKey(permissionKey)) {
    return failure("Unknown permission.");
  }

  return runGuarded(async (tx) => {
    const [role, permission] = await Promise.all([
      tx.role.findUnique({ where: { id: roleId }, select: { name: true } }),
      tx.permission.findUnique({ where: { key: permissionKey }, select: { id: true } }),
    ]);

    if (!role) throw new ServiceRejection("That role no longer exists.");
    if (!permission) {
      throw new ServiceRejection(
        "That permission is not in the database. Run the seed to sync the catalog.",
      );
    }

    if (granted) {
      await tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permission.id } },
        create: { roleId, permissionId: permission.id },
        update: {},
      });
    } else {
      await tx.rolePermission.deleteMany({
        where: { roleId, permissionId: permission.id },
      });
    }

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: granted ? "role.permission.granted" : "role.permission.revoked",
      entityType: "Role",
      entityId: roleId,
      summary: `${granted ? "Granted" : "Revoked"} ${permissionKey} ${
        granted ? "to" : "from"
      } role ${role.name}`,
      ...(granted
        ? { newValue: { permissionKey } satisfies Prisma.InputJsonValue }
        : { previousValue: { permissionKey } satisfies Prisma.InputJsonValue }),
    });
  });
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

/**
 * Deactivate or reactivate a user.
 *
 * Deactivation is the deletion mechanism for users (specification Section 140):
 * history stays intact and the account resolves to zero permissions.
 */
export async function setUserActive(
  actor: Actor,
  userId: string,
  isActive: boolean,
): Promise<ServiceResult> {
  if (isSelf(actor, userId)) {
    return failure("You cannot deactivate your own account.");
  }

  return runGuarded(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { fullName: true, isActive: true },
    });
    if (!user) throw new ServiceRejection("That user no longer exists.");
    if (user.isActive === isActive) {
      throw new ServiceRejection(`${user.fullName} is already ${isActive ? "active" : "inactive"}.`);
    }

    await tx.user.update({
      where: { id: userId },
      data: { isActive, deactivatedAt: isActive ? null : new Date() },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: isActive ? "user.reactivated" : "user.deactivated",
      entityType: "User",
      entityId: userId,
      summary: `${isActive ? "Reactivated" : "Deactivated"} ${user.fullName}`,
      previousValue: { isActive: user.isActive },
      newValue: { isActive },
    });
  });
}

// ---------------------------------------------------------------------------
// Roles (specification Section 7)
// ---------------------------------------------------------------------------

export type RoleInput = { name: string; description?: string };

/** Find a slug that is not already taken, appending -2, -3, ... if needed. */
async function uniqueSlug(tx: TransactionClient, name: string): Promise<string> {
  const base = slugify(name) || "role";
  let candidate = base;
  let suffix = 2;
  while (await tx.role.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function createRole(
  actor: Actor,
  input: RoleInput,
): Promise<ServiceResult<{ id: string }>> {
  const name = input.name.trim();
  if (!name) return failure("Give the role a name.");
  const description = input.description?.trim() || null;

  return runGuarded(async (tx) => {
    const clash = await tx.role.findUnique({ where: { name }, select: { id: true } });
    if (clash) throw new ServiceRejection(`A role named "${name}" already exists.`);

    const slug = await uniqueSlug(tx, name);
    const role = await tx.role.create({
      data: { name, slug, description, isSystem: false },
      select: { id: true },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "role.created",
      entityType: "Role",
      entityId: role.id,
      summary: `Created role ${name}`,
      newValue: { name, description },
    });

    return { id: role.id };
  });
}

/**
 * Rename a role and/or change its description.
 *
 * The slug never changes here, even for a non-system role: it is an internal
 * identifier with no editable UI of its own, and leaving it alone means
 * nothing that referenced it by slug can break from a rename.
 */
export async function updateRole(
  actor: Actor,
  roleId: string,
  input: RoleInput,
): Promise<ServiceResult> {
  const name = input.name.trim();
  if (!name) return failure("Give the role a name.");
  const description = input.description?.trim() || null;

  return runGuarded(async (tx) => {
    const role = await tx.role.findUnique({
      where: { id: roleId },
      select: { name: true, description: true },
    });
    if (!role) throw new ServiceRejection("That role no longer exists.");

    if (name !== role.name) {
      const clash = await tx.role.findUnique({ where: { name }, select: { id: true } });
      if (clash) throw new ServiceRejection(`A role named "${name}" already exists.`);
    }

    await tx.role.update({ where: { id: roleId }, data: { name, description } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "role.updated",
      entityType: "Role",
      entityId: roleId,
      summary: name === role.name ? `Updated role ${name}` : `Renamed role ${role.name} to ${name}`,
      previousValue: { name: role.name, description: role.description },
      newValue: { name, description },
    });
  });
}

/** Copy a role's permissions into a new, independent role. */
export async function duplicateRole(
  actor: Actor,
  roleId: string,
  newName?: string,
): Promise<ServiceResult<{ id: string }>> {
  return runGuarded(async (tx) => {
    const source = await tx.role.findUnique({
      where: { id: roleId },
      select: {
        name: true,
        description: true,
        permissions: { select: { permissionId: true } },
      },
    });
    if (!source) throw new ServiceRejection("That role no longer exists.");

    const name = (newName?.trim() || `${source.name} copy`).slice(0, 80);
    const clash = await tx.role.findUnique({ where: { name }, select: { id: true } });
    if (clash) {
      throw new ServiceRejection(`A role named "${name}" already exists. Choose a different name.`);
    }

    const slug = await uniqueSlug(tx, name);
    const role = await tx.role.create({
      data: {
        name,
        slug,
        description: source.description,
        isSystem: false,
        permissions: {
          create: source.permissions.map((permission) => ({ permissionId: permission.permissionId })),
        },
      },
      select: { id: true },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "role.duplicated",
      entityType: "Role",
      entityId: role.id,
      summary: `Duplicated role ${source.name} as ${name}`,
      newValue: { name, sourceRoleId: roleId, permissionCount: source.permissions.length },
    });

    return { id: role.id };
  });
}

/**
 * Delete a non-system role.
 *
 * Refuses a role that is still assigned to anyone, rather than silently
 * stripping it from every holder: an administrator should see and choose that
 * consequence on the user/role pages first.
 */
export async function deleteRole(actor: Actor, roleId: string): Promise<ServiceResult> {
  return runGuarded(async (tx) => {
    const role = await tx.role.findUnique({
      where: { id: roleId },
      select: { name: true, isSystem: true, _count: { select: { users: true } } },
    });
    if (!role) throw new ServiceRejection("That role no longer exists.");
    if (role.isSystem) throw new ServiceRejection("System roles cannot be deleted.");
    if (role._count.users > 0) {
      throw new ServiceRejection(
        `${role.name} is still assigned to ${role._count.users} ` +
          `${role._count.users === 1 ? "user" : "users"}. Remove it from them first.`,
      );
    }

    await tx.role.delete({ where: { id: roleId } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "role.deleted",
      entityType: "Role",
      entityId: roleId,
      summary: `Deleted role ${role.name}`,
      previousValue: { name: role.name },
    });
  });
}

// ---------------------------------------------------------------------------
// User creation (specification Section 4) — invitation flow
// ---------------------------------------------------------------------------

export type CreateUserInput = {
  email: string;
  fullName: string;
  jobTitle?: string;
  roleIds: readonly string[];
};

/**
 * Create an application user and email a Supabase Auth invitation.
 *
 * Order mirrors scripts/create-user.ts, the supported CLI path this
 * complements:
 *
 *   1. create the Supabase Auth identity and send the invite;
 *   2. create the application profile and role assignments in one transaction.
 *
 * This never sets a password itself — the invited person sets their own via
 * the emailed link (src/app/(auth)/auth/reset-password) — so no administrator
 * ever has, or needs to hand over, another person's credential. Accepting the
 * invite is also the email-verification step (specification Section 14): a
 * profile with no accepted invite has no auth identity linkage usable for
 * sign-in.
 *
 * If the auth identity is created but the database step then fails, the
 * orphaned invite is removed rather than left dangling.
 */
export async function createUser(
  actor: Actor,
  input: CreateUserInput,
): Promise<ServiceResult<{ id: string }>> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!fullName) return failure("Give the user a name.");

  const existingProfile = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingProfile) return failure(`${email} is already a user.`);

  if (input.roleIds.length > 0) {
    const matchingRoles = await prisma.role.count({ where: { id: { in: [...input.roleIds] } } });
    if (matchingRoles !== input.roleIds.length) {
      return failure("One of the selected roles no longer exists.");
    }
  }

  let admin: SupabaseClient;
  try {
    admin = createSupabaseAdminClient();
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Supabase administrative access is not configured.",
    );
  }

  const invited = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${getAppUrl()}/auth/reset-password`,
  });

  if (!invited.data.user) {
    return failure(invited.error?.message ?? "Could not send the invitation.");
  }
  const authUserId = invited.data.user.id;

  const result = await runGuarded(async (tx) => {
    const profile = await tx.user.create({
      data: {
        email,
        fullName,
        jobTitle: input.jobTitle?.trim() || null,
        authUserId,
        isActive: true,
        createdById: actor.user.id,
      },
      select: { id: true },
    });

    for (const roleId of input.roleIds) {
      await tx.userRole.create({ data: { userId: profile.id, roleId, assignedById: actor.user.id } });
    }

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "user.created",
      entityType: "User",
      entityId: profile.id,
      summary: `Invited ${fullName} (${email})`,
      newValue: { email, fullName, roleIds: [...input.roleIds] },
    });

    return { id: profile.id };
  });

  if (!result.ok) {
    await admin.auth.admin.deleteUser(authUserId).catch(() => {});
  }

  return result;
}
