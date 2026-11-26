/**
 * Fiverr order notification email parser.
 *
 * Fiverr sends a consistent HTML email when a new order is placed:
 *   Subject: "New Order: <gig title> from <buyer>"  (or similar variants)
 *   Body:    HTML table with order details including order ID, amount, delivery
 *
 * This module extracts the structured data from that email so the webhook
 * handler can create an Order record without touching the Fiverr platform.
 */

export interface ParsedFiverrOrder {
  orderId: string;
  gigTitle: string;
  buyerName: string;
  amount: number;
  currency: string;
  deliveryDays: number;
  orderDate: Date;
}

// Fiverr order IDs follow the pattern FO followed by 9–12 digits.
const ORDER_ID_RE = /\b(FO\d{9,12})\b/i;

// Subject patterns Fiverr uses for new order notifications.
// "You have a new order! Order #FO..." or "New order: Gig Title"
const NEW_ORDER_SUBJECT_RE = /new order/i;

// Amount: "$25.00" or "USD 25.00" in the email body
const AMOUNT_RE = /\$\s*([\d,]+(?:\.\d{1,2})?)/;

// Delivery: "3 days", "1 day"
const DELIVERY_RE = /(\d+)\s+day/i;

function extractOrderId(text: string): string | null {
  return text.match(ORDER_ID_RE)?.[1]?.toUpperCase() ?? null;
}

function extractAmount(html: string, text: string): number {
  const match = html.match(AMOUNT_RE) ?? text.match(AMOUNT_RE);
  if (!match) return 0;
  return parseFloat(match[1].replace(/,/g, ""));
}

function extractDeliveryDays(html: string, text: string): number {
  const match = html.match(DELIVERY_RE) ?? text.match(DELIVERY_RE);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Extract buyer name from known Fiverr subject line formats:
 *   "New order from John: Gig Title"
 *   "New Order: Gig Title from John"
 *   "You have a new order from John!"
 */
function extractBuyerAndGig(
  subject: string,
  html: string,
): { buyerName: string; gigTitle: string } {
  // "New order from <buyer>: <gig>"
  let m = subject.match(/new order from ([^:]+):\s*(.+)/i);
  if (m) return { buyerName: m[1].trim(), gigTitle: m[2].trim() };

  // "New Order: <gig> from <buyer>"
  m = subject.match(/new order:\s*(.+?) from (.+)/i);
  if (m) return { buyerName: m[2].trim(), gigTitle: m[1].trim() };

  // "You have a new order from <buyer>"
  m = subject.match(/new order from ([^!.]+)/i);
  if (m) return { buyerName: m[1].trim(), gigTitle: "" };

  // Fall back: try to find a buyer name in the HTML ("Hi <name>" or "from <name>")
  const htmlBuyer = html.match(/from\s+<strong>([^<]+)<\/strong>/i)?.[1]
    ?? html.match(/buyer[:\s]+([^<\n,]+)/i)?.[1]
    ?? "Unknown";

  return { buyerName: htmlBuyer.trim(), gigTitle: subject.replace(/new order/i, "").trim() };
}

/**
 * Parse a raw Fiverr order notification email.
 * Returns null if the email is not a new-order notification (e.g. promo, tip, review request).
 */
export function parseFiverrOrderEmail(
  subject: string,
  html: string,
  text: string,
  date: Date,
): ParsedFiverrOrder | null {
  if (!NEW_ORDER_SUBJECT_RE.test(subject)) return null;

  const orderId = extractOrderId(subject) ?? extractOrderId(html) ?? extractOrderId(text);
  if (!orderId) return null;

  const { buyerName, gigTitle } = extractBuyerAndGig(subject, html);
  const amount = extractAmount(html, text);
  const deliveryDays = extractDeliveryDays(html, text);

  return {
    orderId,
    gigTitle,
    buyerName,
    amount,
    currency: "USD",
    deliveryDays,
    orderDate: date,
  };
}
