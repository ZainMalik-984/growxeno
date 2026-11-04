import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkerDeadlineSettingsForm } from "@/app/(app)/settings/system/worker-deadline-settings-form";
import { DEFAULT_WORKER_DEADLINE_SETTINGS } from "@/lib/settings/worker-deadline";

const save = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/settings/actions", () => ({ saveWorkerDeadlineSettingsAction: save }));

const previewRow = (orderDays: string) => {
  const table = screen.getByRole("table");
  return within(table).getByText(orderDays).closest("tr")!;
};

describe("WorkerDeadlineSettingsForm", () => {
  beforeEach(() => save.mockReset().mockResolvedValue({ ok: true, message: "Settings saved." }));

  it("shows the saved rules and a live preview", () => {
    render(<WorkerDeadlineSettingsForm initial={DEFAULT_WORKER_DEADLINE_SETTINGS} canEdit lastSaved={null} />);
    expect(screen.getByLabelText("Default days early")).toHaveValue("1");
    expect(screen.getAllByLabelText("Minimum days until the order deadline").map((el) => (el as HTMLInputElement).value)).toEqual(["50", "10"]);
    // 60-day order -> 5 days early -> worker due in 55 days.
    expect(previewRow("60 days")).toHaveTextContent("55 days−5 days");
    // 15-day order -> 4 days early.
    expect(previewRow("15 days")).toHaveTextContent("11 days−4 days");
    // 2-day order -> default 1 day.
    expect(previewRow("2 days")).toHaveTextContent("1 day−1 day");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("updates the preview as rules change, and saves them", async () => {
    const user = userEvent.setup();
    render(<WorkerDeadlineSettingsForm initial={DEFAULT_WORKER_DEADLINE_SETTINGS} canEdit lastSaved={null} />);

    const defaultDays = screen.getByLabelText("Default days early");
    await user.clear(defaultDays);
    await user.type(defaultDays, "2");
    expect(previewRow("7 days")).toHaveTextContent("5 days−2 days");

    await user.click(screen.getByRole("button", { name: "Add rule" }));
    const mins = screen.getAllByLabelText("Minimum days until the order deadline");
    const buffers = screen.getAllByLabelText("Days early for the worker");
    await user.type(mins[2], "30");
    await user.type(buffers[2], "3");
    expect(previewRow("30 days")).toHaveTextContent("27 days−3 days");

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(save).toHaveBeenCalledWith({
      defaultDays: 2,
      tiers: [
        { minLeadDays: 50, bufferDays: 5 },
        { minLeadDays: 10, bufferDays: 4 },
        { minLeadDays: 30, bufferDays: 3 },
      ],
    });
  });

  it("is read-only without settings.edit", () => {
    render(<WorkerDeadlineSettingsForm initial={DEFAULT_WORKER_DEADLINE_SETTINGS} canEdit={false} lastSaved={null} />);
    expect(screen.getByLabelText("Default days early")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add rule" })).toBeNull();
  });
});
