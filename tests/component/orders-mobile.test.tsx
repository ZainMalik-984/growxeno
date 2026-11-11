import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { OrdersTableRow } from "@/app/(app)/orders/orders-table";

/** The phone layout of the Orders page (2026-11-11): order cards and the filter sheet. */

const changeStatus = vi.fn<(input: { itemId: string; status: string }) => Promise<{ ok: true; message: string }>>(async () => ({
  ok: true,
  message: "ok",
}));
const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace }),
  usePathname: () => "/orders",
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/orders/actions", () => ({
  changeOrderItemStatusAction: (input: { itemId: string; status: string }) => changeStatus(input),
}));

const { OrdersTable } = await import("@/app/(app)/orders/orders-table");
const { OrderFilterBar } = await import("@/app/(app)/orders/order-filter-bar");

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

function order(overrides: Partial<OrdersTableRow> = {}): OrdersTableRow {
  return {
    id: "order-3",
    orderNumber: 3,
    customerName: "Said",
    statusLabel: "Processing",
    statusTone: "progress",
    deadline: null,
    finished: false,
    isOverdue: false,
    itemCount: 1,
    amountLabel: "32 USD",
    progressPercent: 12,
    channels: [{ href: "https://www.youtube.com/@samir", label: "youtube.com/@samir", title: "Samir B" }],
    openRequests: 0,
    withdrawRequests: 0,
    items: [
      {
        id: "item-1",
        channel: null,
        canAccept: false,
        serviceName: "Youtube · Watch Hours",
        assigneeLabel: "Inzmam",
        statusLabel: "Processing",
        statusTone: "progress",
        metricLabel: "watch hours",
        startingCount: 655,
        currentCount: 775,
        targetCount: 1655,
      },
    ],
    ...overrides,
  };
}

/** The phone card list is the first list; the desktop table is hidden by CSS from `md` up. */
const cards = () => within(screen.getAllByRole("list")[0]!);

describe("Orders on a phone", () => {
  it("shows one card per order that opens the order", () => {
    render(<OrdersTable rows={[order()]} showCustomer showAmount />);
    const card = cards();
    expect(card.getByRole("link", { name: "Open order #3" })).toHaveAttribute("href", "/orders/order-3");
    expect(card.getByText("#3")).toBeInTheDocument();
    expect(card.getByText("Said")).toBeInTheDocument();
    expect(card.getByText("Youtube · Watch Hours")).toBeInTheDocument();
    expect(card.getByText("Samir B")).toBeInTheDocument();
    expect(card.getByText("Processing")).toBeInTheDocument();
    expect(card.getByText("32 USD")).toBeInTheDocument();
  });

  it("shows delivered out of needed, not the channel's total", () => {
    render(<OrdersTable rows={[order()]} showCustomer showAmount />);
    expect(cards().getByText(/watch hours delivered/).closest("p")).toHaveTextContent("120 / 1,000 watch hours delivered · now 775");
  });

  it("flags an order whose worker can't continue", () => {
    render(<OrdersTable rows={[order({ withdrawRequests: 1 })]} showCustomer showAmount />);
    expect(cards().getByText("Can't continue")).toBeInTheDocument();
  });

  it("flags an order whose worker is waiting on screenshots", () => {
    render(<OrdersTable rows={[order({ openRequests: 1 })]} showCustomer showAmount />);
    expect(cards().getByText("Screenshots requested")).toBeInTheDocument();
  });

  it("hides the customer and amount when the viewer may not see them", () => {
    render(<OrdersTable rows={[order({ customerName: null, amountLabel: null })]} showCustomer={false} showAmount={false} />);
    expect(cards().queryByText("Said")).toBeNull();
    expect(cards().queryByText("32 USD")).toBeNull();
  });

  it("names the extra services and offers Accept on the worker's own pending items", async () => {
    const user = userEvent.setup();
    const base = order().items[0]!;
    render(
      <OrdersTable
        rows={[
          order({
            itemCount: 2,
            items: [
              { ...base, id: "p1", canAccept: true, statusLabel: "Pending" },
              { ...base, id: "p2", serviceName: "Youtube · Subscribers", canAccept: true, statusLabel: "Pending" },
            ],
          }),
        ]}
        showCustomer
        showAmount
      />,
    );
    expect(cards().getByText("Youtube · Watch Hours +1 more")).toBeInTheDocument();
    await user.click(cards().getByRole("button", { name: /Accept 2/ }));
    expect(changeStatus).toHaveBeenCalledWith({ itemId: "p1", status: "PROCESSING" });
    expect(changeStatus).toHaveBeenCalledWith({ itemId: "p2", status: "PROCESSING" });
  });
});

describe("Order filters on a phone", () => {
  const pickers = { customers: [], workers: [], outsourcedWorkers: [], services: [], categories: [] };

  it("opens a sheet with the quick filters and applies one", async () => {
    const user = userEvent.setup();
    search = "";
    render(<OrderFilterBar initialSearch="" {...pickers} />);
    await user.click(screen.getByRole("button", { name: "Filter" }));
    const sheet = screen.getByRole("dialog", { hidden: true });
    expect(within(sheet).getByRole("heading", { name: "Filters", hidden: true })).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Due today", hidden: true }));
    expect(replace).toHaveBeenLastCalledWith("/orders?dueToday=1", { scroll: false });
    await user.click(within(sheet).getByRole("button", { name: "Show results", hidden: true }));
    expect(sheet).not.toHaveAttribute("open");
  });

  it("counts the active filters on the Filter button", () => {
    search = "overdue=1&customer=c1&q=abc&status=PENDING";
    render(<OrderFilterBar initialSearch="abc" {...pickers} />);
    // Search text and the status tab are on screen already, so only 2 count.
    expect(screen.getByRole("button", { name: /^Filter/ })).toHaveTextContent("Filter2");
  });
});
