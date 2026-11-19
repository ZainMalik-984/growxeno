import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileForms } from "@/app/(app)/profile/profile-forms";

/** Profile page (2026-11-19): change password, worker payment details. */

const changePassword = vi.hoisted(() => vi.fn());
const savePayment = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/profile/actions", () => ({ changePasswordAction: changePassword, savePaymentDetailsAction: savePayment }));

const base = { name: "Zia Ali", email: "zia@example.com", roles: ["Outsourced Worker"] };

describe("ProfileForms", () => {
  beforeEach(() => {
    changePassword.mockReset().mockResolvedValue({ ok: true, message: "Password changed." });
    savePayment.mockReset().mockResolvedValue({ ok: true, message: "Payment details saved." });
  });

  it("shows payment details only for workers", () => {
    const { rerender } = render(<ProfileForms {...base} paymentDetails={null} />);
    expect(screen.queryByLabelText("Payment details")).toBeNull();
    rerender(<ProfileForms {...base} paymentDetails="JazzCash 0300" />);
    expect(screen.getByLabelText("Payment details")).toHaveValue("JazzCash 0300");
  });

  it("saves payment details", async () => {
    render(<ProfileForms {...base} paymentDetails="" />);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Payment details"), "Easypaisa 0311 Zia");
    await userEvent.click(save);
    expect(savePayment).toHaveBeenCalledWith({ paymentDetails: "Easypaisa 0311 Zia" });
  });

  it("changes the password and clears the fields", async () => {
    render(<ProfileForms {...base} paymentDetails={null} />);
    await userEvent.type(screen.getByLabelText("Current password"), "old-password-1");
    await userEvent.type(screen.getByLabelText("New password"), "new-password-12");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "new-password-12");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(changePassword).toHaveBeenCalledWith({ currentPassword: "old-password-1", password: "new-password-12", confirmPassword: "new-password-12" });
    expect(screen.getByLabelText("Current password")).toHaveValue("");
  });

  it("shows a wrong current password against that field", async () => {
    changePassword.mockResolvedValue({ ok: false, error: "That's not your current password.", field: "currentPassword" });
    render(<ProfileForms {...base} paymentDetails={null} />);
    await userEvent.type(screen.getByLabelText("Current password"), "nope");
    await userEvent.type(screen.getByLabelText("New password"), "new-password-12");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "new-password-12");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That's not your current password.");
    expect(screen.getByLabelText("Current password")).toHaveAttribute("aria-invalid", "true");
  });
});
