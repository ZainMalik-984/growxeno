import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { OutsourcedWorkerDetail } from "@/lib/outsourced-workers/queries";

const update = vi.fn<(input: Record<string, unknown>) => Promise<{ ok: true; message: string }>>(async () => ({ ok: true, message: "Saved." }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/outsourced-workers/actions", () => ({ updateOutsourcedWorkerAction: (input: Record<string, unknown>) => update(input) }));

const { OutsourcedWorkerProfileForm } = await import("@/app/(app)/outsourced-workers/[id]/outsourced-worker-profile-form");

const worker: OutsourcedWorkerDetail = {
  id: "8f6e3a1c-1111-4c2b-9a1d-2b3c4d5e6f70",
  name: "Inzmam",
  email: "inzmam@gmail.com",
  phone: null,
  whatsappNumber: null,
  notes: null,
  notifyVia: "BOTH",
  isActive: true,
  assignedItemCount: 0,
  rates: [],
  hasLogin: true,
      invitePending: false,
      invitedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Send new tasks by", () => {
  it("warns about a missing number and saves the choice", async () => {
    const user = userEvent.setup();
    render(<OutsourcedWorkerProfileForm worker={worker} canEdit />);
    expect(screen.getByText(/Add a WhatsApp number/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Email only" }));
    expect(screen.queryByText(/Add a WhatsApp number/)).toBeNull();
    await user.click(screen.getByRole("button", { name: /Save changes/ }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ workerId: worker.id, notifyVia: "EMAIL" }));
  });

  it("shows the choice read-only to someone who can't edit", () => {
    render(<OutsourcedWorkerProfileForm worker={{ ...worker, notifyVia: "WHATSAPP" }} canEdit={false} />);
    expect(screen.getByText("WhatsApp only")).toBeInTheDocument();
  });
});
