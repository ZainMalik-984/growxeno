import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddWorkerButton } from "@/app/(app)/outsourced-workers/add-worker-dialog";

/** "New worker" as a popup on the Outsourced Workers list (2026-11-18). */

const create = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/outsourced-workers",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/outsourced-workers/actions", () => ({ createOutsourcedWorkerAction: create }));

HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};

describe("AddWorkerButton", () => {
  beforeEach(() => {
    create.mockReset().mockResolvedValue({ ok: true, message: "Worker added.", workerId: "w1" });
    push.mockReset();
  });

  it("opens the popup and adds a worker with how tasks reach them", async () => {
    const user = userEvent.setup();
    render(<AddWorkerButton />);
    await user.click(screen.getByRole("button", { name: "New worker" }));
    expect(screen.getByRole("heading", { name: "New outsourced worker" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Name", { exact: true }), "Inzmam");
    await user.type(screen.getByLabelText(/^Phone/), "+92 300 1234567");
    await user.click(screen.getByLabelText("Same as phone"));
    expect(screen.getByLabelText(/^WhatsApp number/)).toHaveValue("+92 300 1234567");
    await user.click(screen.getByRole("radio", { name: "WhatsApp only" }));
    await user.click(screen.getByRole("button", { name: "Add worker" }));

    expect(create).toHaveBeenCalledWith({ name: "Inzmam", email: undefined, phone: "+92 300 1234567", whatsappNumber: "+92 300 1234567", notes: undefined, notifyVia: "WHATSAPP" });
    expect(push).toHaveBeenCalledWith("/outsourced-workers/w1");
  });

  it("warns when the chosen channel has no contact, and opens itself from /new", async () => {
    const user = userEvent.setup();
    render(<AddWorkerButton openOnLoad />);
    expect(screen.getByRole("heading", { name: "New outsourced worker" })).toBeInTheDocument();
    // No warning on an empty form; "Both" is the default, so a name with no email or number gets one.
    expect(screen.queryByText(/Add an email and a WhatsApp number/)).toBeNull();
    await user.type(screen.getByLabelText("Name", { exact: true }), "Inzmam");
    expect(screen.getByText(/Add an email and a WhatsApp number/)).toBeInTheDocument();
  });
});
