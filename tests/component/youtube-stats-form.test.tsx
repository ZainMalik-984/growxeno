import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const save = vi.fn<(input: unknown) => Promise<{ ok: true; message: string }>>(async () => ({ ok: true, message: "Saved." }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/settings/actions", () => ({ saveYoutubeStatsSettingsAction: (input: unknown) => save(input) }));

const { YoutubeStatsForm } = await import("@/app/(app)/settings/system/youtube-stats-form");

describe("YoutubeStatsForm", () => {
  it("says when the API key is missing", () => {
    render(<YoutubeStatsForm initial={{ enabled: true, intervalHours: 6 }} canEdit apiKeyConfigured={false} />);
    expect(screen.getByText(/Not connected yet/)).toBeInTheDocument();
  });

  it("saves a new interval", async () => {
    const user = userEvent.setup();
    render(<YoutubeStatsForm initial={{ enabled: true, intervalHours: 6 }} canEdit apiKeyConfigured />);
    expect(screen.getByText("Connected to the YouTube Data API.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Refresh every"), "24");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(save).toHaveBeenCalledWith({ enabled: true, intervalHours: 24 });
  });

  it("can turn the automatic refresh off", async () => {
    const user = userEvent.setup();
    render(<YoutubeStatsForm initial={{ enabled: true, intervalHours: 6 }} canEdit apiKeyConfigured />);
    await user.click(screen.getByLabelText(/Refresh stats automatically/));
    expect(screen.getByLabelText("Refresh every")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(save).toHaveBeenLastCalledWith({ enabled: false, intervalHours: 6 });
  });
});
