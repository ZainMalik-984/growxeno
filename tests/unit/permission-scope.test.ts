import { describe, expect, it } from "vitest";

import { resolvePermissions } from "@/lib/permissions/resolve";
import { resolveScope, scopeKeyFor } from "@/lib/permissions/scope";

/**
 * Scope is a separate axis from permission. These tests pin the rule that a
 * Worker holding `orders.view` sees their assigned work only — the requirement
 * that "a permission alone must not expose all records".
 */

describe("resolveScope", () => {
  const build = (keys: string[]) =>
    resolvePermissions({
      isActive: true,
      roleGrants: keys.map((permissionKey) => ({ permissionKey, roleName: "Test" })),
      directGrants: [],
    });

  it("returns NONE when the action itself is not held", () => {
    expect(resolveScope(build([]), "orders.view")).toBe("NONE");
  });

  it("returns ASSIGNED for the bare action permission", () => {
    expect(resolveScope(build(["orders.view"]), "orders.view")).toBe("ASSIGNED");
  });

  it("returns ALL only when the companion .all key is held", () => {
    expect(resolveScope(build(["orders.view", "orders.view.all"]), "orders.view")).toBe("ALL");
  });

  it("does not widen scope from the .all key alone", () => {
    // Holding only the scope key without the action must not grant access.
    expect(resolveScope(build(["orders.view.all"]), "orders.view")).toBe("NONE");
  });

  it("a direct DENY on the scope key narrows an otherwise-global role", () => {
    const permissions = resolvePermissions({
      isActive: true,
      roleGrants: [
        { permissionKey: "orders.view", roleName: "Admin" },
        { permissionKey: "orders.view.all", roleName: "Admin" },
      ],
      directGrants: [{ permissionKey: "orders.view.all", effect: "DENY" }],
    });

    expect(resolveScope(permissions, "orders.view")).toBe("ASSIGNED");
  });

  it("builds the companion key by convention", () => {
    expect(scopeKeyFor("daily_stats.view")).toBe("daily_stats.view.all");
  });
});
