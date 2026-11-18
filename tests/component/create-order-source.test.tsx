import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateOrderForm } from "@/app/(app)/orders/new/create-order-form";

/** New order: Fiverr is the default source (2026-11-18). */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/orders/actions", () => ({ addOrderItemAction: vi.fn(), assignOrderItemWorkerAction: vi.fn(), createOrderAction: vi.fn() }));
vi.mock("@/lib/customers/actions", () => ({}));
vi.mock("@/lib/youtube/actions", () => ({}));

const A = { id: "11111111-1111-4111-8111-111111111111", name: "growxeno_main" };
const B = { id: "22222222-2222-4222-8222-222222222222", name: "growxeno_two" };

describe("CreateOrderForm source", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts on Fiverr with the only account chosen", () => {
    render(<CreateOrderForm fiverrAccounts={[A]} services={[]} canCreateCustomer={false} />);
    expect(screen.getByRole("radio", { name: "Fiverr" })).toBeChecked();
    expect(screen.getByLabelText("Fiverr account")).toHaveValue(A.id);
  });

  it("remembers the account used last when there are several", () => {
    window.localStorage.setItem("gx:new-order:fiverr-account", B.id);
    render(<CreateOrderForm fiverrAccounts={[A, B]} services={[]} canCreateCustomer={false} />);
    expect(screen.getByLabelText("Fiverr account")).toHaveValue(B.id);
  });

  it("starts on External while no Fiverr account exists", () => {
    render(<CreateOrderForm fiverrAccounts={[]} services={[]} canCreateCustomer={false} />);
    expect(screen.getByRole("radio", { name: "External" })).toBeChecked();
  });
});
