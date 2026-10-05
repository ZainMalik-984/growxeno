import type { Metadata } from "next";

import { Breadcrumbs, EmptyState, PageHeader, Section } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status-dot";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/authorize";
import { NOTIFICATION_EVENT_LABELS } from "@/lib/notifications/events";
import { listMessageLogs } from "@/lib/notifications/queries";

export const metadata: Metadata = { title: "Message Logs" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const CHANNEL_LABELS: Record<string, string> = { IN_APP: "In-app", EMAIL: "Email", WHATSAPP: "WhatsApp" };
const STATUS_TONE: Record<string, "done" | "danger" | "neutral" | "progress"> = {
  QUEUED: "neutral",
  SENDING: "progress",
  SENT: "progress",
  DELIVERED: "done",
  FAILED: "danger",
};

/**
 * Every outbound message, one row per attempt (specification Section 71).
 * Empty today by design — no queue exists yet to actually dispatch anything
 * (docs/NOTIFICATIONS.md), so nothing has ever been sent. The moment a
 * dispatcher writes its first row, this page shows it with no code change.
 */
export default async function MessageLogsPage() {
  await requirePermission("message_logs.view");

  const logs = await listMessageLogs({ limit: 200 });

  return (
    <>
      <Breadcrumbs items={[{ label: "Communication", href: "/communication" }, { label: "Message Logs" }]} />
      <PageHeader
        title="Message Logs"
        description="Every outbound message attempt. Empty until a queue exists to dispatch through (docs/NOTIFICATIONS.md)."
      />

      <Section title="Recent messages">
        {logs.length === 0 ? (
          <EmptyState
            title="No messages sent yet"
            description="Nothing has been dispatched — email/WhatsApp sending needs a configured provider and a queue, neither of which exists in this project yet."
          />
        ) : (
          <TableWrap>
            <Table>
              <caption className="sr-only">Message logs</caption>
              <THead>
                <TR>
                  <TH>Recipient</TH>
                  <TH>Channel</TH>
                  <TH>Event</TH>
                  <TH>Status</TH>
                  <TH>Created</TH>
                  <TH>Error</TH>
                </TR>
              </THead>
              <TBody>
                {logs.map((log) => (
                  <TR key={log.id}>
                    <TD className="text-ink">{log.recipientLabel}</TD>
                    <TD className="text-ink-muted">{CHANNEL_LABELS[log.channel]}</TD>
                    <TD className="text-ink-muted">{NOTIFICATION_EVENT_LABELS[log.event]}</TD>
                    <TD>
                      <StatusDot tone={STATUS_TONE[log.status]} label={log.status} />
                    </TD>
                    <TD className="text-ink-muted">{dateFormat.format(log.createdAt)} UTC</TD>
                    <TD className="max-w-xs truncate text-ink-muted">{log.error ?? <span className="text-ink-faint">—</span>}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Section>
    </>
  );
}
