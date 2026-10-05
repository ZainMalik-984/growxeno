import type { Metadata } from "next";

import { Breadcrumbs, PageHeader, Section } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status-dot";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/authorize";
import { NOTIFICATION_EVENT_LABELS } from "@/lib/notifications/events";
import { listTemplates } from "@/lib/notifications/queries";
import { CreateTemplateButton, EditTemplateButton } from "./template-form";
import { TemplateActiveToggle } from "./template-active-toggle";

export const metadata: Metadata = { title: "Templates" };

const CHANNEL_LABELS: Record<string, string> = { IN_APP: "In-app", EMAIL: "Email", WHATSAPP: "WhatsApp" };

/**
 * Message templates (specification Section 70) — reusable, validated
 * database rows, never a string literal scattered through feature code.
 */
export default async function TemplatesPage() {
  const actor = await requirePermission("templates.view");
  const canManage = actor.permissions.has("templates.manage");

  const templates = await listTemplates();

  return (
    <>
      <Breadcrumbs items={[{ label: "Communication", href: "/communication" }, { label: "Templates" }]} />
      <PageHeader
        title="Templates"
        description="One per event and channel. Validated: an unknown placeholder, or a declared variable that's never used, is refused at save time."
        actions={canManage ? <CreateTemplateButton eventLabels={NOTIFICATION_EVENT_LABELS} /> : undefined}
      />

      <Section title="All templates">
        {templates.length === 0 ? (
          <p className="text-[13px] text-ink-faint">No templates yet.</p>
        ) : (
          <TableWrap>
            <Table>
              <caption className="sr-only">Notification templates</caption>
              <THead>
                <TR>
                  <TH>Event</TH>
                  <TH>Channel</TH>
                  <TH>Name</TH>
                  <TH>Status</TH>
                  {canManage ? <TH /> : null}
                </TR>
              </THead>
              <TBody>
                {templates.map((template) => (
                  <TR key={template.id}>
                    <TD className="text-ink-muted">{NOTIFICATION_EVENT_LABELS[template.event]}</TD>
                    <TD className="text-ink-muted">{CHANNEL_LABELS[template.channel]}</TD>
                    <TD className="text-ink">{template.name}</TD>
                    <TD>
                      <StatusDot tone={template.isActive ? "done" : "neutral"} label={template.isActive ? "Active" : "Inactive"} />
                    </TD>
                    {canManage ? (
                      <TD>
                        <div className="flex items-center gap-2">
                          <EditTemplateButton row={template} eventLabels={NOTIFICATION_EVENT_LABELS} />
                          <TemplateActiveToggle id={template.id} isActive={template.isActive} />
                        </div>
                      </TD>
                    ) : null}
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
