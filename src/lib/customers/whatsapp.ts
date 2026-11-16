/**
 * A WhatsApp "click to chat" link for a customer's number (2026-11-16), or null
 * when it has no digits. International format without + or 00
 * ("+92 300 1234567" → "923001234567"). Pure, so it is unit-tested.
 */
export function customerWhatsappUrl(number: string | null | undefined): string | null {
  const digits = (number ?? "").trim().replace(/^\+/, "").replace(/^00/, "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}
