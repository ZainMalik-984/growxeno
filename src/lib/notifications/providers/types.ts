/**
 * Provider interfaces (specification Section 69: "Create a provider layer so
 * the core application is not tightly coupled to one provider
 * implementation"). Feature code never imports Resend or Meta SDK types —
 * only these interfaces, resolved through `./index.ts`'s factory functions.
 */

export type ProviderReceipt =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string };

export type EmailMessage = {
  to: string;
  subject: string;
  body: string;
};

export type WhatsAppMessage = {
  to: string;
  /** Meta requires a pre-approved template name + language, not free text. */
  templateName: string;
  templateLanguage: string;
  body: string;
};

export interface EmailProvider {
  sendTemplate(message: EmailMessage): Promise<ProviderReceipt>;
}

export interface WhatsAppProvider {
  sendTemplate(message: WhatsAppMessage): Promise<ProviderReceipt>;
}
