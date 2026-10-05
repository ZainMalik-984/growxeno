import { describe, expect, it } from "vitest";

import {
  getNavigationFor,
  isNavNodeActive,
  NAVIGATION,
  type NavNode,
} from "@/lib/navigation/nav-tree";
import { isKnownPermissionKey } from "@/lib/permissions/catalog";
import { noPermissions, resolvePermissions } from "@/lib/permissions/resolve";

const withPermissions = (keys: string[]) =>
  resolvePermissions({
    isActive: true,
    roleGrants: keys.map((permissionKey) => ({ permissionKey, roleName: "Test" })),
    directGrants: [],
  });

function flatten(nodes: readonly NavNode[]): NavNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);
}

describe("navigation tree integrity", () => {
  it("every permission referenced by navigation exists in the catalog", () => {
    // Catches the classic typo where a nav node guards on a key that will never
    // resolve, silently hiding a module from everyone.
    const unknown = NAVIGATION.flatMap((section) => flatten(section.items))
      .map((node) => node.permission)
      .filter((permission): permission is string => Boolean(permission))
      .filter((permission) => !isKnownPermissionKey(permission));

    expect(unknown).toEqual([]);
  });
});

describe("getNavigationFor", () => {
  it("shows nothing to a user with no permissions except the always-visible items", () => {
    const sections = getNavigationFor(noPermissions());
    const labels = sections.flatMap((section) => section.items.map((item) => item.label));

    // Dashboard carries no permission requirement; everything guarded is gone.
    expect(labels).toContain("Dashboard");
    expect(labels).not.toContain("Users");
    expect(labels).not.toContain("Roles");
  });

  it("reveals a section once the actor holds its permission", () => {
    const sections = getNavigationFor(withPermissions(["users.view"]));
    const system = sections.find((section) => section.label === "System");

    expect(system?.items.map((item) => item.label)).toEqual(["Users"]);
  });

  it("drops sections that end up empty rather than leaving a bare heading", () => {
    const sections = getNavigationFor(noPermissions());
    expect(sections.every((section) => section.items.length > 0)).toBe(true);
    expect(sections.map((section) => section.label)).not.toContain("CRM");
  });

  it("hides a parent whose children are all unauthorised", () => {
    // finance.view alone authorises the Finance parent, but every child needs
    // its own key, so the group must not render as an empty expander.
    const sections = getNavigationFor(withPermissions(["finance.view"]), {
      includeUnimplemented: true,
    });
    const finance = sections.find((section) => section.label === "Finance");

    expect(finance?.items[0]?.children?.map((child) => child.label)).toEqual(["Overview"]);
  });

  it("keeps authorised children and drops unauthorised siblings", () => {
    const sections = getNavigationFor(
      withPermissions(["finance.view", "finance.revenue.view", "finance.profit.view"]),
      { includeUnimplemented: true },
    );
    const children = sections
      .find((section) => section.label === "Finance")
      ?.items[0]?.children?.map((child) => child.label);

    expect(children).toEqual(["Overview", "Revenue", "Profit"]);
  });

  it("hides routes that do not exist yet unless explicitly included", () => {
    // Email/WhatsApp compose tools are the one part of the tree still unbuilt
    // (no provider or queue exists — docs/NOTIFICATIONS.md §7); Reports (Phase 9)
    // and Finance now are. This exercises the general "implemented" gate, not
    // any one section. A user holding only `email.send` sees no Communication
    // section by default (its only permitted child does not exist) but does
    // with `includeUnimplemented`.
    const permissions = withPermissions(["communications.view", "email.send"]);

    expect(getNavigationFor(permissions).some((section) => section.label === "Communication")).toBe(false);
    expect(
      getNavigationFor(permissions, { includeUnimplemented: true }).some(
        (section) => section.label === "Communication",
      ),
    ).toBe(true);
  });

  it("gives a Super Admin the whole implemented tree", () => {
    const everything = withPermissions(
      NAVIGATION.flatMap((section) => flatten(section.items))
        .map((node) => node.permission)
        .filter((permission): permission is string => Boolean(permission)),
    );

    const labels = getNavigationFor(everything).flatMap((section) =>
      section.items.map((item) => item.label),
    );

    expect(labels).toEqual(expect.arrayContaining(["Dashboard", "Users", "Roles", "Permissions"]));
  });
});

describe("isNavNodeActive", () => {
  const node = (href: string, exact = false): NavNode => ({
    label: "x",
    href,
    implemented: true,
    exact,
  });

  it("matches by prefix for section roots", () => {
    expect(isNavNodeActive(node("/settings/users"), "/settings/users")).toBe(true);
    expect(isNavNodeActive(node("/settings/users"), "/settings/users/abc")).toBe(true);
    expect(isNavNodeActive(node("/settings/users"), "/settings/roles")).toBe(false);
  });

  it("respects exact matching for index routes", () => {
    expect(isNavNodeActive(node("/dashboard", true), "/dashboard")).toBe(true);
    expect(isNavNodeActive(node("/dashboard", true), "/dashboard/other")).toBe(false);
  });

  it("ignores the query string when matching", () => {
    expect(isNavNodeActive(node("/orders?status=PENDING"), "/orders")).toBe(true);
  });
});
