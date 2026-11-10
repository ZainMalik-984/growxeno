import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getAppUrl } from "@/lib/env";
import { getEmailProvider } from "@/lib/notifications/providers";
import { wantsEmail, wantsWhatsapp } from "@/lib/outsourced-workers/notify-via";
import { serviceLabel } from "@/lib/services/label";
import type { ServiceMetricType } from "@/lib/services/metric-type";
import { acceptUrlFor, buildAssignmentMessage, whatsappUrl } from "./assignment-message";

/**
 * Tells an External Worker about a task assigned to them (owner request,
 * 2026-11-11), on the channel(s) set on their profile (`notifyVia`):
 *   - email: sent by the app through Resend, logged in `message_logs`;
 *   - WhatsApp: a prefilled `wa.me` link returned to the admin, who taps Send
 *     (no WhatsApp Business account, owner's choice).
 * Runs AFTER the assignment has been saved, so a mail problem never undoes it.
 */

export type AssignmentMessageOutcome = {
  workerName: string;
  email: { status: "sent"; to: string } | { status: "failed"; to: string; error: string } | { status: "skipped"; reason: string };
  /** Prefilled WhatsApp link, or null when WhatsApp is off or there's no number. */
  whatsappUrl: string | null;
  whatsappSkipReason: string | null;
};

export async function prepareAssignmentMessages(
  itemId: string,
  options: { sendEmail: boolean },
): Promise<AssignmentMessageOutcome | null> {
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: {
      channelLink: true,
      startingCount: true,
      targetCount: true,
      order: { select: { orderNumber: true } },
      service: { select: { name: true, metricType: true } },
      category: { select: { name: true } },
      outsourcedWorker: {
        select: { name: true, email: true, phone: true, whatsappNumber: true, notifyVia: true, userId: true },
      },
    },
  });
  const worker = item?.outsourcedWorker;
  if (!item || !worker) return null;

  const message = buildAssignmentMessage({
    orderNumber: item.order.orderNumber,
    serviceName: serviceLabel(item.service.name, item.category.name),
    metricType: item.service.metricType as ServiceMetricType | null,
    channelLink: item.channelLink,
    startingCount: item.startingCount,
    targetCount: item.targetCount,
    acceptUrl: acceptUrlFor(getAppUrl(), itemId),
  });

  let email: AssignmentMessageOutcome["email"];
  const address = worker.email?.trim();
  if (!wantsEmail(worker.notifyVia)) email = { status: "skipped", reason: "Email is turned off for this worker." };
  else if (!address) email = { status: "skipped", reason: "No email address on file." };
  else if (!options.sendEmail) email = { status: "skipped", reason: `Ready to send to ${address}.` };
  else {
    const receipt = await getEmailProvider().sendTemplate({ to: address, subject: message.subject, body: message.text });
    await prisma.messageLog
      .create({
        data: {
          recipientId: worker.userId,
          recipientLabel: `${worker.name} <${address}>`.slice(0, 160),
          channel: "EMAIL",
          event: "ORDER_ASSIGNED",
          status: receipt.ok ? "SENT" : "FAILED",
          providerMessageId: receipt.ok ? receipt.providerMessageId : null,
          error: receipt.ok ? null : receipt.error,
          sentAt: receipt.ok ? new Date() : null,
        },
      })
      .catch(() => undefined);
    email = receipt.ok ? { status: "sent", to: address } : { status: "failed", to: address, error: receipt.error };
  }

  const number = worker.whatsappNumber?.trim() || worker.phone?.trim() || null;
  const link = wantsWhatsapp(worker.notifyVia) ? whatsappUrl(number, message.text) : null;
  return {
    workerName: worker.name,
    email,
    whatsappUrl: link,
    whatsappSkipReason: link
      ? null
      : !wantsWhatsapp(worker.notifyVia)
        ? "WhatsApp is turned off for this worker."
        : "No WhatsApp number on file.",
  };
}
