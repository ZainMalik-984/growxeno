import { describe, expect, it } from "vitest";

import { noPermissions, resolvePermissions } from "@/lib/permissions/resolve";

/**
 * Permission precedence is the single most security-critical rule in the
 * application, so it is tested exhaustively — including the combinations that
 * are easy to get wrong (a deny that must beat two roles, an inactive user who
 * still holds a direct allow).
 */

const role = (permissionKey: string, roleName = "Worker") => ({ permissionKey, roleName });
const direct = (permissionKey: string, effect: "ALLOW" | "DENY") => ({ permissionKey, effect });

describe("resolvePermissions — precedence", () => {
  it("grants a permission carried by an assigned role", () => {
    const permissions = resolvePermissions({
      isActive: true,
      roleGrants: [role("orders.view")],
      directGrants: [],
    });

    expect(permissions.has("orders.view")).toBe(true);
    expect(permissions.explain("orders.view")).toMatchObject({
      granted: true,
      source: "ROLE",
      viaRoles: ["Worker"],
    });
  });

  it("denies a permission nobody granted", () => {
    const permissions = resolvePermissions({ isActive: true, roleGrants: [], directGrants: [] });

    expect(permissions.has("finance.view")).toBe(false);
    expect(permissions.explain("finance.view")).toMatchObject({ granted: false, source: "NONE" });
  });

  it("grants a direct ALLOW the roles do not carry (specification Section 9)", () => {
    const permissions = resolvePermissions({
      isActive: true,
      roleGrants: [role("orders.view")],
      directGrants: [direct("orders.assign", "ALLOW")],
    });

    expect(permissions.has("orders.assign")).toBe(true);
    expect(permissions.explain("orders.assign")).toMatchObject({
      granted: true,
      source: "DIRECT_ALLOW",
    });
  });

  it("direct DENY beats a role grant (specification Section 10)", () => {
    const permissions = resolvePermissions({
      isActive: true,
      roleGrants: [role("finance.view", "Admin")],
      directGrants: [direct("finance.view", "DENY")],
    });

    expect(permissions.has("finance.view")).toBe(false);
    expect(permissions.explain("finance.view")).toMatchObject({
      granted: false,
      source: "DIRECT_DENY",
    });
  });

  it("direct DENY beats grants from several roles at once", () => {
    const permissions = resolvePermissions({
      isActive: true,
      roleGrants: [
        role("finance.view", "Admin"),
        role("finance.view", "Finance Manager"),
        role("finance.view", "Super Admin"),
      ],
      directGrants: [direct("finance.view", "DENY")],
    });

    expect(permissions.has("finance.view")).toBe(false);
  });

  it("resolves DENY over ALLOW if both were somehow present for one key", () => {
    // The database makes this impossible (composite primary key), but the
    // resolver must not depend on that to stay safe.
    const permissions = resolvePermissions({
      isActive: true,
      roleGrants: [],
      directGrants: [direct("users.delete", "ALLOW"), direct("users.delete", "DENY")],
    });

    expect(permissions.has("users.delete")).toBe(false);
    expect(permissions.explain("users.delete").source).toBe("DIRECT_DENY");
  });
});

describe("resolvePermissions — multiple roles", () => {
  it("unions the permissions of every assigned role (specification Section 6)", () => {
    const permissions = resolvePermissions({
      isActive: true,
      roleGrants: [
        role("orders.view", "Senior Worker"),
        role("orders.edit", "Senior Worker"),
        role("orders.change_status", "Reviewer"),
        role("orders.activity.view", "Reviewer"),
      ],
      directGrants: [],
    });

    expect(permissions.hasAll(["orders.view", "orders.edit", "orders.change_status", "orders.activity.view"])).toBe(true);
    expect(permissions.granted.size).toBe(4);
  });

  it("reports every role that contributes a permission", () => {
    const permissions = resolvePermissions({
      isActive: true,
      roleGrants: [role("orders.view", "Reviewer"), role("orders.view", "Senior Worker")],
      directGrants: [],
    });

    expect(permissions.explain("orders.view").viaRoles).toEqual(["Reviewer", "Senior Worker"]);
  });
});

describe("resolvePermissions — deactivated users", () => {
  it("denies everything, including direct ALLOW grants", () => {
    const permissions = resolvePermissions({
      isActive: false,
      roleGrants: [role("orders.view", "Super Admin")],
      directGrants: [direct("finance.view", "ALLOW")],
    });

    expect(permissions.granted.size).toBe(0);
    expect(permissions.has("orders.view")).toBe(false);
    expect(permissions.has("finance.view")).toBe(false);
    expect(permissions.explain("orders.view").source).toBe("INACTIVE");
  });

  it("noPermissions() denies everything", () => {
    expect(noPermissions().granted.size).toBe(0);
    expect(noPermissions().has("orders.view")).toBe(false);
  });
});

describe("resolvePermissions — helpers", () => {
  it("hasAll requires every key and hasAny requires one", () => {
    const permissions = resolvePermissions({
      isActive: true,
      roleGrants: [role("orders.view"), role("orders.edit")],
      directGrants: [],
    });

    expect(permissions.hasAll(["orders.view", "orders.edit"])).toBe(true);
    expect(permissions.hasAll(["orders.view", "orders.delete"])).toBe(false);
    expect(permissions.hasAny(["orders.delete", "orders.view"])).toBe(true);
    expect(permissions.hasAny(["orders.delete"])).toBe(false);
  });

  it("explainAll covers the whole catalog so the access view has no gaps", () => {
    const permissions = resolvePermissions({
      isActive: true,
      roleGrants: [role("orders.view")],
      directGrants: [],
    });

    const decisions = permissions.explainAll();
    const keys = decisions.map((decision) => decision.key);

    expect(keys).toContain("orders.view");
    expect(keys).toContain("finance.view");
    // Sorted, so the UI ordering is deterministic.
    expect([...keys]).toEqual([...keys].sort());
  });
});
