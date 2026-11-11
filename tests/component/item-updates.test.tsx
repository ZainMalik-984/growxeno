import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ItemUpdatesThread } from "@/lib/order-updates/service";

/** The order item updates thread (2026-11-11): bubbles, the count, text and screenshots. */

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function thread(overrides: Partial<ItemUpdatesThread> = {}): ItemUpdatesThread {
  return {
    itemId: "item-1",
    orderNumber: 3,
    serviceName: "Youtube · Watch Hours",
    metricLabel: "watch hours",
    currentCount: 655,
    startingCount: 655,
    targetCount: 1655,
    canPost: true,
    canSetCount: true,
    canAsk: false,
    canAnswer: false,
    openRequest: null,
    canWithdraw: false,
    openWithdraw: null,
    updates: [
      {
        id: "u1",
        authorLabel: "Inzmam",
        fromWorker: true,
        mine: false,
        body: "Started the campaign.",
        countValue: 700,
        previousCount: 655,
        images: ["https://storage.example/signed/a.webp"],
        isRequest: false,
        requestType: "SCREENSHOTS",
        resolutionNote: null,
        resolvedAt: null,
        resolvedByLabel: null,
        isAnswer: false,
        createdAt: new Date("2026-11-10T10:00:00Z"),
      },
      {
        id: "u2",
        authorLabel: "Grow Xeno",
        fromWorker: false,
        mine: true,
        body: "Thanks, keep going.",
        countValue: null,
        previousCount: null,
        images: [],
        isRequest: false,
        requestType: "SCREENSHOTS",
        resolutionNote: null,
        resolvedAt: null,
        resolvedByLabel: null,
        isAnswer: false,
        createdAt: new Date("2026-11-10T11:00:00Z"),
      },
    ],
    ...overrides,
  };
}

type ThreadResult = { ok: true; thread: ItemUpdatesThread };
const getUpdates = vi.fn<(input: { itemId: string }) => Promise<ThreadResult>>(async () => ({ ok: true, thread: thread() }));
const postUpdate = vi.fn<(form: FormData) => Promise<ThreadResult & { message: string }>>(async () => ({
  ok: true,
  message: "Update posted.",
  thread: thread(),
}));
const withdraw = vi.fn<(input: { itemId: string; reason: string }) => Promise<{ ok: true; message: string }>>(async () => ({
  ok: true,
  message: "Sent. The team will reassign what's left.",
}));
const askScreenshots = vi.fn<(input: { itemId: string; message: string }) => Promise<{ ok: true; message: string }>>(async () => ({
  ok: true,
  message: "Request sent. The team has been notified.",
}));
vi.mock("@/lib/order-updates/actions", () => ({
  getItemUpdatesAction: (input: { itemId: string }) => getUpdates(input),
  postItemUpdateAction: (form: FormData) => postUpdate(form),
  requestScreenshotsAction: (input: { itemId: string; message: string }) => askScreenshots(input),
  requestWithdrawAction: (input: { itemId: string; reason: string }) => withdraw(input),
}));

const { AskScreenshotsDialog, AskScreenshotsTrigger, CantContinueDialog, CantContinueTrigger, ItemUpdatesSheet, progressSentence, UpdatesTrigger } = await import(
  "@/components/orders/item-updates"
);

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  URL.createObjectURL ??= () => "blob:preview";
  URL.revokeObjectURL ??= () => undefined;
});

beforeEach(() => {
  getUpdates.mockClear();
  postUpdate.mockClear();
});

describe("Updates button", () => {
  it("says Post update with the number of posts, or Updates when read only", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<UpdatesTrigger count={2} canPost onClick={onClick} />);
    expect(screen.getByRole("button", { name: /Post update/ })).toHaveTextContent("2");
    await userEvent.setup().click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
    rerender(<UpdatesTrigger count={0} canPost={false} onClick={onClick} />);
    expect(screen.getByRole("button")).toHaveTextContent(/^Updates$/);
  });
});

