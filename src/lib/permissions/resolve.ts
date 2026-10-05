import { PERMISSION_KEYS } from "./catalog";

/**
 * Permission resolution.
 *
 * This module is intentionally PURE: no database, no request context, no
 * `server-only` import. All it does is turn "what is assigned" into "what is
 * effective", which makes the rules exhaustively unit-testable.
 *
 * Loading the assignments is src/lib/auth/session.ts's job.
 *
 * PRECEDENCE (specification Section 11, plus rule 0)
 * --------------------------------------------------
 *   0. Inactive user            -> deny everything          (source: INACTIVE)
 *   1. Direct DENY              -> deny                     (source: DIRECT_DENY)
 *   2. Direct ALLOW             -> allow                    (source: DIRECT_ALLOW)
 *   3. Any assigned role grants -> allow                    (source: ROLE)
 *   4. Otherwise                -> deny                     (source: NONE)
 *
 * Rule 0 is our addition. A deactivated user keeps their user_roles rows, so
 * without it deactivation would not actually revoke access. Deactivation must
 * fail closed.
 *
 * There is NO role-name special case. Super Admin is an ordinary role that has
 * been granted every permission; it is resolved by rule 3 like anything else.
 */

export type PermissionSource =
  | "DIRECT_DENY"
  | "DIRECT_ALLOW"
  | "ROLE"
  | "NONE"
  | "INACTIVE";

export type PermissionDecision = {
  readonly key: string;
  readonly granted: boolean;
  readonly source: PermissionSource;
  /** Names of the assigned roles that grant this key. Empty unless source is ROLE. */
  readonly viaRoles: readonly string[];
};

/** A permission granted to a user by one of their roles. */
export type RoleGrant = {
  readonly permissionKey: string;
  readonly roleName: string;
};

/** A permission attached directly to the user, overriding their roles. */
export type DirectGrant = {
  readonly permissionKey: string;
  readonly effect: "ALLOW" | "DENY";
};

export type PermissionResolutionInput = {
  readonly isActive: boolean;
  readonly roleGrants: readonly RoleGrant[];
  readonly directGrants: readonly DirectGrant[];
};

export type EffectivePermissions = {
  /** Keys the user effectively holds. */
  readonly granted: ReadonlySet<string>;
  /** True when the user holds `key`. */
  has(key: string): boolean;
  /** True when the user holds every listed key. */
  hasAll(keys: readonly string[]): boolean;
  /** True when the user holds at least one of the listed keys. */
  hasAny(keys: readonly string[]): boolean;
  /** Why a key resolved the way it did — powers the effective-access view. */
  explain(key: string): PermissionDecision;
  /**
   * A decision for every key that is either in the catalog or assigned to this
   * user, sorted by key. Used by the user access screen and by tests.
   */
  explainAll(): readonly PermissionDecision[];
};

const DENIED_INACTIVE = (key: string): PermissionDecision => ({
  key,
  granted: false,
  source: "INACTIVE",
  viaRoles: [],
});

export function resolvePermissions(input: PermissionResolutionInput): EffectivePermissions {
  const directEffect = new Map<string, "ALLOW" | "DENY">();
  for (const grant of input.directGrants) {
    // A (user, permission) pair is unique in the database, so a conflicting
    // pair cannot normally exist. If one ever did, DENY must win.
    const existing = directEffect.get(grant.permissionKey);
    if (existing === "DENY") continue;
    directEffect.set(grant.permissionKey, grant.effect);
  }

  const rolesByKey = new Map<string, string[]>();
  for (const grant of input.roleGrants) {
    const roles = rolesByKey.get(grant.permissionKey);
    if (roles) {
      if (!roles.includes(grant.roleName)) roles.push(grant.roleName);
    } else {
      rolesByKey.set(grant.permissionKey, [grant.roleName]);
    }
  }

  const decide = (key: string): PermissionDecision => {
    if (!input.isActive) return DENIED_INACTIVE(key);

    const direct = directEffect.get(key);
    if (direct === "DENY") {
      return { key, granted: false, source: "DIRECT_DENY", viaRoles: [] };
    }
    if (direct === "ALLOW") {
      return { key, granted: true, source: "DIRECT_ALLOW", viaRoles: [] };
    }

    const viaRoles = rolesByKey.get(key);
    if (viaRoles && viaRoles.length > 0) {
      return { key, granted: true, source: "ROLE", viaRoles: [...viaRoles].sort() };
    }

    return { key, granted: false, source: "NONE", viaRoles: [] };
  };

  const granted = new Set<string>();
  if (input.isActive) {
    for (const key of rolesByKey.keys()) {
      if (decide(key).granted) granted.add(key);
    }
    for (const key of directEffect.keys()) {
      if (decide(key).granted) granted.add(key);
    }
  }

  return {
    granted,
    has: (key) => granted.has(key),
    hasAll: (keys) => keys.every((key) => granted.has(key)),
    hasAny: (keys) => keys.some((key) => granted.has(key)),
    explain: decide,
    explainAll: () => {
      const keys = new Set<string>([
        ...PERMISSION_KEYS,
        ...rolesByKey.keys(),
        ...directEffect.keys(),
      ]);
      return [...keys].sort().map(decide);
    },
  };
}

/** An empty, deny-everything permission set. Used for unauthenticated callers. */
export function noPermissions(): EffectivePermissions {
  return resolvePermissions({ isActive: false, roleGrants: [], directGrants: [] });
}
