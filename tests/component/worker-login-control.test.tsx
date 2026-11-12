import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/** Portal access on a worker's page (2026-11-12): not invited, invite pending, set up. */

const invite = vi.fn(async () => ({ ok: true as const, message: "Invitation sent." }));
const resend = vi.fn(async () => ({ ok: true as const, message: "A new invitation is on its way." }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/outsourced-workers/actions", () => ({
  inviteOutsourcedWorkerToLoginAction: () => invite(),
  resendOutsourcedWorkerInviteAction: () => resend(),
}));

const { OutsourcedWorkerLoginControl } = await import("@/app/(app)/outsourced-workers/[id]/outsourced-worker-login-control");

describe("Portal access", () => {
  it("offers an invite when there is none", async () => {
    render(<OutsourcedWorkerLoginControl workerId="w" hasLogin={false} invitePending={false} invitedAt={null} email="zee@example.com" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Invite to log in" }));
    expect(invite).toHaveBeenCalled();
  });

  it("shows Invite pending, not portal access, until they set a password, with Resend", async () => {
    render(
      <OutsourcedWorkerLoginControl workerId="w" hasLogin invitePending invitedAt={new Date("2026-11-11T22:40:00Z")} email="zee@example.com" />,
    );
    expect(screen.getByText("Invite pending")).toBeInTheDocument();
    expect(screen.queryByText("Has portal access")).toBeNull();
    expect(screen.getByText(/Invitation sent 11 Nov, 22:40 UTC/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Resend invitation" }));
    expect(resend).toHaveBeenCalled();
  });

  it("shows portal access once they have set a password", () => {
    render(<OutsourcedWorkerLoginControl workerId="w" hasLogin invitePending={false} invitedAt={null} email="zee@example.com" />);
    expect(screen.getByText("Has portal access")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
