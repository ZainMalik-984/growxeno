import { describe, expect, it } from "vitest";

import {
  amountProblem,
  clampDone,
  formatSpan,
  markShare,
  remainingToAllocate,
  requiredAmount,
  shareDuration,
  shareMessage,
} from "@/lib/team/rules";
import { whatsappUrl } from "@/lib/orders/assignment-message";

/** An outsourced worker's own team: splitting a task among their people (2026-11-17). */

const watchHours = { metricType: "WATCH_HOURS" as const, startingCount: 200, targetCount: 4200 };
const website = { metricType: null, startingCount: null, targetCount: null };

describe("splitting a task", () => {
  it("splits what the task asks for, not its target", () => {
    expect(requiredAmount(watchHours)).toBe(4000);
    expect(requiredAmount(website)).toBeNull();
  });

  it("offers what's left as the next person's amount", () => {
    expect(remainingToAllocate(watchHours, [])).toBe(4000);
    expect(remainingToAllocate(watchHours, [{ id: "a", amount: 2500 }])).toBe(1500);
    expect(remainingToAllocate(watchHours, [{ id: "a", amount: 2500 }, { id: "b", amount: 1500 }])).toBe(0);
    // Editing a share doesn't count its own old amount.
    expect(remainingToAllocate(watchHours, [{ id: "a", amount: 2500 }, { id: "b", amount: 1500 }], "a")).toBe(2500);
  });

  it("refuses more than is left, and nothing at all", () => {
    const shares = [{ id: "a", amount: 2500 }];
    expect(amountProblem(watchHours, shares, 1500)).toBeNull();
    expect(amountProblem(watchHours, shares, 1501)).toBe("Only 1,500 is left to assign.");
    expect(amountProblem(watchHours, [...shares, { id: "b", amount: 1500 }], 1)).toBe("Everything on this task is already assigned.");
    expect(amountProblem(watchHours, shares, 0)).toBe("Enter how much they'll do.");
    expect(amountProblem(watchHours, shares, null)).toBe("Enter how much they'll do.");
    expect(amountProblem(watchHours, shares, 2.5)).toBe("Enter how much they'll do.");
  });

  it("takes an optional amount with no ceiling on a task without a count", () => {
    expect(amountProblem(website, [], null)).toBeNull();
    expect(amountProblem(website, [{ id: "a", amount: 50 }], 10)).toBeNull();
    expect(amountProblem(website, [], 0)).toBe("Enter a whole number above 0, or leave it empty.");
    expect(amountProblem(website, [], 1.5)).toBe("Enter a whole number above 0, or leave it empty.");
    expect(remainingToAllocate(website, [])).toBeNull();
  });

  it("keeps progress between nothing and their part", () => {
    expect(clampDone(1800, 2500)).toBe(1800);
    expect(clampDone(3000, 2500)).toBe(2500);
    expect(clampDone(-5, 2500)).toBe(0);
    expect(clampDone(12.6, null)).toBe(13);
  });
});

describe("two statuses", () => {
  const now = new Date("2026-11-17T10:00:00Z");

  it("is done only when marked, with the finish time; reopening clears it", () => {
    expect(markShare("DONE", now)).toEqual({ status: "DONE", finishedAt: now });
    expect(markShare("PROCESSING", now)).toEqual({ status: "PROCESSING", finishedAt: null });
  });

  it("says how long a part took, or how long it's been going", () => {
    const assignedAt = "2026-11-15T06:00:00Z";
    expect(shareDuration({ assignedAt, finishedAt: "2026-11-17T08:30:00Z", status: "DONE" }, now)).toBe("Took 2d 2h");
    expect(shareDuration({ assignedAt, finishedAt: null, status: "PROCESSING" }, now)).toBe("2d 4h so far");
    expect(shareDuration({ assignedAt: now, finishedAt: null, status: "PROCESSING" }, now)).toBe("Just started");
    expect(shareDuration({ assignedAt: now, finishedAt: now, status: "DONE" }, now)).toBe("Took under a minute");
  });

  it("formats spans briefly", () => {
    expect(formatSpan(0)).toBe("just now");
    expect(formatSpan(8 * 60_000)).toBe("8m");
    expect(formatSpan(190 * 60_000)).toBe("3h 10m");
    expect(formatSpan(3 * 86_400_000)).toBe("3d");
  });
});

describe("WhatsApp message to a team member", () => {
  const input = {
    ...watchHours,
    memberName: "Ali Raza",
    orderNumber: 12,
    serviceName: "Youtube · Watch Hours",
    channelLink: "https://youtube.com/@channel",
    amount: 2500,
    note: "Use the second account",
  };

  it("names their part of the task", () => {
    expect(shareMessage(input)).toBe(
      ["Link: https://youtube.com/@channel", "Your part: 2,500 watch hours", "Note: Use the second account"].join("\n"),
    );
  });

  it("leaves out what a task doesn't have, with no heading line", () => {
    expect(shareMessage({ ...website, memberName: "Sara", orderNumber: 3, serviceName: "Website", channelLink: null, amount: null, note: "Homepage first" })).toBe(
      "Note: Homepage first",
    );
  });

  it("gives a plain amount on a task without a count", () => {
    expect(shareMessage({ ...website, memberName: "Sara", orderNumber: 3, serviceName: "Website", channelLink: null, amount: 5, note: null })).toContain("Your part: 5");
  });

  it("opens a chat only when the member has a number", () => {
    expect(whatsappUrl("+92 300 1234567", "hi")).toBe("https://wa.me/923001234567?text=hi");
    expect(whatsappUrl(null, "hi")).toBeNull();
  });
});