describe("Updates thread", () => {
  it("shows the posts like a chat: who, the count change, text and screenshots", async () => {
    render(<ItemUpdatesSheet itemId="item-1" onClose={vi.fn()} />);
    const list = await screen.findByRole("list", { name: "Updates", hidden: true });
    const [first, second] = within(list).getAllByRole("listitem", { hidden: true });
    expect(first).toHaveTextContent("Inzmam · Worker");
    expect(first).toHaveTextContent("Watch hours700(+45)");
    expect(first).toHaveTextContent("Started the campaign.");
    expect(within(first!).getByRole("img", { name: "Screenshot 1", hidden: true })).toHaveAttribute("src", "https://storage.example/signed/a.webp");
    expect(second).toHaveTextContent("You");
    expect(second).toHaveTextContent("Thanks, keep going.");
    expect(screen.getByText(/delivered · now 655/).closest("p")).toHaveTextContent("0 / 1,000 watch hours delivered · now 655");
  });

  it("posts the new count and a note together", async () => {
    const user = userEvent.setup();
    render(<ItemUpdatesSheet itemId="item-1" onClose={vi.fn()} />);
    const count = await screen.findByLabelText("Watch hours now");
    await user.type(count, "775");
    expect(screen.getByText("+120")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Message"), "Halfway there");
    await user.click(screen.getByRole("button", { name: "Send update", hidden: true }));
    expect(postUpdate).toHaveBeenCalledTimes(1);
    const form = postUpdate.mock.calls[0]![0];
    expect(form.get("itemId")).toBe("item-1");
    expect(form.get("count")).toBe("775");
    expect(form.get("body")).toBe("Halfway there");
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("attaches screenshots and can remove one before sending", async () => {
    const user = userEvent.setup();
    render(<ItemUpdatesSheet itemId="item-1" onClose={vi.fn()} />);
    await screen.findByLabelText("Watch hours now");
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "shot.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Add screenshots"), [png, new File([png], "two.png", { type: "image/png" })]);
    expect(screen.getAllByRole("img", { name: /to send/, hidden: true })).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Remove screenshot 1", hidden: true }));
    await user.click(screen.getByRole("button", { name: "Send update", hidden: true }));
    expect(postUpdate.mock.calls[0]![0].getAll("images")).toHaveLength(1);
  });

  it("attaches a screenshot pasted into the message, and still pastes plain text as text", async () => {
    const user = userEvent.setup();
    render(<ItemUpdatesSheet itemId="item-1" onClose={vi.fn()} />);
    const message = await screen.findByLabelText("Message");
    await user.click(message);
    const shot = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "image.png", { type: "image/png" });
    await user.paste({ files: [shot], items: [], types: ["Files"], getData: () => "" } as unknown as DataTransfer);
    expect(await screen.findAllByRole("img", { name: /to send/, hidden: true })).toHaveLength(1);
    expect(message).toHaveValue("");

    await user.paste("Halfway there");
    expect(message).toHaveValue("Halfway there");
    expect(screen.getAllByRole("img", { name: /to send/, hidden: true })).toHaveLength(1);
  });

  it("attaches screenshots dropped on the composer, ignoring other files", async () => {
    render(<ItemUpdatesSheet itemId="item-1" onClose={vi.fn()} />);
    const message = await screen.findByLabelText("Message");
    const form = message.closest("form")!;
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "a.png", { type: "image/png" });
    const pdf = new File(["%PDF"], "b.pdf", { type: "application/pdf" });
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.drop(form, { dataTransfer: { files: [png, pdf], types: ["Files"] } });
    expect(await screen.findAllByRole("img", { name: /to send/, hidden: true })).toHaveLength(1);
  });

  it("won't send an empty update, and explains a bad count", async () => {
    const user = userEvent.setup();
    render(<ItemUpdatesSheet itemId="item-1" onClose={vi.fn()} />);
    await screen.findByLabelText("Watch hours now");
    expect(screen.getByRole("button", { name: "Send update", hidden: true })).toBeDisabled();
    await user.type(screen.getByLabelText("Message"), "x");
    await user.type(screen.getByLabelText("Watch hours now"), "12.5");
    await user.click(screen.getByRole("button", { name: "Send update", hidden: true }));
    expect(postUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert", { hidden: true })).toHaveTextContent("whole number");
  });

  it("hides the composer when the viewer can't post, and the count when they can't set it", async () => {
    getUpdates.mockResolvedValueOnce({ ok: true, thread: thread({ canPost: false, canSetCount: false }) });
    const { unmount } = render(<ItemUpdatesSheet itemId="item-1" onClose={vi.fn()} />);
    await screen.findByRole("list", { name: "Updates", hidden: true });
    expect(screen.queryByLabelText("Message")).toBeNull();
    unmount();

    getUpdates.mockResolvedValueOnce({ ok: true, thread: thread({ canSetCount: false }) });
    render(<ItemUpdatesSheet itemId="item-1" onClose={vi.fn()} />);
    await screen.findByLabelText("Message");
    expect(screen.queryByLabelText("Watch hours now")).toBeNull();
  });
});

