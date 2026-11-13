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

/** The desktop table; the same tasks also render as phone cards, hidden by CSS from `md` up. */
const table = () => within(screen.getByRole("table"));
/** The phone card list (the first list on the page). */
const cards = () => within(screen.getAllByRole("list")[0]!);

describe("WorkerTasksTable", () => {
  it("shows the channel name with its link, when it was given, and no deadline column", () => {
    render(<WorkerTasksTable rows={[row({})]} />);
    expect(table().getByText("MrBeast")).toBeInTheDocument();
    expect(table().getByText("youtube.com/@MrBeast")).toBeInTheDocument();
    // Time since given sits right after Link, with progress under it (2026-11-13).
    const headers = table().getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers.indexOf("Time & progress")).toBe(headers.indexOf("Link") + 1);
    expect(table().queryByRole("columnheader", { name: "Deadline" })).toBeNull();
    expect(table().getByText(/^(2h 59m|3h 0m)$/)).toBeInTheDocument();
    expect(table().getByText("elapsed")).toBeInTheDocument();
  });

  it("offers Accept on a pending task and Complete (with a confirm) on a processing one", async () => {
    const user = userEvent.setup();
    render(
      <WorkerTasksTable
        rows={[
          row({ id: "a" }),
          row({ id: "b", statusLabel: "Processing", canAccept: false, canComplete: true }),
        ]}
      />,
    );
    await user.click(table().getByRole("button", { name: /^Accept$/ }));
    expect(changeStatus).toHaveBeenCalledWith({ itemId: "a", status: "PROCESSING" });

    await user.click(table().getByRole("button", { name: /Complete/ }));
    expect(changeStatus).toHaveBeenCalledTimes(1);
    await user.click(table().getByRole("button", { name: /Confirm/ }));
    expect(changeStatus).toHaveBeenLastCalledWith({ itemId: "b", status: "DONE" });
  });

  it("keeps Complete off until YouTube shows the target, with a way to check again", () => {
    const blocker = "YouTube shows 1,120 of 3,170 subscribers, 2,050 to go.";
    render(<WorkerTasksTable rows={[row({ id: "b", statusLabel: "Processing", canAccept: false, canComplete: true, completeBlocker: blocker })]} />);
    expect(table().getByRole("button", { name: /Complete/ })).toBeDisabled();
    expect(table().getByRole("button", { name: "Check the count on YouTube again" })).toBeEnabled();
  });

  it("opens the task's updates from a prominent Post update button, with the count so far", async () => {
    const user = userEvent.setup();
    render(<WorkerTasksTable rows={[row({ id: "p", canAccept: false, canComplete: true, updateCount: 3 })]} />);
    const button = table().getByRole("button", { name: /Post update/ });
    expect(button).toHaveTextContent("3");
    await user.click(button);
    expect(getUpdates).toHaveBeenCalledWith({ itemId: "p" });
    expect(await screen.findByLabelText("Subscribers now")).toBeInTheDocument();
  });

  it("offers Ask for screenshots, and shows when a request is waiting", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<WorkerTasksTable rows={[row({ id: "s", canAccept: false, canComplete: true })]} />);
    await user.click(table().getByRole("button", { name: /Ask for screenshots/ }));
    expect(screen.getByRole("heading", { name: "Ask for screenshots", hidden: true })).toBeInTheDocument();
    unmount();
    render(<WorkerTasksTable rows={[row({ id: "s", hasOpenRequest: true, canAccept: false, canComplete: true })]} />);
    expect(table().queryByRole("button", { name: /Ask for screenshots/ })).toBeNull();
    expect(table().getByText("Screenshots requested")).toBeInTheDocument();
    expect(cards().getByText("Screenshots requested")).toBeInTheDocument();
  });

  it("offers Can't continue on an open task, and shows when it's waiting", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<WorkerTasksTable rows={[row({ id: "w", progressPercent: 40, delivered: 400, required: 1000, canAccept: false, canComplete: true })]} />);
    await user.click(table().getByRole("button", { name: /Can't continue/ }));
    expect(screen.getByRole("heading", { name: "Can't continue this task?", hidden: true })).toBeInTheDocument();
    unmount();
    render(<WorkerTasksTable rows={[row({ id: "w", hasWithdrawRequest: true, canAccept: false, canComplete: true })]} />);
    expect(table().getByText("Waiting for reassignment")).toBeInTheDocument();
    expect(cards().getByText("Waiting for reassignment")).toBeInTheDocument();
  });

  it("shows only Accept and Reject on a task not accepted yet", () => {
    render(<WorkerTasksTable rows={[row({ id: "new" })]} />);
    for (const scope of [table(), cards()]) {
      expect(scope.getByRole("button", { name: /^Accept$/ })).toBeInTheDocument();
      expect(scope.getByRole("button", { name: /^Reject$/ })).toBeInTheDocument();
      expect(scope.queryByRole("button", { name: /Post update/ })).toBeNull();
      expect(scope.queryByRole("button", { name: /Ask for screenshots/ })).toBeNull();
      expect(scope.queryByRole("button", { name: /Can't continue/ })).toBeNull();
    }
  });

  it("asks for a reason and rejects the task", async () => {
    const user = userEvent.setup();
    render(<WorkerTasksTable rows={[row({ id: "new" })]} />);
    await user.click(table().getByRole("button", { name: /^Reject$/ }));
    await user.type(screen.getByLabelText(/Why?/), "Too busy");
    await user.click(screen.getByRole("button", { name: "Reject task", hidden: true }));
    expect(rejectTask).toHaveBeenCalledWith({ itemId: "new", reason: "Too busy" });
  });

  it("shows Updates (read only) when the worker can't post", () => {
    render(<WorkerTasksTable rows={[row({ canPostUpdate: false, canAccept: false })]} />);
    expect(table().getByRole("button", { name: /^Updates/ })).toBeInTheDocument();
  });

  it("opens a task's updates straight away from a notification link", async () => {
    render(<WorkerTasksTable rows={[row({ id: "n" })]} openUpdatesId="n" />);
    expect(getUpdates).toHaveBeenCalledWith({ itemId: "n" });
    expect(await screen.findByLabelText("Subscribers now")).toBeInTheDocument();
  });

  it("shows progress as delivered out of required, not the channel's total", () => {
    render(<WorkerTasksTable rows={[row({})]} />);
    const cell = table().getByText(/subscribers delivered/).closest("span")!;
    expect(cell).toHaveTextContent("500 / 5,000 subscribers delivered");
    expect(table().getByText("Now at 1,500")).toBeInTheDocument();
    expect(screen.queryByText(/1,500 \/ 6,000/)).toBeNull();
  });


  it("links watch hours to YouTube Studio", () => {
    render(<WorkerTasksTable rows={[row({ serviceName: "Youtube · Watch Hours", isWatchHours: true, studioUrl: STUDIO })]} />);
    expect(table().getByRole("link", { name: /Studio/ })).toHaveAttribute("href", STUDIO);
  });

  it("opens the task's details in a popup", async () => {
    const user = userEvent.setup();
    render(<WorkerTasksTable rows={[row({})]} />);
    await user.click(table().getByRole("button", { name: /Details/ }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(within(dialog).getByText("Use the slow drip.")).toBeInTheDocument();
    expect(within(dialog).getByText("500 of 5,000 subscribers delivered.")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Open order page", hidden: true })).toHaveAttribute("href", "/orders/order-1");
  });

  describe("on a phone", () => {
    it("shows a card per task with delivered progress, pay and a full-width Accept", async () => {
      const user = userEvent.setup();
      render(<WorkerTasksTable rows={[row({ id: "m" })]} />);
      const card = cards();
      expect(card.getByText("Youtube · Subscribers")).toBeInTheDocument();
      expect(card.getByText("MrBeast")).toBeInTheDocument();
      expect(card.getByText(/subscribers delivered/).closest("p")).toHaveTextContent("500 / 5,000 subscribers delivered · now 1,500");
      expect(card.getByText("250.00 PKR")).toBeInTheDocument();
      expect(card.getByText(/^(2h 59m|3h 0m)$/)).toBeInTheDocument();
      expect(card.getByText("elapsed")).toBeInTheDocument();
      await user.click(card.getByRole("button", { name: /^Accept$/ }));
      expect(changeStatus).toHaveBeenLastCalledWith({ itemId: "m", status: "PROCESSING" });
    });

    it("opens the details when the card is tapped", async () => {
      const user = userEvent.setup();
      render(<WorkerTasksTable rows={[row({})]} />);
      await user.click(cards().getByRole("button", { name: /Details for Youtube · Subscribers, order #7/ }));
      const dialog = screen.getByRole("dialog", { hidden: true });
      expect(within(dialog).getByText("Use the slow drip.")).toBeInTheDocument();
    });

    it("shows Complete on an accepted task and the Studio link for watch hours", () => {
      render(
        <WorkerTasksTable
          rows={[row({ statusLabel: "Processing", canAccept: false, canComplete: true, isWatchHours: true, studioUrl: STUDIO })]}
        />,
      );
      expect(cards().getByRole("button", { name: /Complete/ })).toBeInTheDocument();
      expect(cards().getByRole("link", { name: /Studio/ })).toHaveAttribute("href", STUDIO);
    });
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
