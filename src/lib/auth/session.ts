import "server-only";

import { cache } from "react";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";
import { resolvePermissions, type EffectivePermissions } from "@/lib/permissions/resolve";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Who is making this request, and what may they do.
 *
 * Identity comes from the verified Supabase session — never from a submitted
 * user id, a header, or a form field. Permissions are resolved from the
 * database on every request.
 */

export type ActorProfile = {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly isActive: boolean;
  readonly roleNames: readonly string[];
};

export type Actor = {
  readonly user: ActorProfile;
  readonly permissions: EffectivePermissions;
};

/**
 * The signed-in actor, or null.
 *
 * Memoised per request with React `cache()`: several Server Components and the
 * navigation tree all need it, and re-resolving would mean repeating the same
 * query. The memo lives for one request only — permission changes take effect
 * on the next request, with no cross-request cache to invalidate.
 */
/**
 * One row of the combined role-name / role-grant / direct-grant query below.
 * `kind` says which of the three UNIONed branches a row came from; the other
 * columns are `null` except the ones that branch actually populates.
 */
type GrantRow = {
  kind: "ROLE_NAME" | "ROLE_GRANT" | "DIRECT_GRANT";
  roleName: string | null;
  permissionKey: string | null;
  effect: "ALLOW" | "DENY" | null;
};

export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  if (!isSupabaseConfigured() || !isDatabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  /**
   * WHY THIS IS A RAW QUERY, AND WHY IT IS COMBINED WITH `Promise.all` BELOW
   * (diagnosed 2026-09-28: every page navigation felt like 2-5 seconds).
   *
   * The obvious way to write this is one `prisma.user.findUnique` with
   * `roles.role.permissions.permission` and `directPermissions.permission`
   * nested in its `select`. That is what this function used to do, and it
   * is correct — but Prisma's driver-adapter query engine does not compile
   * a deeply nested `select` into one SQL join; it issues one additional
   * round trip PER RELATION LEVEL, sequentially, batching parent ids at each
   * level. Measured here: that one call was actually SEVEN sequential
   * queries (user → direct permission ids → their keys → role ids → role
   * rows → role_permission ids → their keys), and this function runs on
   * every single navigation, in every layout and page that calls
   * `requireActor`/`requirePermission`. At roughly 150ms per round trip to
   * this project's region (`ap-northeast-2`, see src/lib/db/prisma.ts), that
   * chain alone was ~1 second of dead time before a page even started
   * fetching its own data.
   *
   * A hand-written join collapses the whole role-name / role-grant /
   * direct-grant fetch into ONE round trip, and it runs in `Promise.all`
   * with the (separate, flat, non-nested) profile lookup — both are
   * filterable by `authUser.id` directly, so neither has to wait for the
   * other's result. Net: 7 sequential round trips down to 1.
   *
   * Kept as three UNIONed branches rather than one, because they answer
   * three genuinely different questions and collapsing them would silently
   * change behavior: `ROLE_NAME` lists every role the user is assigned to,
   * even one with zero permissions yet (so `roleNames` cannot be derived
   * from `ROLE_GRANT` alone — a role with no permissions would vanish from
   * it); `ROLE_GRANT` is the (permission, role) pairing `viaRoles` needs;
   * `DIRECT_GRANT` carries the ALLOW/DENY override precedence resolves.
   */
  const grantsQuery = prisma.$queryRaw<GrantRow[]>(Prisma.sql`
    WITH me AS (SELECT id FROM users WHERE auth_user_id = ${authUser.id})
    SELECT 'ROLE_NAME'::text AS kind, r.name AS "roleName", NULL::text AS "permissionKey", NULL::text AS effect
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = (SELECT id FROM me)

    UNION ALL

    SELECT 'ROLE_GRANT'::text, r.name, p.key, NULL::text
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = (SELECT id FROM me)

    UNION ALL

    SELECT 'DIRECT_GRANT'::text, NULL::text, p.key, up.effect::text
    FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE up.user_id = (SELECT id FROM me)
  `);

  const [profile, grantRows] = await Promise.all([
    prisma.user.findUnique({
      where: { authUserId: authUser.id },
      select: { id: true, email: true, fullName: true, displayName: true, avatarUrl: true, isActive: true },
    }),
    grantsQuery,
  ]);

  // An auth identity with no application profile has no access. This is the
  // correct outcome: users are created deliberately inside the application
  // (specification Section 4), so a stray Supabase signup grants nothing.
  // (grantRows was fetched for nothing in this case — a harmless wasted
  // query run in parallel, cheaper than making the common case wait on it.)
  if (!profile) return null;

  const roleNames = [
    ...new Set(grantRows.filter((g) => g.kind === "ROLE_NAME").map((g) => g.roleName!)),
  ].sort();

  const roleGrants = grantRows
    .filter((g) => g.kind === "ROLE_GRANT")
    .map((g) => ({ permissionKey: g.permissionKey!, roleName: g.roleName! }));

  const directGrants = grantRows
    .filter((g) => g.kind === "DIRECT_GRANT")
    .map((g) => ({ permissionKey: g.permissionKey!, effect: g.effect! }));

  return {
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      isActive: profile.isActive,
      roleNames,
    },
    permissions: resolvePermissions({
      isActive: profile.isActive,
      roleGrants,
      directGrants,
    }),
  };
});
