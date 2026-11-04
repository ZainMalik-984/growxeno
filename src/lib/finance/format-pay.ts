/** "5,000.00 PKR" — a single amount in one currency, never blended with another (D1). */
export function formatPay(amount: string | number, currency: string): string {
  const value = Number(amount);
  const text = Number.isFinite(value)
    ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(amount);
  return `${text} ${currency}`;
}
