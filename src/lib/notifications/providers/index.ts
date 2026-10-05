import "server-only";

import type { EmailProvider, WhatsAppProvider } from "./types";
import { UnconfiguredEmailProvider, UnconfiguredWhatsAppProvider } from "./unconfigured";

/**
 * Factory functions feature code calls instead of importing a concrete
 * provider directly. Both currently always resolve to the unconfigured stub:
 * no RESEND_API_KEY/WHATSAPP_ACCESS_TOKEN exists in this project, AND there
 * is no queue to dispatch through yet (see messaging.prisma's header
 * comment) — building a real Resend/Meta client this phase would be
 * untestable code sitting on a shelf, not a working feature. Swapping these
 * for real implementations once both prerequisites exist is a one-line
 * change here, not a refactor of any calling code.
 */
export function getEmailProvider(): EmailProvider {
  return new UnconfiguredEmailProvider();
}

export function getWhatsAppProvider(): WhatsAppProvider {
  return new UnconfiguredWhatsAppProvider();
}
