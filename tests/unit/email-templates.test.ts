import { describe, expect, it } from "vitest";

import { assetBase, renderEmail } from "@/lib/email/layout";
import { inviteEmail, passwordResetEmail, taskAssignedEmail } from "@/lib/email/templates";

/** The branded email layout and the four emails the app sends (2026-11-12). */

describe("email layout", () => {
  const base = { preheader: "Pre", title: "Hello", paragraphs: ["One", "Two"], footerReason: "Because.", appUrl: "https://www.growxeno.com" };

  it("renders a full branded HTML page with the logo, title, button and footer", () => {
    const { html } = renderEmail({ ...base, button: { label: "Go", url: "https://example.com/x?a=1&b=2" } });
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('src="https://www.growxeno.com/brand/grow-xeno-wordmark.png"');
    expect(html).toContain(">Hello</h1>");
    expect(html).toContain('href="https://example.com/x?a=1&amp;b=2"');
    expect(html).toContain("Because.");
  });

  it("escapes everything it is given", () => {
    const { html } = renderEmail({ ...base, title: "<script>alert(1)</script>", details: [{ label: "Link", value: "x", href: "javascript:alert(1)" }] });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("javascript:");
  });

  it("writes a matching plain-text version", () => {
    const { text } = renderEmail({ ...base, details: [{ label: "Order", value: "#3" }], button: { label: "Open", url: "https://x.test" } });
    expect(text).toContain("Hello");
    expect(text).toContain("Order: #3");
    expect(text).toContain("Open: https://x.test");
  });

  it("loads images from the live site when run locally", () => {
    expect(assetBase("http://localhost:3000")).toBe("https://www.growxeno.com");
    expect(assetBase("https://staging.growxeno.com/")).toBe("https://staging.growxeno.com");
  });
});

describe("the emails", () => {
  it("1. new task: need / current / stop at, link, pay, deadline and Accept", () => {
    const email = taskAssignedEmail({
      workerName: "Inzmam Ul Haq",
      orderNumber: 3,
      serviceName: "Youtube · Watch Hours",
      channelLink: "https://www.youtube.com/@samir",
      figures: { unit: "watch hours", need: 1000, current: 655, stopAt: 1655 },
      payLabel: "400.00 PKR",
      deadlineLabel: "23 Nov 2026, 04:47 UTC",
      acceptUrl: "https://www.growxeno.com/orders?open=item-1",
      appUrl: "https://www.growxeno.com",
    });
    expect(email.subject).toBe("New task: Youtube · Watch Hours (order #3)");
    expect(email.html).toContain("Hi Inzmam,");
    expect(email.html).toContain("1,000 watch hours");
    expect(email.html).toContain("1,655");
    expect(email.html).toContain("400.00 PKR");
    expect(email.html).toContain(">Accept task</a>");
    expect(email.text).toContain("Need: 1,000 watch hours");
  });

  it("2 and 3. invitations for a worker and for the team", () => {
    const worker = inviteEmail({ fullName: "Zain Ul Abideen", link: "https://l", kind: "worker", appUrl: "https://www.growxeno.com" });
    const team = inviteEmail({ fullName: "Sara", link: "https://l", kind: "team", appUrl: "https://www.growxeno.com" });
    expect(worker.subject).toBe("Your Grow Xeno portal invitation");
    expect(worker.html).toContain("tasks assigned to you");
    expect(team.subject).toBe("You're invited to Grow Xeno");
    expect(team.html).toContain(">Set your password</a>");
  });

  it("4. password reset", () => {
    const email = passwordResetEmail({ link: "https://l", appUrl: "https://www.growxeno.com", contactEmail: "info@growxeno.com" });
    expect(email.subject).toBe("Reset your Grow Xeno password");
    expect(email.html).toContain(">Reset password</a>");
    expect(email.html).toContain("mailto:info@growxeno.com");
  });
});
