import { renderEmail } from "./layout";

/**
 * Every email the app sends (2026-11-12), on the branded layout:
 *   1. taskAssignedEmail — a worker's new task (on assign, reassign, and
 *      "Message worker → Send email");
 *   2. inviteEmail (kind "worker") — portal access for an outsourced worker;
 *   3. inviteEmail (kind "team") — a new employee or admin;
 *   4. passwordResetEmail — "Forgot password".
 * Each returns the subject, the HTML and a plain-text version.
 */

export type RenderedEmail = { subject: string; html: string; text: string };

const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] || "there";
const number = new Intl.NumberFormat("en-US");

export function taskAssignedEmail(input: {
  workerName: string;
  orderNumber: number;
  serviceName: string;
  channelLink: string | null;
  /** Need / current / stop at, for a task with a count. */
  figures: { unit: string; need: number; current: number; stopAt: number } | null;
  /** "1,600.00 PKR", when set. */
  payLabel: string | null;
  /** "23 Nov 2026, 09:47 UTC", when set. */
  deadlineLabel: string | null;
  acceptUrl: string;
  appUrl: string;
  contactEmail?: string;
}): RenderedEmail {
  const { html, text } = renderEmail({
    preheader: input.figures
      ? `${number.format(input.figures.need)} ${input.figures.unit} on order #${input.orderNumber}. Open it to accept.`
      : `${input.serviceName} on order #${input.orderNumber}. Open it to accept.`,
    eyebrow: `New task · Order #${input.orderNumber}`,
    title: input.serviceName,
    greeting: `Hi ${firstName(input.workerName)},`,
    paragraphs: ["You've been assigned a new task. Here's what's needed:"],
    figures: input.figures
      ? [
          { label: "Need", value: `${number.format(input.figures.need)} ${input.figures.unit}`, strong: true },
          { label: `Current`, value: number.format(input.figures.current) },
          { label: "Stop at", value: number.format(input.figures.stopAt) },
        ]
      : undefined,
    details: [
      ...(input.channelLink ? [{ label: "Link", value: input.channelLink.replace(/^https?:\/\/(www\.)?/i, ""), href: input.channelLink }] : []),
      ...(input.payLabel ? [{ label: "You earn", value: input.payLabel }] : []),
      ...(input.deadlineLabel ? [{ label: "Deadline", value: input.deadlineLabel }] : []),
    ],
    button: { label: "Accept task", url: input.acceptUrl },
    note: "Accept it to start. Post updates, screenshots and your progress from the task in the portal.",
    footerReason: "You're receiving this because you work on tasks for Grow Xeno.",
    appUrl: input.appUrl,
    contactEmail: input.contactEmail,
  });
  return { subject: `New task: ${input.serviceName} (order #${input.orderNumber})`, html, text };
}

export function inviteEmail(input: { fullName: string; link: string; kind: "worker" | "team"; appUrl: string; contactEmail?: string }): RenderedEmail {
  const worker = input.kind === "worker";
  const { html, text } = renderEmail({
    preheader: worker ? "Set your password to see your tasks and earnings." : "Set your password to get started.",
    eyebrow: "Invitation",
    title: worker ? "Welcome to the Grow Xeno portal" : "You're invited to Grow Xeno",
    greeting: `Hi ${firstName(input.fullName)},`,
    paragraphs: worker
      ? [
          "You've been given access to the Grow Xeno portal. There you'll see the tasks assigned to you, accept them, post your progress and screenshots, and track what you've earned.",
          "Set your password to get started:",
        ]
      : ["You've been given access to Grow Xeno Business Manager.", "Set your password to get started:"],
    button: { label: "Set your password", url: input.link },
    note: "This link works once and expires after 24 hours. If it has expired, ask us to send a new invitation.",
    footerReason: "You're receiving this because someone at Grow Xeno invited you.",
    appUrl: input.appUrl,
    contactEmail: input.contactEmail,
  });
  return { subject: worker ? "Your Grow Xeno portal invitation" : "You're invited to Grow Xeno", html, text };
}

export function passwordResetEmail(input: { link: string; appUrl: string; contactEmail?: string }): RenderedEmail {
  const { html, text } = renderEmail({
    preheader: "Use this link to choose a new password.",
    eyebrow: "Account",
    title: "Reset your password",
    paragraphs: ["We received a request to reset the password for your Grow Xeno account. Choose a new one with the button below."],
    button: { label: "Reset password", url: input.link },
    note: "This link works once and expires after an hour. If you didn't ask for this, you can ignore this email; your password stays the same.",
    footerReason: "You're receiving this because a password reset was requested for this address.",
    appUrl: input.appUrl,
    contactEmail: input.contactEmail,
  });
  return { subject: "Reset your Grow Xeno password", html, text };
}
