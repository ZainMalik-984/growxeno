import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AssignmentMessageOutcome } from "@/lib/orders/assignment-notify";

const getMessage = vi.fn<(input: { itemId: string; resendEmail?: boolean }) => Promise<unknown>>();
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/orders/actions", () => ({ getAssignmentMessageAction: (input: { itemId: string; resendEmail?: boolean }) => getMessage(input) }));

const { AssignmentDeliveryStep } = await import("@/app/(app)/orders/[id]/assignment-delivery");

const WA = "https://wa.me/923001234567?text=New%20task";

function outcome(overrides: Partial<AssignmentMessageOutcome>): AssignmentMessageOutcome {
  return {
    workerName: "Inzmam",
    email: { status: "sent", to: "inzmam@gmail.com" },
    whatsappUrl: WA,
    whatsappSkipReason: null,
    ...overrides,
  };
}

describe("AssignmentDeliveryStep", () => {
  it("shows the email was sent and links WhatsApp to the prefilled message", () => {
    render(<AssignmentDeliveryStep itemId="i" delivery={outcome({})} onDone={vi.fn()} />);
    expect(screen.getByText("Sent to inzmam@gmail.com")).toBeInTheDocument();
    const wa = screen.getByRole("link", { name: /Send on WhatsApp/ });
    expect(wa).toHaveAttribute("href", WA);
    expect(wa).toHaveAttribute("target", "_blank");
  });

  it("explains a failed email and can send it again", async () => {
    getMessage.mockResolvedValueOnce({ ok: true, message: "Email sent.", delivery: outcome({}) });
    const user = userEvent.setup();
    render(
      <AssignmentDeliveryStep
        itemId="i"
        delivery={outcome({ email: { status: "failed", to: "inzmam@gmail.com", error: "Email not sent: domain not verified" } })}
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByText("Email not sent: domain not verified")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Send again/ }));
    expect(getMessage).toHaveBeenCalledWith({ itemId: "i", resendEmail: true });
    expect(await screen.findByText("Sent to inzmam@gmail.com")).toBeInTheDocument();
  });

  it("says why WhatsApp is unavailable", () => {
    render(
      <AssignmentDeliveryStep
        itemId="i"
        delivery={outcome({ whatsappUrl: null, whatsappSkipReason: "No WhatsApp number on file.", email: { status: "skipped", reason: "Email is turned off for this worker." } })}
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByText("No WhatsApp number on file.")).toBeInTheDocument();
    expect(screen.getByText("Email is turned off for this worker.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Send/ })).toBeNull();
  });
});
