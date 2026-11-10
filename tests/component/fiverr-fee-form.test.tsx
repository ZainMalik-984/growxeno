import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FiverrFeeForm } from "@/app/(app)/settings/system/fiverr-fee-form";

const save = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/settings/actions", () => ({ saveFiverrFeeSettingsAction: save }));

describe("FiverrFeeForm", () => {
  beforeEach(() => save.mockReset().mockResolvedValue({ ok: true, message: "Fiverr fee saved." }));

  it("shows the fee with a worked example and saves a new value", async () => {
    const user = userEvent.setup();
    render(<FiverrFeeForm initial={{ percent: 20 }} canEdit />);
    expect(screen.getByLabelText("Fiverr fee")).toHaveValue("20");
    expect(screen.getByText("80.00")).toBeInTheDocument(); // after the fee
    expect(screen.getByText("8.00")).toBeInTheDocument(); // 10% commission
    // The save bar only appears once something changes.
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();

    await user.clear(screen.getByLabelText("Fiverr fee"));
    await user.type(screen.getByLabelText("Fiverr fee"), "15");
    expect(screen.getByText("85.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(save).toHaveBeenCalledWith({ percent: 15 });
  });

  it("refuses a fee over 100%", async () => {
    const user = userEvent.setup();
    render(<FiverrFeeForm initial={{ percent: 20 }} canEdit />);
    await user.clear(screen.getByLabelText("Fiverr fee"));
    await user.type(screen.getByLabelText("Fiverr fee"), "120");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("more than 100%");
    expect(save).not.toHaveBeenCalled();
  });

  it("is read-only without settings.edit", () => {
    render(<FiverrFeeForm initial={{ percent: 20 }} canEdit={false} />);
    expect(screen.getByLabelText("Fiverr fee")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });
});
