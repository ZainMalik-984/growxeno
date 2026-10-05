import "server-only";

import type { EmailProvider, ProviderReceipt, WhatsAppProvider } from "./types";

/**
 * "Missing credentials mean unconfigured, not successful." (specification
 * Section 66 / docs/NOTIFICATIONS.md §3). Used whenever RESEND_API_KEY or
 * WHATSAPP_ACCESS_TOKEN is absent — which is always, this phase (no Redis
 * queue exists yet to dispatch through either provider — see
 * messaging.prisma's header comment). Never fabricates a success.
 */
export class UnconfiguredEmailProvider implements EmailProvider {
  async sendTemplate(): Promise<ProviderReceipt> {
    return { ok: false, error: "Email is not configured (RESEND_API_KEY is not set)." };
  }
}

export class UnconfiguredWhatsAppProvider implements WhatsAppProvider {
  async sendTemplate(): Promise<ProviderReceipt> {
    return { ok: false, error: "WhatsApp is not configured (WHATSAPP_ACCESS_TOKEN is not set)." };
  }
}
