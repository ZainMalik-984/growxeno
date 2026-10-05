import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getPermissionDefinition } from "@/lib/permissions/catalog";
import { resolvePermissions, type PermissionDecision } from "@/lib/permissions/resolve";

/**
 * Read queries for the access-control module.
 *
 * Every query selects explicit columns and bounds its result set. These are
 * pure data access — authorization happens in the caller, before we get here.
 */

export const USERS_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type UserListRow = {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  isActive: boolean;
  hasSignIn: boolean;
  roleNames: string[];
  directOverrideCount: number;
};

export type UserListResult = {
  rows: UserListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

/**
 * Paginated user list.
 *
 * Offset pagination: this list is operator-facing, stable page numbers are
 * worth more here than cursor efficiency, and the row count is small. Sorting
 * always ends with `id` so pages never overlap or skip on ties.
 */
export async function listUsers(options: {
  page?: number;
  pageSize?: number;
  search?: string;
  includeInactive?: boolean;
}): Promise<UserListResult> {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(options.pageSize ?? USERS_PAGE_SIZE)));
  const search = options.search?.trim();

  const where = {
    ...(options.includeInactive ? {} : { isActive: true }),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  // One count + one page query. The role names come back in the same round
  // trip via a nested select rather than a query per row (no N+1).
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        jobTitle: true,
        isActive: true,
        authUserId: true,
        roles: { select: { role: { select: { name: true } } } },
        _count: { select: { directPermissions: true } },
      },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    rows: users.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      jobTitle: user.jobTitle,
      isActive: user.isActive,
      hasSignIn: user.authUserId !== null,
      roleNames: user.roles.map((assignment) => assignment.role.name).sort(),
      directOverrideCount: user._count.directPermissions,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type UserAccessDetail = {
  id: string;
  fullName: string;
  displayName: string | null;
  email: string;
  jobTitle: string | null;
  phone: string | null;
  isActive: boolean;
  hasSignIn: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  roles: Array<{ id: string; name: string; slug: string }>;
  /** Effective decision for every catalog key, plus anything assigned. */
  decisions: readonly PermissionDecision[];
  grantedCount: number;
  directAllowCount: number;
  directDenyCount: number;
};

/**
 * Everything the effective-access view needs (specification Section 12):
 * assigned roles, role-inherited permissions, direct grants, direct denies,
 * the final effective set, and the source of each decision.
 */
export async function getUserAccessDetail(userId: string): Promise<UserAccessDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      displayName: true,
      email: true,
      jobTitle: true,
      phone: true,
      isActive: true,
      authUserId: true,
      createdAt: true,
      lastLoginAt: true,
      roles: {
        select: {
          role: {
            select: {
              id: true,
              name: true,
              slug: true,
              permissions: { select: { permission: { select: { key: true } } } },
            },
          },
        },
      },
      directPermissions: {
        select: { effect: true, permission: { select: { key: true } } },
      },
    },
  });

  if (!user) return null;

  const permissions = resolvePermissions({
    isActive: user.isActive,
    roleGrants: user.roles.flatMap((assignment) =>
      assignment.role.permissions.map((rp) => ({
        permissionKey: rp.permission.key,
        roleName: assignment.role.name,
      })),
    ),
    directGrants: user.directPermissions.map((dp) => ({
      permissionKey: dp.permission.key,
      effect: dp.effect,
    })),
  });

  const decisions = permissions.explainAll();

  return {
    id: user.id,
    fullName: user.fullName,
    displayName: user.displayName,
    email: user.email,
    jobTitle: user.jobTitle,
    phone: user.phone,
    isActive: user.isActive,
    hasSignIn: user.authUserId !== null,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    roles: user.roles
      .map((assignment) => assignment.role)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((role) => ({ id: role.id, name: role.name, slug: role.slug })),
    decisions,
    grantedCount: decisions.filter((decision) => decision.granted).length,
    directAllowCount: user.directPermissions.filter((dp) => dp.effect === "ALLOW").length,
    directDenyCount: user.directPermissions.filter((dp) => dp.effect === "DENY").length,
  };
}

export type RoleListRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
  userCount: number;
};

export async function listRoles(): Promise<RoleListRow[]> {
  const roles = await prisma.role.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      isSystem: true,
      _count: { select: { permissions: true, users: true } },
    },
    orderBy: [{ name: "asc" }],
  });

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    slug: role.slug,
    description: role.description,
    isSystem: role.isSystem,
    permissionCount: role._count.permissions,
    userCount: role._count.users,
  }));
}

export type RoleDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  permissionKeys: Set<string>;
  users: Array<{ id: string; fullName: string; email: string; isActive: boolean }>;
};

export async function getRoleDetail(roleId: string): Promise<RoleDetail | null> {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      isSystem: true,
      permissions: { select: { permission: { select: { key: true } } } },
      users: {
        select: {
          user: { select: { id: true, fullName: true, email: true, isActive: true } },
        },
        orderBy: { user: { fullName: "asc" } },
      },
    },
  });

  if (!role) return null;

  return {
    id: role.id,
    name: role.name,
    slug: role.slug,
    description: role.description,
    isSystem: role.isSystem,
    permissionKeys: new Set(role.permissions.map((rp) => rp.permission.key)),
    users: role.users.map((assignment) => assignment.user),
  };
}

/** All roles, for the role-assignment control on a user page. */
export async function listAssignableRoles(): Promise<Array<{ id: string; name: string }>> {
  return prisma.role.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** The permission catalog as stored in the database, joined to its definition. */
export async function listStoredPermissions(): Promise<
  Array<{ id: string; key: string; name: string; module: string; description: string | null; roleCount: number }>
> {
  const permissions = await prisma.permission.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      module: true,
      description: true,
      _count: { select: { roles: true } },
    },
    orderBy: [{ module: "asc" }, { key: "asc" }],
  });

  return permissions.map((permission) => ({
    id: permission.id,
    key: permission.key,
    name: permission.name,
    module: permission.module,
    description: permission.description ?? getPermissionDefinition(permission.key)?.description ?? null,
    roleCount: permission._count.roles,
  }));
}

/** Small aggregate counts for the dashboard. Counts, not row fetches. */
export async function getAccessCounts(): Promise<{
  activeUsers: number;
  inactiveUsers: number;
  roles: number;
  permissions: number;
  directOverrides: number;
}> {
  const [activeUsers, inactiveUsers, roles, permissions, directOverrides] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.role.count(),
    prisma.permission.count(),
    prisma.userPermission.count(),
  ]);

  return { activeUsers, inactiveUsers, roles, permissions, directOverrides };
}
