import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, Section } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";

export const metadata: Metadata = { title: "Communication" };

/**
 * Communication overview (specification Sections 65-74).
 *
 * Email and WhatsApp compose tools are NOT built here — sending either needs
 * a configured provider AND a queue to dispatch through, neither of which
 * exists in this project yet (docs/NOTIFICATIONS.md; the Redis/BullMQ
 * decision was deferred this session — see messaging.prisma's header
 * comment). Building a compose screen with no working send would be a
 * facade. Templates and Message Logs are real: managing templates and
 * inspecting delivery history need no provider or queue at all.
 */
export default async function CommunicationPage() {
  const actor = await requirePermission("communications.view");

  return (
    <>
      <PageHeader
        title="Communication"
        description="Templates and message history. Email and WhatsApp sending are not wired up yet — no queue exists (docs/NOTIFICATIONS.md)."
      />

      <Section title="Go to">
        <div className="flex flex-wrap gap-4 text-[13px]">
          {actor.permissions.has("templates.view") ? (
            <Link href="/communication/templates" className="text-ink hover:underline">
              Templates
            </Link>
          ) : null}
          {actor.permissions.has("message_logs.view") ? (
            <Link href="/communication/message-logs" className="text-ink hover:underline">
              Message Logs
            </Link>
          ) : null}
        </div>
      </Section>

      <Section title="Not available yet">
        <p className="max-w-2xl text-[13px] text-ink-muted">
          Composing and sending email or WhatsApp needs a configured provider (Resend / Meta WhatsApp
          Business Platform) and a Redis-backed queue to dispatch through without blocking the request
          that triggered it (specification Section 72). Neither exists in this project yet — see
          docs/REQUIREMENTS.md for the current status.
        </p>
      </Section>
    </>
  );
}
