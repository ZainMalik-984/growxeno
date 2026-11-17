import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TeamDialog, type TeamTask } from "@/app/(app)/orders/team-dialog";
import { TeamPanel } from "@/app/(app)/team/team-panel";
import type { TeamShareView } from "@/lib/team/queries";

/** An outsourced worker's own team (2026-11-17): the Team popup on a task and the My team page. */

const actions = vi.hoisted(() => ({
  addTeamMemberAction: vi.fn(),
  updateTeamMemberAction: vi.fn(),
  setTeamMemberActiveAction: vi.fn(),
  getMemberWorkAction: vi.fn(),
  assignShareAction: vi.fn(),
  updateShareAction: vi.fn(),
  setShareStatusAction: vi.fn(),
  removeShareAction: vi.fn(),
}));
vi.mock("@/lib/team/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// jsdom has no <dialog> modal API.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};

const TASK: TeamTask = {
  id: "11111111-1111-4111-8111-111111111111",
  orderNumber: 12,
  serviceName: "Youtube · Watch Hours",
  metricType: "WATCH_HOURS",
  startingCount: 200,
  targetCount: 4200,
  channelLink: "https://youtube.com/@channel",
};
const ALI = { id: "22222222-2222-4222-8222-222222222222", name: "Ali Raza", whatsappNumber: "+92 300 1234567" };
const SARA = { id: "33333333-3333-4333-8333-333333333333", name: "Sara", whatsappNumber: null };
const SHARE: TeamShareView = {
  id: "44444444-4444-4444-8444-444444444444",
  memberId: ALI.id,
  memberName: ALI.name,
  memberWhatsapp: ALI.whatsappNumber,
  amount: 2500,
  done: 1800,
  status: "PROCESSING",
  note: null,
  assignedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  finishedAt: null,
};

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset();
});

describe("Team popup on a task", () => {
  it("shows the split and prefills the next person with what's left", async () => {
    const user = userEvent.setup();
    render(<TeamDialog task={TASK} shares={[SHARE]} members={[ALI, SARA]} onClose={() => {}} />);
    expect(screen.getByText("1 person")).toBeInTheDocument();
    expect(screen.getByText("2,500").parentElement).toHaveTextContent("2,500 / 4,000 watch hours assigned");
    expect(screen.getAllByText("Ali Raza").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Mark done" })).toBeInTheDocument();
    // A row is one line: how long they've had it and their progress; the rest opens on tap.
    expect(screen.getByText("1,800 / 2,500")).toBeInTheDocument();
    expect(screen.queryByLabelText("Done so far by Ali Raza")).toBeNull();
    await user.click(screen.getByRole("button", { expanded: false, name: /Ali Raza/ }));
    expect(screen.getByLabelText("Done so far by Ali Raza")).toHaveValue("1800");
    expect(screen.getByText("Assigned for")).toBeInTheDocument();
    // Ali is already on it, so the picker offers Sara, with the remaining 1,500.
    expect(screen.getByLabelText("Team member")).toHaveValue(SARA.id);
    expect(screen.getByLabelText("Amount (watch hours)")).toHaveValue("1500");
  });

  it("leads with the service and its logo, shows dates, and lets one person take another part", async () => {
    const user = userEvent.setup();
    render(
      <TeamDialog
        task={{ ...TASK, serviceTitle: "Watch Hours", categoryName: "YouTube", categoryImageUrl: null }}
        shares={[SHARE, { ...SHARE, id: "55555555-5555-4555-8555-555555555556", status: "DONE", finishedAt: new Date().toISOString(), amount: 500, done: 500 }]}
        members={[ALI, SARA]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { name: "Watch Hours" })).toBeInTheDocument();
    expect(screen.queryByText("Youtube · Watch Hours")).toBeNull();
    expect(screen.getByText(/1 person · 2 parts/)).toBeInTheDocument();
    // Collapsed: only the completion day on a done part; tapped: the exact times.
    expect(screen.getByText(/^Completed /)).toBeInTheDocument();
    expect(screen.queryByText("Assigned")).toBeNull();
    const done = screen.getAllByRole("button", { expanded: false, name: /Ali Raza/ })[1]!;
    await user.click(done);
    expect(screen.getByText("Assigned")).toBeInTheDocument();
    expect(screen.getByText("Time taken")).toBeInTheDocument();
    // Ali is already on it twice and can still be picked again.
    expect(screen.getByRole("option", { name: "Ali Raza" })).toBeInTheDocument();
    expect(screen.getByText(/Private to you/)).toBeInTheDocument();
  });

  it("messages a member their part on WhatsApp", async () => {
    const user = userEvent.setup();
    render(<TeamDialog task={TASK} shares={[SHARE]} members={[ALI, SARA]} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { expanded: false, name: /Ali Raza/ }));
    const link = screen.getByRole("link", { name: "Send Ali Raza their part on WhatsApp" });
    expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/923001234567\?text=/);
    expect(decodeURIComponent(link.getAttribute("href")!)).toContain("Your part: 2,500 watch hours");
  });

  it("assigns, and marks a part done", async () => {
    actions.assignShareAction.mockResolvedValue({ ok: true, message: "Assigned.", shareId: "x" });
    actions.setShareStatusAction.mockResolvedValue({ ok: true, message: "Marked done." });
    const user = userEvent.setup();
    render(<TeamDialog task={TASK} shares={[SHARE]} members={[ALI, SARA]} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Assign" }));
    expect(actions.assignShareAction).toHaveBeenCalledWith({ itemId: TASK.id, memberId: SARA.id, amount: 1500, note: null });
    await user.click(screen.getByRole("button", { name: "Mark done" }));
    expect(actions.setShareStatusAction).toHaveBeenCalledWith({ shareId: SHARE.id, status: "DONE" });
  });

  it("adds a new member in place before assigning", async () => {
    actions.addTeamMemberAction.mockResolvedValue({ ok: true, message: "Added.", memberId: "55555555-5555-4555-8555-555555555555" });
    actions.assignShareAction.mockResolvedValue({ ok: true, message: "Assigned.", shareId: "x" });
    const user = userEvent.setup();
    render(<TeamDialog task={TASK} shares={[]} members={[]} onClose={() => {}} />);
    expect(screen.getByLabelText("Team member")).toHaveValue("__new__");
    await user.type(screen.getByLabelText("New member's name"), "Bilal");
    await user.click(screen.getByRole("button", { name: "Assign" }));
    expect(actions.addTeamMemberAction).toHaveBeenCalledWith({ name: "Bilal", whatsappNumber: "" });
    expect(actions.assignShareAction).toHaveBeenCalledWith(expect.objectContaining({ memberId: "55555555-5555-4555-8555-555555555555", amount: 4000 }));
  });
});

