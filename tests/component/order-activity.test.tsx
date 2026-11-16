import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { OrderActivityFeed } from "@/app/(app)/orders/[id]/order-activity";
import type { OrderActivityRow } from "@/lib/orders/queries";

const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);
const entry = (id: string, action: string, summary: string, actorLabel: string | null, minutesAgo = 5): OrderActivityRow => ({
  id,
  action,
  summary,
  actorLabel,
  createdAt: at(minutesAgo),
});

describe("OrderActivityFeed", () => {
  it("lays out who, the item and the status change", () => {
    render(
      <OrderActivityFeed
        entries={[entry("a", "order_item.status_changed", 'Growth Bridge changed the item status of "Youtube · Watch Hours" on order #2 from Done to Refill', "Growth Bridge")]}
      />,
    );
    expect(screen.getByText("Growth Bridge")).toBeInTheDocument();
    expect(screen.getByText("changed the status")).toBeInTheDocument();
    expect(screen.getByTitle("Youtube · Watch Hours")).toHaveTextContent("Watch Hours");
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Refill")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Today" })).toBeInTheDocument();
  });

  it("marks automatic entries and shows who an item went to and for how much", () => {
    render(
      <OrderActivityFeed
        entries={[
          entry("a", "order.status_changed", "Order #5 is now Processing (updated automatically from its items)", null),
          entry("b", "order_item.assigned", 'Assigned "Subscribers" on order #5 to Inzmam at 400.00 PKR', "Growth Bridge"),
        ]}
      />,
    );
    expect(screen.getByText("Auto")).toBeInTheDocument();
    expect(screen.getByText("Inzmam")).toBeInTheDocument();
    expect(screen.getByText("400.00 PKR")).toBeInTheDocument();
  });

  it("shows the first twelve, then all on request", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 15 }, (_, i) => entry(String(i), "order.note_added", "Added a note to order #4", "Ali", i));
    render(<OrderActivityFeed entries={many} />);
    expect(screen.getAllByText("added a note")).toHaveLength(12);
    await user.click(screen.getByRole("button", { name: "Show all 15" }));
    expect(screen.getAllByText("added a note")).toHaveLength(15);
    expect(within(screen.getByRole("region", { name: "Today" })).getAllByRole("listitem").length).toBeGreaterThan(0);
  });
});
