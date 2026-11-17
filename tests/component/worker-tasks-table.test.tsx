import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { WorkerTaskRow } from "@/app/(app)/orders/worker-tasks-table";

const changeStatus = vi.fn<(input: { itemId: string; status: string }) => Promise<{ ok: true; message: string }>>(async () => ({
  ok: true,
  message: "ok",
}));
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const rejectTask = vi.fn<(input: { itemId: string; reason: string }) => Promise<{ ok: true; message: string }>>(async () => ({
  ok: true,
  message: "Task rejected.",
}));
vi.mock("@/lib/orders/actions", () => ({
  changeOrderItemStatusAction: (input: { itemId: string; status: string }) => changeStatus(input),
  rejectTaskAction: (input: { itemId: string; reason: string }) => rejectTask(input),
}));
vi.mock("@/lib/youtube/actions", () => ({ refreshOrderItemStatsAction: vi.fn(async () => ({ ok: true, message: "" })) }));
vi.mock("@/lib/team/actions", () => ({}));
const getUpdates = vi.fn(async (input: { itemId: string }) => ({
  ok: true as const,
  thread: {
    itemId: input.itemId,
    orderNumber: 7,
    serviceName: "Youtube · Subscribers",
    metricLabel: "subscribers",
    currentCount: 1500,
    startingCount: 1000,
    targetCount: 6000,
    canPost: true,
    canSetCount: true,
    canAsk: true,
    canAnswer: false,
    openRequest: null,
    canWithdraw: true,
    openWithdraw: null,
    updates: [],
  },
}));
vi.mock("@/lib/order-updates/actions", () => ({
  getItemUpdatesAction: (input: { itemId: string }) => getUpdates(input),
  postItemUpdateAction: vi.fn(),
  requestScreenshotsAction: vi.fn(),
  requestWithdrawAction: vi.fn(),
}));

const { WorkerTasksTable } = await import("@/app/(app)/orders/worker-tasks-table");

