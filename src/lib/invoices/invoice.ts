/**
 * Invoice generator model.
 *
 * Deliberately stateless: nothing here touches the database, storage or any
 * tracking. An invoice lives only in the browser tab until it is downloaded.
 */

export type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type InvoiceParty = {
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
};

export type InvoiceData = {
  number: string;
  issueDate: string; // yyyy-mm-dd
  dueDate: string; // yyyy-mm-dd
  /** When false, the due date is left off the preview and the PDF. */
  showDueDate: boolean;
  currency: string;
  from: InvoiceParty;
  billTo: InvoiceParty;
  items: InvoiceItem[];
  discountPercent: number;
  taxPercent: number;
  notes: string;
  paymentDetails: string;
};

export const CURRENCIES = ["USD", "PKR", "EUR", "GBP", "AED", "SAR", "CAD", "AUD"] as const;

/** Symbols that render in the PDF's standard fonts; others show the ISO code. */
const SYMBOLS: Record<string, string> = { USD: "$", GBP: "£", CAD: "CA$", AUD: "A$" };

export function formatMoney(value: number, currency: string): string {
  const amount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  const sign = value < 0 ? "-" : "";
  const symbol = SYMBOLS[currency];
  return symbol ? `${sign}${symbol}${amount}` : `${sign}${currency} ${amount}`;
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/**
 * An item with a quantity above zero is countable (quantity × unit price).
 * A quantity of 0 (or blank) means the item is not countable: a flat price.
 */
export function isCountable(item: InvoiceItem): boolean {
  return safe(item.quantity) > 0;
}

export function lineTotal(item: InvoiceItem): number {
  const price = safe(item.unitPrice);
  return isCountable(item) ? safe(item.quantity) * price : price;
}

/** The Qty / Unit price columns are printed only when at least one item is countable. */
export function hasCountableItems(items: InvoiceItem[]): boolean {
  return items.some(isCountable);
}

export type InvoiceTotals = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

/** Discount applies to the subtotal; tax applies to the discounted amount. */
export function computeTotals(data: InvoiceData): InvoiceTotals {
  const subtotal = data.items.reduce((sum, item) => sum + lineTotal(item), 0);
  const discount = subtotal * (safe(data.discountPercent) / 100);
  const tax = (subtotal - discount) * (safe(data.taxPercent) / 100);
  return { subtotal, discount, tax, total: subtotal - discount + tax };
}

/** Items worth printing: a row with neither a description nor an amount is skipped. */
export function printableItems(items: InvoiceItem[]): InvoiceItem[] {
  return items.filter((item) => item.description.trim() !== "" || lineTotal(item) !== 0);
}

export function partyLines(party: InvoiceParty): string[] {
  return [party.company, party.address, party.email, party.phone]
    .flatMap((value) => value.split("\n"))
    .map((line) => line.trim())
    .filter(Boolean);
}
