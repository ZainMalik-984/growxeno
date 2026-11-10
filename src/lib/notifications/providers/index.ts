import "server-only";

import { getEmailEnv } from "@/lib/env";
import { ResendEmailProvider } from "./resend";
import type { EmailProvider, WhatsAppProvider } from "./types";
import { UnconfiguredEmailProvider, UnconfiguredWhatsAppProvider } from "./unconfigured";

/**
 * Factory functions feature code calls instead of importing a concrete
 * provider directly. Email goes through Resend once RESEND_API_KEY and
 * EMAIL_FROM are set (2026-11-11); otherwise, and for WhatsApp (sent by hand
 * from a prefilled link, see src/lib/orders/assignment-notify.ts), the
 * unconfigured stub, which never reports a false success.
 */
export function getEmailProvider(): EmailProvider {
  const env = getEmailEnv();
  return env ? new ResendEmailProvider(env.apiKey, env.from) : new UnconfiguredEmailProvider();
}

export function getWhatsAppProvider(): WhatsAppProvider {
  return new UnconfiguredWhatsAppProvider();
}
