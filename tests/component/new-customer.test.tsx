import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/customers",
  useSearchParams: () => new URLSearchParams("new=1"),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const create = vi.fn(async (input: unknown) => ({ ok: true as const, message: "Customer created.", customerId: "c-1", input }));
vi.mock("@/lib/customers/actions", () => ({ createCustomerAction: (input: unknown) => create(input) }));

const { NewCustomerButton } = await import("@/app/(app)/customers/new-customer-button");

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

describe("New customer popup", () => {
  it("creates a customer from the popup and opens their page", async () => {
    const user = userEvent.setup();
    render(<NewCustomerButton />);
    await user.click(screen.getByRole("button", { name: "New customer" }));
    const dialog = within(screen.getByRole("dialog", { hidden: true }));
    await user.type(dialog.getByLabelText("Name"), "Cpiplo");
    await user.type(dialog.getByLabelText("WhatsApp"), "+92 300 1234567");
    await user.click(dialog.getByRole("radio", { name: "Company", hidden: true }));
    await user.click(dialog.getByRole("button", { name: "Create customer", hidden: true }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: "Cpiplo", type: "COMPANY", whatsappNumber: "+92 300 1234567" }));
    expect(push).toHaveBeenCalledWith("/customers/c-1");
  });

  it("opens straight away from /customers/new and drops ?new=1 on close", async () => {
    const user = userEvent.setup();
    render(<NewCustomerButton defaultOpen />);
    const dialog = within(screen.getByRole("dialog", { hidden: true }));
    await user.click(dialog.getByRole("button", { name: "Cancel", hidden: true }));
    expect(replace).toHaveBeenCalledWith("/customers", { scroll: false });
  });
});