describe("Team popup on a task without a count", () => {
  const WEBSITE: TeamTask = { ...TASK, serviceName: "Website", metricType: null, startingCount: null, targetCount: null };

  it("still takes how many each person gets, optionally", async () => {
    actions.assignShareAction.mockResolvedValue({ ok: true, message: "Assigned.", shareId: "x" });
    const user = userEvent.setup();
    render(<TeamDialog task={WEBSITE} shares={[]} members={[ALI]} onClose={() => {}} />);
    await user.type(screen.getByLabelText("Amount (optional)"), "5");
    await user.click(screen.getByRole("button", { name: "Assign" }));
    expect(actions.assignShareAction).toHaveBeenCalledWith({ itemId: TASK.id, memberId: ALI.id, amount: 5, note: null });
  });

  it("assigns without one too", async () => {
    actions.assignShareAction.mockResolvedValue({ ok: true, message: "Assigned.", shareId: "x" });
    const user = userEvent.setup();
    render(<TeamDialog task={WEBSITE} shares={[]} members={[ALI]} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Assign" }));
    expect(actions.assignShareAction).toHaveBeenCalledWith({ itemId: TASK.id, memberId: ALI.id, amount: null, note: null });
  });
});

describe("My team page", () => {
  it("invites adding the first member", async () => {
    actions.addTeamMemberAction.mockResolvedValue({ ok: true, message: "Ali added to your team.", memberId: "m" });
    const user = userEvent.setup();
    render(<TeamPanel members={[]} />);
    expect(screen.getByText("No team members yet")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Add member" })[0]!);
    const dialog = screen.getByRole("dialog", { name: "Add team member" });
    await user.type(within(dialog).getByLabelText("Name"), "Ali");
    await user.type(within(dialog).getByLabelText("WhatsApp number"), "+92 300 1234567");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));
    expect(actions.addTeamMemberAction).toHaveBeenCalledWith({ name: "Ali", whatsappNumber: "+92 300 1234567" });
  });

  it("lists members and opens one's work in a popup", async () => {
    actions.getMemberWorkAction.mockResolvedValue({
      ok: true,
      shares: [{ ...SHARE, itemId: TASK.id, orderNumber: 12, serviceName: TASK.serviceName, metricType: "WATCH_HOURS", channelLink: null, startingCount: 200, targetCount: 4200 }],
    });
    const user = userEvent.setup();
    render(<TeamPanel members={[{ ...ALI, isActive: true, processing: 1, done: 3 }]} />);
    expect(screen.getByText("1 processing · 3 done")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WhatsApp Ali Raza" })).toHaveAttribute("href", "https://wa.me/923001234567?text=");
    await user.click(screen.getByRole("button", { name: /1 processing/ }));
    expect(actions.getMemberWorkAction).toHaveBeenCalledWith({ memberId: ALI.id });
    expect(await screen.findByText("Order #12 · Youtube · Watch Hours")).toBeInTheDocument();
    expect(screen.getByText(/1,800 \/ 2,500 watch hours/)).toBeInTheDocument();
  });
});
