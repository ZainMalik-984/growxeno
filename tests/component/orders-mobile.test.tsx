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

vi.mock("@/lib/order-updates/actions", () => ({
  getItemUpdatesAction: vi.fn(async () => ({ ok: false, error: "Not in this test." })),
  postItemUpdateAction: vi.fn(),
  requestScreenshotsAction: vi.fn(),
  requestWithdrawAction: vi.fn(),
  keepWithWorkerAction: vi.fn(),
}));
vi.mock("@/lib/youtube/actions", () => ({ refreshOrderItemStatsAction: vi.fn() }));

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

/** The orders list: one row per order, the same markup on phones and desktop (2026-11-15). */
const cards = () => within(screen.getByRole("list", { name: "Orders" }));

describe("Orders list", () => {
  it("shows one row per order that opens the order", () => {
    render(<OrdersTable rows={[order()]} showCustomer showAmount />);
    const card = cards();
    expect(card.getByRole("link", { name: "Open order #3" })).toHaveAttribute("href", "/orders/order-3");
    expect(card.getByRole("img", { name: "12% done" })).toBeInTheDocument();
    expect(card.getByText("#3")).toBeInTheDocument();
    expect(card.getByText("Said")).toBeInTheDocument();
    expect(card.getByText("Youtube · Watch Hours")).toBeInTheDocument();
    expect(card.getByText("Samir B")).toBeInTheDocument();
    expect(card.getAllByText("Processing").length).toBeGreaterThan(0);
    expect(card.getAllByText("32 USD").length).toBeGreaterThan(0);
  });

  it("shows the category logo and the service's own name when given", () => {
    const base = order().items[0]!;
    render(<OrdersTable rows={[order({ items: [{ ...base, serviceTitle: "Watch Hours", categoryName: "Youtube", categoryImageUrl: null }] })]} showCustomer showAmount />);
    expect(cards().getByText("Watch Hours")).toBeInTheDocument();
    expect(cards().queryByText("Youtube · Watch Hours")).toBeNull();
  });

  it("opens the items with who has them and delivered out of needed", async () => {
    const user = userEvent.setup();
    render(<OrdersTable rows={[order()]} showCustomer showAmount />);
    await user.click(cards().getByRole("button", { name: "Show the items of order #3" }));
    const items = within(screen.getByRole("list", { name: "Items of order #3" }));
    expect(items.getByText("Inzmam")).toBeInTheDocument();
    expect(items.getByText(/of 1,000 watch hours/)).toHaveTextContent("120 of 1,000 watch hours · now 775");
  });

  it("shows the Fiverr profile name for a Fiverr order", () => {
    render(<OrdersTable rows={[order({ source: { kind: "FIVERR", profileName: "growxeno_pro", reference: null } })]} showCustomer showAmount />);
    expect(cards().getByText("growxeno_pro")).toBeInTheDocument();
  });

  it("opens an External order's source details from its button", async () => {
    const user = userEvent.setup();
    render(
      <OrdersTable
        rows={[
          order({
            source: {
              kind: "EXTERNAL",
              reference: "WA-77",
              orderDate: new Date("2026-11-10T10:00:00Z"),
              notes: "Came in on WhatsApp",
              customer: { name: "Said", email: "said@example.com", phone: null },
            },
          }),
        ]}
        showCustomer
        showAmount
      />,
    );
    await user.click(cards().getByRole("button", { name: "External" }));
    // The popup must not sit inside a paragraph (a hydration error, 2026-11-15).
    expect(screen.getByRole("dialog", { hidden: true }).closest("p")).toBeNull();
    const dialog = within(screen.getByRole("dialog", { hidden: true }));
    expect(dialog.getByText("WA-77")).toBeInTheDocument();
    expect(dialog.getByText("said@example.com")).toBeInTheDocument();
    expect(dialog.getByText("Came in on WhatsApp")).toBeInTheDocument();
  });

  it("shows no source when the viewer may not see it", () => {
    render(<OrdersTable rows={[order({ source: null })]} showCustomer showAmount />);
    expect(cards().queryByRole("button", { name: "External" })).toBeNull();
  });

  it("lets the team post an update on an item from the list", async () => {
    const user = userEvent.setup();
    render(<OrdersTable canPostUpdates rows={[order()]} showCustomer showAmount />);
    await user.click(cards().getByRole("button", { name: "Actions for order #3" }));
    expect(within(screen.getByRole("menu", { name: "Actions for order #3" })).getByRole("menuitem", { name: "Post update" })).toBeInTheDocument();
  });

  it("shows new updates on the order and its item", async () => {
    const user = userEvent.setup();
    const base = order().items[0]!;
    render(<OrdersTable canPostUpdates rows={[order({ unreadUpdates: 1, items: [{ ...base, unreadUpdates: 1 }] })]} showCustomer showAmount />);
    expect(cards().getByRole("button", { name: "1 new update. Open" })).toBeInTheDocument();
    await user.click(cards().getByRole("button", { name: "Show the items of order #3" }));
    expect(within(screen.getByRole("list", { name: "Items of order #3" })).getByRole("button", { name: "1 new update. Open" })).toBeInTheDocument();
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

  it("names the extra services and offers Accept on the worker's own pending items in the menu", async () => {
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
    expect(cards().getByText("+1 more")).toBeInTheDocument();
    await user.click(cards().getByRole("button", { name: "Actions for order #3" }));
    const menu = within(screen.getByRole("menu", { name: "Actions for order #3" }));
    expect(menu.getByRole("menuitem", { name: "Open order" })).toHaveAttribute("href", "/orders/order-3");
    await user.click(menu.getByRole("menuitem", { name: "Accept 2 tasks" }));
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

  it("filters by Fiverr account when the list is given (admins and employees)", async () => {
    const user = userEvent.setup();
    search = "";
    render(<OrderFilterBar initialSearch="" {...pickers} fiverrAccounts={[{ id: "11111111-1111-4111-8111-111111111111", label: "Alina" }]} />);
    await user.click(screen.getByRole("button", { name: "Filter" }));
    const sheet = within(screen.getByRole("dialog", { hidden: true }));
    await user.selectOptions(sheet.getByRole("combobox", { name: "Fiverr account", hidden: true }), "Alina");
    expect(replace).toHaveBeenLastCalledWith("/orders?fiverrAccount=11111111-1111-4111-8111-111111111111", { scroll: false });
  });

  it("has no Fiverr account filter without the list", async () => {
    const user = userEvent.setup();
    search = "";
    render(<OrderFilterBar initialSearch="" {...pickers} />);
    await user.click(screen.getByRole("button", { name: "Filter" }));
    expect(within(screen.getByRole("dialog", { hidden: true })).queryByRole("combobox", { name: "Fiverr account", hidden: true })).toBeNull();
  });

  it("counts the active filters on the Filter button", () => {
    search = "overdue=1&customer=c1&q=abc&status=PENDING";
    render(<OrderFilterBar initialSearch="abc" {...pickers} />);
    // Search text and the status tab are on screen already, so only 2 count.
    expect(screen.getByRole("button", { name: /^Filter/ })).toHaveTextContent("Filter2");
  });
});
