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
const updateProgress = vi.fn<(input: { itemId: string; currentCount: number }) => Promise<{ ok: true; message: string }>>(async () => ({
  ok: true,
  message: "ok",
}));
vi.mock("@/lib/orders/actions", () => ({
  changeOrderItemStatusAction: (input: { itemId: string; status: string }) => changeStatus(input),
  updateOrderItemProgressAction: (input: { itemId: string; currentCount: number }) => updateProgress(input),
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
    canUpdateProgress: false,
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

describe("WorkerTasksTable", () => {
  it("shows the channel name with its link, when it was given, and no deadline column", () => {
    render(<WorkerTasksTable rows={[row({})]} />);
    expect(screen.getByText("MrBeast")).toBeInTheDocument();
    expect(screen.getByText("youtube.com/@MrBeast")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Given" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Deadline" })).toBeNull();
    expect(screen.getByText(/(2h 59m|3h 0m) ago/)).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: /^Accept$/ }));
    expect(changeStatus).toHaveBeenCalledWith({ itemId: "a", status: "PROCESSING" });

    await user.click(screen.getByRole("button", { name: /Complete/ }));
    expect(changeStatus).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: /Confirm/ }));
    expect(changeStatus).toHaveBeenLastCalledWith({ itemId: "b", status: "DONE" });
  });

  it("lets the worker update the current count on an accepted task", async () => {
    const user = userEvent.setup();
    render(<WorkerTasksTable rows={[row({ id: "p", canAccept: false, canComplete: true, canUpdateProgress: true })]} />);
    await user.click(screen.getByRole("button", { name: /Update/ }));
    const input = screen.getByLabelText("Current subscribers");
    expect(input).toHaveValue("1500");
    await user.clear(input);
    await user.type(input, "2,350");
    await user.click(screen.getByRole("button", { name: /Save/ }));
    expect(updateProgress).toHaveBeenCalledWith({ itemId: "p", currentCount: 2350 });
  });

  it("shows progress as delivered out of required, not the channel's total", () => {
    render(<WorkerTasksTable rows={[row({})]} />);
    const cell = screen.getByText(/subscribers delivered/).closest("span")!;
    expect(cell).toHaveTextContent("500 / 5,000 subscribers delivered");
    expect(screen.getByText("Now at 1,500")).toBeInTheDocument();
    expect(screen.queryByText(/1,500 \/ 6,000/)).toBeNull();
  });

  it("hides Update on a pending task", () => {
    render(<WorkerTasksTable rows={[row({})]} />);
    expect(screen.queryByRole("button", { name: /Update/ })).toBeNull();
  });

  it("links watch hours to YouTube Studio", () => {
    render(<WorkerTasksTable rows={[row({ serviceName: "Youtube · Watch Hours", isWatchHours: true, studioUrl: STUDIO })]} />);
    expect(screen.getByRole("link", { name: /Studio/ })).toHaveAttribute("href", STUDIO);
  });

  it("opens the task's details in a popup", async () => {
    const user = userEvent.setup();
    render(<WorkerTasksTable rows={[row({})]} />);
    await user.click(screen.getByRole("button", { name: /Details/ }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(within(dialog).getByText("Use the slow drip.")).toBeInTheDocument();
    expect(within(dialog).getByText("500 of 5,000 subscribers delivered.")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Open order page", hidden: true })).toHaveAttribute("href", "/orders/order-1");
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
