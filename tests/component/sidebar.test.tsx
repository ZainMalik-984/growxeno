import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "@/components/layout/sidebar";
import { getNavigationFor } from "@/lib/navigation/nav-tree";
import { resolvePermissions } from "@/lib/permissions/resolve";

const pathname = vi.hoisted(() => ({ current: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

const withPermissions = (keys: string[]) =>
  resolvePermissions({
    isActive: true,
    roleGrants: keys.map((permissionKey) => ({ permissionKey, roleName: "Test" })),
    directGrants: [],
  });

describe("Sidebar", () => {
  beforeEach(() => {
    pathname.current = "/dashboard";
    window.localStorage.clear();
  });

  it("renders only the sections the actor is authorised for", () => {
    render(<Sidebar sections={getNavigationFor(withPermissions(["users.view"]))} />);

    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Roles" })).not.toBeInTheDocument();
    expect(screen.queryByText("Finance")).not.toBeInTheDocument();
  });

  it("marks the current route with aria-current", () => {
    render(<Sidebar sections={getNavigationFor(withPermissions([]))} />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not mark a sibling route as current", () => {
    pathname.current = "/settings/roles";
    render(<Sidebar sections={getNavigationFor(withPermissions(["users.view", "roles.view"]))} />);

    expect(screen.getByRole("link", { name: "Users" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Roles" })).toHaveAttribute("aria-current", "page");
  });

  it("collapses and expands a nested group, and reports state to assistive tech", async () => {
    const user = userEvent.setup();
    const sections = getNavigationFor(
      withPermissions(["finance.view", "finance.revenue.view"]),
      { includeUnimplemented: true },
    );

    render(<Sidebar sections={sections} />);

    const toggle = screen.getByRole("button", { name: /finance/i });
    // Closed by default: the current route is /dashboard, not inside Finance.
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Revenue" })).toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the group containing the current page by default", () => {
    pathname.current = "/finance/revenue";
    const sections = getNavigationFor(
      withPermissions(["finance.view", "finance.revenue.view"]),
      { includeUnimplemented: true },
    );

    render(<Sidebar sections={sections} />);

    expect(screen.getByRole("button", { name: /finance/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("exposes the navigation as a labelled landmark", () => {
    render(<Sidebar sections={getNavigationFor(withPermissions([]))} />);

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });
});
