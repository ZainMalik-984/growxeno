import type { EmailMessage, EmailProvider, ProviderReceipt } from "./types";

/**
 * Email through Resend's HTTP API (2026-11-11, first used for the new-task
 * message to External Workers). Plain `fetch`, no SDK; the fetch function is
 * injectable so it is unit-tested without a network.
 *
 * Note: Resend's shared test sender (`…@resend.dev`) only delivers to the
 * Resend account's own address. Mail to anyone else needs a domain verified
 * in Resend and EMAIL_FROM on that domain (docs/ENVIRONMENT.md).
 */

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** The plain text as simple HTML, with http(s) links clickable. */
export function textToHtml(text: string): string {
  const body = escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replace(/\n/g, "<br>");
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.6;color:#18181b">${body}</div>`;
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  async sendTemplate(message: EmailMessage): Promise<ProviderReceipt> {
    let response: Response;
    try {
      response = await this.fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.body,
          html: textToHtml(message.body),
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return { ok: false, error: "Couldn't reach the email service." };
    }
    const body = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!response.ok || !body?.id) {
      return { ok: false, error: body?.message ? `Email not sent: ${body.message}` : `Email not sent (error ${response.status}).` };
    }
    return { ok: true, providerMessageId: body.id };
  }
}
