import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ItemStats } from "@/lib/orders/queries";

const refresh = vi.fn<(input: unknown) => Promise<{ ok: true; message: string }>>(async () => ({ ok: true, message: "Stats updated from YouTube." }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/youtube/actions", () => ({ refreshOrderItemStatsAction: (input: unknown) => refresh(input) }));

const { ItemStatsPanel } = await import("@/app/(app)/orders/[id]/item-stats");

const CHANNEL = "UCMZRwA4rN6Pjg7fttsSLuVQ";
const ITEM = "3f1e0c1a-8d1e-4a59-9f61-6d1f6f0f9a11";

const channelStats: ItemStats = {
  kind: "CHANNEL",
  sourceId: CHANNEL,
  title: "Test Channel",
  fetchedAt: new Date("2026-11-10T10:00:00Z"),
  error: null,
  readings: [
    { id: "r1", takenAt: new Date("2026-11-09T10:00:00Z"), trigger: "INITIAL", subscribers: 1200, views: 90000, likes: null, comments: null, by: "Taimoor" },
    { id: "r2", takenAt: new Date("2026-11-10T10:00:00Z"), trigger: "SCHEDULED", subscribers: 1500, views: 91000, likes: null, comments: null, by: null },
  ],
};

describe("ItemStatsPanel", () => {
  it("shows the latest counts, the change since the first reading and the channel ID", () => {
    render(<ItemStatsPanel itemId={ITEM} stats={channelStats} metricType="SUBSCRIBERS" link="https://youtube.com/@test" />);
    expect(screen.getByText("Test Channel")).toBeInTheDocument();
    expect(screen.getByText(CHANNEL)).toBeInTheDocument();
    expect(screen.getByText("1,500")).toBeInTheDocument();
    expect(screen.getByText("+300 since start")).toBeInTheDocument();
    expect(screen.queryByText(/Studio analytics/)).toBeNull();
  });

  it("links watch hours to the channel's Studio analytics", () => {
    render(<ItemStatsPanel itemId={ITEM} stats={channelStats} metricType="WATCH_HOURS" link="https://youtube.com/@test" />);
    expect(screen.getByRole("link", { name: /Open Studio analytics/ })).toHaveAttribute(
      "href",
      `https://studio.youtube.com/channel/${CHANNEL}/analytics/tab-overview/period-default`,
    );
  });

  it("lists every reading, newest first, with the starting point marked", async () => {
    const user = userEvent.setup();
    render(<ItemStatsPanel itemId={ITEM} stats={channelStats} metricType="SUBSCRIBERS" link="https://youtube.com/@test" />);
    await user.click(screen.getByRole("button", { name: /History · 2 readings/ }));
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Automatic");
    expect(rows[0]).toHaveTextContent("(+300)");
    expect(rows[1]).toHaveTextContent("Starting point");
  });

  it("refreshes on demand and shows a stored error", async () => {
    const user = userEvent.setup();
    render(
      <ItemStatsPanel
        itemId={ITEM}
        stats={{ ...channelStats, error: "No YouTube channel found for that link." }}
        metricType="SUBSCRIBERS"
        link="https://youtube.com/@test"
      />,
    );
    expect(screen.getByText("No YouTube channel found for that link.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Refresh/ }));
    expect(refresh).toHaveBeenCalledWith({ itemId: ITEM });
  });

  it("shows views, likes and comments for a video", () => {
    render(
      <ItemStatsPanel
        itemId={ITEM}
        stats={{
          kind: "VIDEO",
          sourceId: "dQw4w9WgXcQ",
          title: "A video",
          fetchedAt: new Date(),
          error: null,
          readings: [{ id: "v1", takenAt: new Date(), trigger: "INITIAL", subscribers: null, views: 10, likes: null, comments: 3, by: null }],
        }}
        metricType="VIEWS"
        link="https://youtu.be/dQw4w9WgXcQ"
      />,
    );
    expect(screen.getByText("Views")).toBeInTheDocument();
    expect(screen.getByText("Likes")).toBeInTheDocument();
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.getByText("Video ID")).toBeInTheDocument();
  });
});
