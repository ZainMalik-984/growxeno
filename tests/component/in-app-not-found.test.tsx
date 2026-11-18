import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InAppNotFound } from "@/app/(app)/in-app-not-found";

/** "Not found" inside the app (2026-11-18): names the record and links back to its list. */

let pathname = "/orders/a5c12528-1f34-4adf-a620-45add0efcbaa";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

describe("InAppNotFound", () => {
  it("names the missing record and links back to its list", () => {
    render(<InAppNotFound />);
    expect(screen.getByRole("heading", { name: "This order doesn't exist" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to orders/ })).toHaveAttribute("href", "/orders");
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByText(/Back to website/)).toBeNull();
  });

  it("falls back to a plain message elsewhere", () => {
    pathname = "/somewhere/else";
    render(<InAppNotFound />);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Back to/ })).toBeNull();
  });
});
