import type { EmailMessage } from "@/lib/notifications/providers/types";
import type { RenderedEmail } from "./templates";

/** A rendered template as a message for the email provider: subject, plain text and the branded HTML. */
export function renderedToMessage(to: string, email: RenderedEmail): EmailMessage {
  return { to, subject: email.subject, body: email.text, html: email.html };
}
