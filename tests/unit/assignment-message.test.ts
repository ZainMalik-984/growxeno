import { describe, expect, it, vi } from "vitest";

import { acceptUrlFor, assignmentFigures, buildAssignmentMessage, whatsappUrl } from "@/lib/orders/assignment-message";
import { ResendEmailProvider, textToHtml } from "@/lib/notifications/providers/resend";

const ACCEPT = "https://app.example.com/orders?open=item-1";

describe("buildAssignmentMessage", () => {
  it("writes the watch-hours example the owner gave", () => {
    const { subject, text } = buildAssignmentMessage({
      orderNumber: 12,
      serviceName: "Youtube · Watch Hours",
      metricType: "WATCH_HOURS",
      channelLink: "https://youtube.com/@channel",
      startingCount: 200,
      targetCount: 4200,
      acceptUrl: ACCEPT,
    });
    expect(subject).toBe("New task: Youtube · Watch Hours (order #12)");
    expect(text).toBe(
      [
        "New task · Order #12 · Youtube · Watch Hours",
        "",
        "Link: https://youtube.com/@channel",
        "Need: 4,000 watch hours",
        "Current watch hours: 200",
        "Stop: 4,200 watch hours",
        "",
        "Click to accept:",
        ACCEPT,
      ].join("\n"),
    );
  });

  it("treats a missing starting count as 0", () => {
    expect(assignmentFigures({ metricType: "SUBSCRIBERS", startingCount: null, targetCount: 1000 })).toEqual({
      need: 1000,
      current: 0,
      stop: 1000,
      unit: "subscribers",
    });
  });

  it("leaves out the counts for a service without a metric", () => {
    const { text } = buildAssignmentMessage({
      orderNumber: 3,
      serviceName: "Logo design",
      metricType: null,
      channelLink: null,
      startingCount: null,
      targetCount: null,
      acceptUrl: ACCEPT,
    });
    expect(text).not.toMatch(/Need|Stop|Link:/);
    expect(text).toContain("Click to accept:");
  });
});

describe("whatsappUrl", () => {
  it.each([
    ["+92 300 1234567", "923001234567"],
    ["0092-300-1234567", "923001234567"],
    ["92 300 1234567", "923001234567"],
  ])("normalises %j", (input, digits) => {
    expect(whatsappUrl(input, "Hi there")).toBe(`https://wa.me/${digits}?text=Hi%20there`);
  });

  it("returns null without a number", () => {
    expect(whatsappUrl("", "x")).toBeNull();
    expect(whatsappUrl(null, "x")).toBeNull();
    expect(whatsappUrl("abc", "x")).toBeNull();
  });

  it("encodes the whole message, including new lines", () => {
    expect(whatsappUrl("923001234567", "a\nb & c")).toBe("https://wa.me/923001234567?text=a%0Ab%20%26%20c");
  });
});

describe("acceptUrlFor", () => {
  it("links to the worker's Orders page with the task open", () => {
    expect(acceptUrlFor("https://app.example.com/", "abc")).toBe("https://app.example.com/orders?open=abc");
  });
});

describe("ResendEmailProvider", () => {
  it("posts the email with the API key", async () => {
    const fetchImpl = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({ id: "msg_1" }));
    const provider = new ResendEmailProvider("re_key", "Grow Xeno <tasks@growxeno.com>", fetchImpl);
    const receipt = await provider.sendTemplate({ to: "w@example.com", subject: "New task", body: "Hi\nhttps://x.com/a" });

    expect(receipt).toEqual({ ok: true, providerMessageId: "msg_1" });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer re_key");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ from: "Grow Xeno <tasks@growxeno.com>", to: ["w@example.com"], subject: "New task", text: "Hi\nhttps://x.com/a" });
    expect(body.html).toContain('<a href="https://x.com/a">');
  });

  it("reports Resend's error message", async () => {
    const provider = new ResendEmailProvider("k", "a@b.c", async () =>
      Response.json({ message: "You can only send testing emails to your own email address" }, { status: 403 }),
    );
    expect(await provider.sendTemplate({ to: "x@y.z", subject: "s", body: "b" })).toEqual({
      ok: false,
      error: "Email not sent: You can only send testing emails to your own email address",
    });
  });

  it("never throws on a network failure", async () => {
    const provider = new ResendEmailProvider("k", "a@b.c", async () => {
      throw new Error("offline");
    });
    expect(await provider.sendTemplate({ to: "x@y.z", subject: "s", body: "b" })).toMatchObject({ ok: false });
  });

  it("escapes HTML in the text", () => {
    expect(textToHtml("<b>&")).toContain("&lt;b&gt;&amp;");
  });
});