beforeAll(() => {
  // jsdom has no <dialog> methods.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

const STUDIO = "https://studio.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA/analytics/tab-overview/period-default";

function row(overrides: Partial<WorkerTaskRow>): WorkerTaskRow {
  return {
    id: "item-1",
    orderId: "order-1",
    orderNumber: 7,
    serviceName: "Youtube · Subscribers",
    channel: { href: "https://www.youtube.com/@MrBeast", label: "youtube.com/@MrBeast" },
    channelTitle: "MrBeast",
    isYoutube: true,
    studioUrl: null,
    isWatchHours: false,
    statusLabel: "Pending",
    statusTone: "neutral",
    isRefill: false,
    canAccept: true,
    canComplete: false,
    completeBlocker: null,
    canPostUpdate: true,
    updateCount: 0,
    hasOpenRequest: false,
    hasWithdrawRequest: false,
    assignedAt: new Date(Date.now() - 3 * 3_600_000),
    finishedAt: null,
    deadline: new Date(Date.now() + 86_400_000),
    finished: false,
    metricLabel: "subscribers",
    startingCount: 1000,
    currentCount: 1500,
    targetCount: 6000,
    progressPercent: 10,
    delivered: 500,
    required: 5000,
    earningsLabel: "250.00 PKR",
    description: "Use the slow drip.",
    stats: [
      { label: "Subscribers", value: 1500 },
      { label: "Total views", value: 99000 },
    ],
    statsAt: new Date(),
    links: [],
    ...overrides,
  };
}

/** The task list (one row per task, the same markup on phones and desktop). */
const list = () => within(screen.getByRole("list", { name: "Your tasks" }));
/** Opens a row's "⋯" menu and returns it. */
async function openMenu(user: ReturnType<typeof userEvent.setup>, name = /Actions for Youtube · Subscribers/) {
  await user.click(list().getByRole("button", { name }));
  return within(screen.getByRole("menu", { name }));
}

describe("WorkerTasksTable", () => {
  it("shows the ring, channel name, delivered count, pay and a large elapsed time", () => {
    render(<WorkerTasksTable rows={[row({})]} />);
    expect(list().getByRole("img", { name: "10% done" })).toBeInTheDocument();
    expect(list().getByRole("link", { name: /MrBeast/ })).toHaveAttribute("href", "https://www.youtube.com/@MrBeast");
    expect(list().getByText(/of 5,000 subscribers/)).toHaveTextContent("500 of 5,000 subscribers");
    expect(list().getAllByText("250.00 PKR").length).toBeGreaterThan(0);
    // Shown twice: its own column from md, and in the line under the link on phones (2026-11-17).
    const elapsed = list().getAllByText(/^(2h 59m|3h 0m)/);
    expect(elapsed.length).toBe(2);
    for (const el of elapsed) expect(el.closest(".text-emerald-600")).not.toBeNull();
    expect(list().getAllByText(/elapsed/).length).toBeGreaterThan(0);
  });

  it("colours the elapsed time by age", () => {
    render(<WorkerTasksTable rows={[row({ assignedAt: new Date(Date.now() - 4.5 * 86_400_000) })]} />);
    for (const el of list().getAllByText(/^4d/)) expect(el.closest(".text-red-600")).not.toBeNull();
  });

  it("puts every action in the menu: Accept and Reject on a task not accepted yet", async () => {
    const user = userEvent.setup();
    render(<WorkerTasksTable rows={[row({})]} />);
    const menu = await openMenu(user);
    expect(menu.getByRole("menuitem", { name: /Accept task/ })).toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: /Reject/ })).toBeInTheDocument();
    expect(menu.queryByRole("menuitem", { name: /Post update/ })).toBeNull();
    expect(menu.queryByRole("menuitem", { name: /continue/ })).toBeNull();
    await user.click(menu.getByRole("menuitem", { name: /Accept task/ }));
    expect(changeStatus).toHaveBeenLastCalledWith({ itemId: "item-1", status: "PROCESSING" });
  });

  it("shows Accept and Reject on the row of a task waiting for an answer, which blinks", async () => {
    const user = userEvent.setup();
    render(<WorkerTasksTable rows={[row({})]} />);
    expect(list().getAllByRole("listitem")[0]).toHaveClass("pending-blink");
    await user.click(list().getAllByRole("button", { name: "Accept" })[0]!);
    expect(changeStatus).toHaveBeenLastCalledWith({ itemId: "item-1", status: "PROCESSING" });
    await user.click(list().getAllByRole("button", { name: "Reject" })[0]!);
    expect(screen.getByRole("heading", { name: "Reject this task?", hidden: true })).toBeInTheDocument();
  });

  it("doesn't blink or offer Accept once accepted", () => {
    render(<WorkerTasksTable rows={[row({ canAccept: false })]} />);
    expect(list().getAllByRole("listitem")[0]).not.toHaveClass("pending-blink");
    expect(list().queryByRole("button", { name: "Accept" })).toBeNull();
  });

  it("shows new updates on the row and opens them from the badge", async () => {
    const user = userEvent.setup();
    render(<WorkerTasksTable rows={[row({ canAccept: false, unreadUpdates: 2 })]} />);
    await user.click(list().getByRole("button", { name: "2 new updates. Open" }));
    expect(await screen.findByLabelText("Subscribers now")).toBeInTheDocument();
  });

  it("asks for a reason and rejects the task", async () => {
    const user = userEvent.setup();
    render(<WorkerTasksTable rows={[row({})]} />);
    await user.click((await openMenu(user)).getByRole("menuitem", { name: /Reject/ }));
    await user.type(screen.getByLabelText(/Why?/), "Too busy");
    await user.click(screen.getByRole("button", { name: "Reject task", hidden: true }));
    expect(rejectTask).toHaveBeenLastCalledWith({ itemId: "item-1", reason: "Too busy" });
  });

  it("completes a processing task after a confirm", async () => {
    const user = userEvent.setup();
    render(<WorkerTasksTable rows={[row({ canAccept: false, canComplete: true, statusLabel: "Processing" })]} />);
    await user.click((await openMenu(user)).getByRole("menuitem", { name: /^Complete$/ }));
    expect(screen.getByRole("heading", { name: "Mark this task done?", hidden: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Complete$/, hidden: true }));
    expect(changeStatus).toHaveBeenLastCalledWith({ itemId: "item-1", status: "DONE" });
  });

  it("keeps Complete off until YouTube shows the target, with a way to check again", async () => {
    const user = userEvent.setup();
    const blocker = "YouTube shows 1,500 of 6,000 subscribers, 4,500 to go.";
    render(<WorkerTasksTable rows={[row({ canAccept: false, canComplete: true, completeBlocker: blocker })]} />);
    const menu = await openMenu(user);
    expect(menu.getByRole("menuitem", { name: /Complete/ })).toHaveAttribute("aria-disabled", "true");
    expect(menu.getByText(blocker)).toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: "Check YouTube again" })).toBeInTheDocument();
  });

  it("opens the task's updates from Post update, with the count so far", async () => {
    const user = userEvent.setup();
    render(<WorkerTasksTable rows={[row({ canAccept: false, updateCount: 3 })]} />);
    await user.click((await openMenu(user)).getByRole("menuitem", { name: "Post update (3)" }));
    expect(await screen.findByLabelText("Subscribers now")).toBeInTheDocument();
  });

  it("offers Ask for screenshots, and shows when a request is waiting", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<WorkerTasksTable rows={[row({ canAccept: false })]} />);
    await user.click((await openMenu(user)).getByRole("menuitem", { name: /Ask for screenshots/ }));
    expect(screen.getByRole("heading", { name: "Ask for screenshots", hidden: true })).toBeInTheDocument();

    rerender(<WorkerTasksTable rows={[row({ canAccept: false, hasOpenRequest: true })]} />);
    expect(list().getAllByText("Screenshots requested")[0]).toBeInTheDocument();
  });

  it("offers Can't continue on an open task, and shows when it's waiting", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<WorkerTasksTable rows={[row({ canAccept: false })]} />);
    await user.click((await openMenu(user)).getByRole("menuitem", { name: /continue/ }));
    expect(screen.getByRole("heading", { name: "Can't continue this task?", hidden: true })).toBeInTheDocument();

    rerender(<WorkerTasksTable rows={[row({ canAccept: false, hasWithdrawRequest: true })]} />);
    expect(list().getAllByText("Waiting for reassignment")[0]).toBeInTheDocument();
  });

  it("shows Updates (read only) when the worker can't post", async () => {
    const user = userEvent.setup();
    render(<WorkerTasksTable rows={[row({ canAccept: false, canPostUpdate: false, finished: true })]} />);
    expect((await openMenu(user)).getByRole("menuitem", { name: "Updates" })).toBeInTheDocument();
  });

  it("opens a task's updates straight away from a notification link", async () => {
    render(<WorkerTasksTable rows={[row({})]} openUpdatesId="item-1" />);
    expect(await screen.findByLabelText("Subscribers now")).toBeInTheDocument();
  });

  it("links watch hours to YouTube Studio from the menu", async () => {
    const user = userEvent.setup();
    render(<WorkerTasksTable rows={[row({ canAccept: false, studioUrl: STUDIO, isWatchHours: true })]} />);
    expect((await openMenu(user)).getByRole("menuitem", { name: /Studio analytics/ })).toHaveAttribute("href", STUDIO);
  });

  it("opens the task's details in a popup when the row is clicked", async () => {
    const user = userEvent.setup();
    render(<WorkerTasksTable rows={[row({})]} />);
    await user.click(list().getByRole("button", { name: /Details for Youtube · Subscribers, order #7/ }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(within(dialog).getByText("Use the slow drip.")).toBeInTheDocument();
    const figure = (label: string) => within(dialog).getByText(label, { selector: "dt" }).parentElement!;
    expect(figure("Started at")).toHaveTextContent("1,000");
    expect(figure("Current")).toHaveTextContent("1,500");
    expect(figure("Completed")).toHaveTextContent("500");
    expect(figure("Remaining")).toHaveTextContent("4,500");
    expect(within(dialog).queryByText(/completed, .* to go/)).toBeNull();
    // Subscribers is already shown as Current; only the other YouTube numbers are listed.
    expect(within(dialog).queryByText("Subscribers")).toBeNull();
    expect(within(dialog).getByText("Total views")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Open order page", hidden: true })).toHaveAttribute("href", "/orders/order-1");
  });

  it("shows the channel-id link and Studio beside the link in the popup", async () => {
    const user = userEvent.setup();
    const idUrl = "https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA";
    render(<WorkerTasksTable rows={[row({ channelIdUrl: idUrl, studioUrl: STUDIO })]} />);
    await user.click(list().getByRole("button", { name: /Details for/ }));
    const dialog = within(screen.getByRole("dialog", { hidden: true }));
    expect(dialog.getByRole("link", { name: "Open by channel ID", hidden: true })).toHaveAttribute("href", idUrl);
    expect(dialog.getByRole("link", { name: /Studio/, hidden: true })).toHaveAttribute("href", STUDIO);
  });

  it("shows Complete as a button in the details popup, with the rest in its menu", async () => {
    const user = userEvent.setup();
    render(<WorkerTasksTable rows={[row({ canAccept: false, canComplete: true, statusLabel: "Processing" })]} />);
    await user.click(list().getByRole("button", { name: /Details for/ }));
    const dialog = within(screen.getByRole("dialog", { hidden: true }));
    expect(dialog.getByRole("button", { name: /Complete/, hidden: true })).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: /More actions/, hidden: true }));
    const menu = within(screen.getByRole("menu", { name: /More actions/, hidden: true }));
    expect(menu.getByRole("menuitem", { name: /Post update/, hidden: true })).toBeInTheDocument();
    expect(menu.queryByRole("menuitem", { name: /^Complete$/, hidden: true })).toBeNull();
    expect(menu.queryByRole("menuitem", { name: "Details", hidden: true })).toBeNull();
  });

  describe("opened from an accept link", () => {
    const focus = row({ id: "focus", startingCount: 200, currentCount: 200, targetCount: 4200, required: 4000, delivered: 0, metricLabel: "watch hours" });

    it("opens the short popup with the message's details and Accept", async () => {
      const user = userEvent.setup();
      render(<WorkerTasksTable rows={[]} focus={focus} />);
      const dialog = screen.getByRole("dialog", { hidden: true });
      expect(within(dialog).getByText(/New task · Order #7/)).toBeInTheDocument();
      expect(within(dialog).getByText("Need").nextSibling).toHaveTextContent("4,000watch hours");
      expect(within(dialog).getByText("Current watch hours").nextSibling).toHaveTextContent("200");
      expect(within(dialog).getByText("Stop at").nextSibling).toHaveTextContent("4,200watch hours");
      expect(within(dialog).queryByText("Use the slow drip.")).toBeNull();

      await user.click(within(dialog).getByRole("button", { name: /^Accept$/, hidden: true }));
      expect(changeStatus).toHaveBeenLastCalledWith({ itemId: "focus", status: "PROCESSING" });
    });

    it("expands to all details, and drops ?open= when closed", async () => {
      const user = userEvent.setup();
      window.history.replaceState(null, "", "/orders?open=focus");
      render(<WorkerTasksTable rows={[]} focus={focus} />);
      const dialog = screen.getByRole("dialog", { hidden: true });
      await user.click(within(dialog).getByRole("button", { name: "Show all details", hidden: true }));
      expect(within(dialog).getByText("Use the slow drip.")).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Close", hidden: true }));
      expect(replace).toHaveBeenCalledWith("/orders", { scroll: false });
    });
  });
});