const request = (overrides: Partial<ItemUpdatesThread["updates"][number]> = {}): ItemUpdatesThread["updates"][number] => ({
  id: "req-1",
  authorLabel: "Inzmam",
  fromWorker: true,
  mine: false,
  body: "Need Studio watch hours for 28 days",
  countValue: null,
  previousCount: null,
  images: [],
  isRequest: true,
  requestType: "SCREENSHOTS",
  resolutionNote: null,
  resolvedAt: null,
  resolvedByLabel: null,
  isAnswer: false,
  createdAt: new Date("2026-11-11T09:00:00Z"),
  ...overrides,
});

describe("Screenshot requests", () => {
  beforeEach(() => askScreenshots.mockClear());

  it("asks with a message, or just notifies the team when left empty", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AskScreenshotsDialog itemId="item-1" serviceName="Youtube · Watch Hours" onClose={onClose} />);
    const send = screen.getByRole("button", { name: /Just notify the team/, hidden: true });
    await user.click(send);
    expect(askScreenshots).toHaveBeenLastCalledWith({ itemId: "item-1", message: "" });
    expect(onClose).toHaveBeenCalled();
  });

  it("sends the worker's message with the request", async () => {
    const user = userEvent.setup();
    render(<AskScreenshotsDialog itemId="item-1" serviceName="Youtube · Watch Hours" onClose={vi.fn()} />);
    await user.type(screen.getByLabelText(/What do you need/), "Analytics, last 28 days");
    await user.click(screen.getByRole("button", { name: "Send request", hidden: true }));
    expect(askScreenshots).toHaveBeenLastCalledWith({ itemId: "item-1", message: "Analytics, last 28 days" });
  });

  it("shows a waiting request instead of the button once asked", () => {
    const { rerender } = render(<AskScreenshotsTrigger waiting={false} onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Ask for screenshots/ })).toBeInTheDocument();
    rerender(<AskScreenshotsTrigger waiting onClick={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Screenshots requested")).toBeInTheDocument();
  });

  it("shows a request in the thread as waiting, then as answered", async () => {
    getUpdates.mockResolvedValueOnce({ ok: true, thread: thread({ updates: [request()] }) });
    const { unmount } = render(<ItemUpdatesSheet itemId="item-1" onClose={vi.fn()} />);
    expect(await screen.findByText("Inzmam asked for screenshots")).toBeInTheDocument();
    expect(screen.getByText("Need Studio watch hours for 28 days")).toBeInTheDocument();
    expect(screen.getByText("Waiting for the team")).toBeInTheDocument();
    unmount();

    getUpdates.mockResolvedValueOnce({
      ok: true,
      thread: thread({ updates: [request({ resolvedAt: new Date("2026-11-11T10:00:00Z"), resolvedByLabel: "Grow Xeno" })] }),
    });
    render(<ItemUpdatesSheet itemId="item-1" onClose={vi.fn()} />);
    expect(await screen.findByText(/Answered by Grow Xeno/)).toBeInTheDocument();
  });

  it("lets the team answer the open request from the reply box, which closes it", async () => {
    const user = userEvent.setup();
    getUpdates.mockResolvedValueOnce({
      ok: true,
      thread: thread({ canAnswer: true, openRequest: { id: "req-1", authorLabel: "Inzmam", body: null }, updates: [request()] }),
    });
    render(<ItemUpdatesSheet itemId="item-1" onClose={vi.fn()} />);
    const answer = await screen.findByRole("checkbox", { name: /Answer Inzmam's screenshot request/, hidden: true });
    expect(answer).toBeChecked();
    await user.type(screen.getByLabelText("Message"), "Here you go");
    await user.click(screen.getByRole("button", { name: "Send update", hidden: true }));
    expect(postUpdate.mock.calls.at(-1)![0].get("answersRequestId")).toBe("req-1");
  });

  it("posts a normal update when the team unticks Answer", async () => {
    const user = userEvent.setup();
    getUpdates.mockResolvedValueOnce({
      ok: true,
      thread: thread({ canAnswer: true, openRequest: { id: "req-1", authorLabel: "Inzmam", body: null }, updates: [request()] }),
    });
    render(<ItemUpdatesSheet itemId="item-1" onClose={vi.fn()} />);
    await user.click(await screen.findByRole("checkbox", { name: /Answer Inzmam's screenshot request/, hidden: true }));
    await user.type(screen.getByLabelText("Message"), "Unrelated note");
    await user.click(screen.getByRole("button", { name: "Send update", hidden: true }));
    expect(postUpdate.mock.calls.at(-1)![0].get("answersRequestId")).toBeNull();
  });

  it("lets the worker ask from inside the thread", async () => {
    const user = userEvent.setup();
    getUpdates.mockResolvedValue({ ok: true, thread: thread({ canAsk: true }) });
    render(<ItemUpdatesSheet itemId="item-1" onClose={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: /Ask for screenshots/, hidden: true }));
    await user.click(screen.getByRole("button", { name: /Just notify the team/, hidden: true }));
    expect(askScreenshots).toHaveBeenLastCalledWith({ itemId: "item-1", message: "" });
    getUpdates.mockReset();
    getUpdates.mockImplementation(async () => ({ ok: true, thread: thread() }));
  });
});

describe("Can't continue", () => {
  it("says how far the worker got and sends the reason to the team", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CantContinueDialog
        itemId="item-1"
        serviceName="Youtube · Subscribers"
        progress={progressSentence({ startingCount: 0, currentCount: 400, targetCount: 1000 }, "subscribers")}
        onClose={onClose}
      />,
    );
    expect(screen.getByText(/400 of 1,000 subscribers done/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Why\?/), "Traffic dried up");
    await user.click(screen.getByRole("button", { name: "Tell the team", hidden: true }));
    expect(withdraw).toHaveBeenLastCalledWith({ itemId: "item-1", reason: "Traffic dried up" });
    expect(onClose).toHaveBeenCalled();
  });

  it("changes to Waiting for reassignment once sent", () => {
    const { rerender } = render(<CantContinueTrigger sent={false} onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Can't continue/ })).toBeInTheDocument();
    rerender(<CantContinueTrigger sent onClick={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Waiting for reassignment")).toBeInTheDocument();
  });

  it("shows the request in the thread, then how it was resolved", async () => {
    const giveUp = request({ id: "w1", requestType: "WITHDRAW", body: "Traffic dried up" });
    getUpdates.mockResolvedValueOnce({ ok: true, thread: thread({ updates: [giveUp] }) });
    const { unmount } = render(<ItemUpdatesSheet itemId="item-1" onClose={vi.fn()} />);
    expect(await screen.findByText("Inzmam can't continue")).toBeInTheDocument();
    expect(screen.getByText("Waiting for the team to reassign")).toBeInTheDocument();
    unmount();

    getUpdates.mockResolvedValueOnce({
      ok: true,
      thread: thread({
        updates: [{ ...giveUp, resolvedAt: new Date("2026-11-11T12:00:00Z"), resolvedByLabel: "Grow Xeno", resolutionNote: "600 subscribers moved to Taimoor" }],
      }),
    });
    render(<ItemUpdatesSheet itemId="item-1" onClose={vi.fn()} />);
    expect(await screen.findByText("600 subscribers moved to Taimoor · by Grow Xeno")).toBeInTheDocument();
  });

  it("writes nothing about progress for a task without a count", () => {
    expect(progressSentence({ startingCount: null, currentCount: null, targetCount: null }, null)).toBeNull();
  });
});
