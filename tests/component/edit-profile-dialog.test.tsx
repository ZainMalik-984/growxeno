import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditProfileButton, type EditableEmployee } from "@/app/(app)/employees/[id]/edit-profile-dialog";

const save = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/access/actions", () => ({ updateEmployeeProfileAction: save }));

// jsdom has no <dialog> modal API.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};

const EMPLOYEE: EditableEmployee = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Ayesha Khan",
  displayName: null,
  email: "ayesha@example.com",
  jobTitle: "Account manager",
  phone: null,
  whatsappNumber: null,
  isActive: true,
  roleIds: ["role-employee"],
  categories: ["Youtube"],
  commissionPercent: null,
};
const ROLES = [
  { id: "role-admin", name: "Admin", description: "Runs the business." },
  { id: "role-employee", name: "Employee", description: null },
];

async function openDialog(isSelf = false) {
  const user = userEvent.setup();
  render(<EditProfileButton employee={EMPLOYEE} roles={ROLES} isSelf={isSelf} fiverrFeePercent={20} />);
  await user.click(screen.getByRole("button", { name: "Edit profile" }));
  return user;
}

describe("Edit profile", () => {
  beforeEach(() => {
    save.mockReset();
    refresh.mockReset();
  });

  it("opens prefilled, with email and categories read-only", async () => {
    await openDialog();
    expect(screen.getByLabelText("Full name")).toHaveValue("Ayesha Khan");
    expect(screen.getByLabelText("Job title")).toHaveValue("Account manager");
    expect(screen.getByRole("checkbox", { name: /Employee/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Admin/ })).not.toBeChecked();
    expect(screen.getByText("Not editable here")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Email/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("validates before sending, and keeps values when the server refuses", async () => {
    save.mockResolvedValue({ ok: false, error: "You can't give the Admin role: it includes permissions you don't have yourself." });
    const user = await openDialog();

    await user.type(screen.getByLabelText("Phone"), "abc");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText(/Enter a phone number/)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Phone"));
    await user.type(screen.getByLabelText("Phone"), "+92 300 1234567");
    await user.click(screen.getByRole("checkbox", { name: /Admin/ }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: EMPLOYEE.id,
        fullName: "Ayesha Khan",
        phone: "+92 300 1234567",
        isActive: true,
        roleIds: ["role-employee", "role-admin"],
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("You can't give the Admin role");
    expect(screen.getByLabelText("Phone")).toHaveValue("+92 300 1234567");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("closes and refreshes after a successful save", async () => {
    save.mockResolvedValue({ ok: true, message: "Profile updated.", profile: {} });
    const user = await openDialog();
    await user.clear(screen.getByLabelText("Job title"));
    await user.type(screen.getByLabelText("Job title"), "Team lead");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByLabelText("Job title")).toBeNull();
  });

  it("sends a commission and shows a worked example", async () => {
    save.mockResolvedValue({ ok: true, message: "Profile updated.", profile: {} });
    const user = await openDialog();
    await user.type(screen.getByLabelText("Commission"), "10");
    // 10% of (100 − 20% Fiverr fee) = 8.00; External = 10.00
    expect(screen.getByText("8.00")).toBeInTheDocument();
    expect(screen.getByText("10.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ commissionPercent: "10" }));
  });

  it("rejects a commission over 100%", async () => {
    const user = await openDialog();
    await user.type(screen.getByLabelText("Commission"), "150");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText(/percentage from 0 to 100/)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it("locks roles and status when editing yourself", async () => {
    await openDialog(true);
    expect(screen.getByLabelText("Commission")).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Employee/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Inactive" })).toBeDisabled();
    expect(screen.getByLabelText("Full name")).toBeEnabled();
  });

  it("asks before discarding unsaved changes", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = await openDialog();
    await user.type(screen.getByLabelText("Display name"), "Ayesha");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText("Display name")).toHaveValue("Ayesha");
    confirm.mockRestore();
  });
});
