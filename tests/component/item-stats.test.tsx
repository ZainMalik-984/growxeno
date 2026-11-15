import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ItemStats } from "@/lib/orders/queries";

const refresh = vi.fn<(input: unknown) => Promise<{ ok: true; message: string }>>(async () => ({ ok: true, message: "Stats updated from YouTube." }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/youtube/actions", () => ({ refreshOrderItemStatsAction: (input: unknown) => refresh(input) }));

const { ItemStatsPanel, RefreshStatsButton } = await import("@/app/(app)/orders/[id]/item-stats");

const CHANNEL = "UCMZRwA4rN6Pjg7fttsSLuVQ";
const ITEM = "3f1e0c1a-8d1e-4a59-9f61-6d1f6f0f9a11";

const channelStats: ItemStats = {
  kind: "CHANNEL",
  sourceId: CHANNEL,
  title: "Test Channel",
  fetchedAt: new Date("2026-11-10T10:00:00Z"),
  error: null,
  tracked: ["subscribers", "views"],
  readings: [
    { id: "r1", takenAt: new Date("2026-11-09T10:00:00Z"), trigger: "INITIAL", subscribers: 1200, views: 90000, likes: null, comments: null, by: "Taimoor" },
    { id: "r2", takenAt: new Date("2026-11-10T10:00:00Z"), trigger: "SCHEDULED", subscribers: 1500, views: 91000, likes: null, comments: null, by: null },
  ],
};

describe("ItemStatsPanel", () => {
  it("shows the other latest counts and their change since the first reading, not the progress one, title, ID or Studio link", () => {
    render(<ItemStatsPanel stats={channelStats} metricType="SUBSCRIBERS" />);
    expect(screen.queryByText("Test Channel")).toBeNull();
    expect(screen.queryByText(CHANNEL)).toBeNull();
    // Subscribers already shows as Current above the panel (2026-11-15).
    expect(screen.queryByText("1,500")).toBeNull();
    expect(screen.getByText("91,000")).toBeInTheDocument();
    expect(screen.getByText("+1,000 since start")).toBeInTheDocument();
    expect(screen.queryByText(/Studio analytics/)).toBeNull();
  });

  it("shows nothing for watch hours, which follow no stats", () => {
    const { container } = render(<ItemStatsPanel stats={{ ...channelStats, tracked: [] }} metricType="WATCH_HOURS" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists every reading, newest first, with the starting point marked", async () => {
    const user = userEvent.setup();
    render(<ItemStatsPanel stats={channelStats} metricType="SUBSCRIBERS" />);
    await user.click(screen.getByRole("button", { name: /History · 2 readings/ }));
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Automatic");
    expect(rows[0]).toHaveTextContent("(+300)");
    expect(rows[1]).toHaveTextContent("Starting point");
  });

  it("shows a stored error", () => {
    render(<ItemStatsPanel stats={{ ...channelStats, error: "No YouTube channel found for that link." }} metricType="SUBSCRIBERS" />);
    expect(screen.getByText("No YouTube channel found for that link.")).toBeInTheDocument();
  });

  it("refreshes on demand from the button beside the progress bar", async () => {
    const user = userEvent.setup();
    render(<RefreshStatsButton itemId={ITEM} fetchedAt={new Date("2026-11-10T10:00:00Z")} />);
    await user.click(screen.getByRole("button", { name: /Refresh/ }));
    expect(refresh).toHaveBeenCalledWith({ itemId: ITEM });
  });

  it("shows likes and comments for a video views item (views already show as Current)", () => {
    render(
      <ItemStatsPanel
        stats={{
          kind: "VIDEO",
          sourceId: "dQw4w9WgXcQ",
          title: "A video",
          fetchedAt: new Date(),
          error: null,
          tracked: ["views", "likes", "comments"],
          readings: [{ id: "v1", takenAt: new Date(), trigger: "INITIAL", subscribers: null, views: 10, likes: null, comments: 3, by: null }],
        }}
        metricType="VIEWS"
      />,
    );
    expect(screen.queryByText("Views")).toBeNull();
    expect(screen.getByText("Likes")).toBeInTheDocument();
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.queryByText("Video ID")).toBeNull();
  });

  it("shows only the stats the service follows (2026-11-13)", () => {
    render(
      <ItemStatsPanel
        stats={{ ...channelStats, tracked: [] }}
        metricType="WATCH_HOURS"
      />,
    );
    expect(screen.queryByText("Subscribers")).toBeNull();
    expect(screen.queryByText("Total views")).toBeNull();
    expect(screen.queryByText(/History/)).toBeNull();
  });
});
