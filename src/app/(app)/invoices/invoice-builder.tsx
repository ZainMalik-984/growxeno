"use client";

import { Building2, Download, FileText, ListPlus, NotebookPen, Plus, RotateCcw, Trash2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  computeTotals,
  CURRENCIES,
  formatDate,
  formatMoney,
  hasCountableItems,
  isCountable,
  lineTotal,
  partyLines,
  printableItems,
  type InvoiceData,
  type InvoiceParty,
} from "@/lib/invoices/invoice";

/**
 * Invoice generator. Everything stays in component state: no database, no
 * browser storage, no analytics. Refreshing the page starts a fresh invoice.
 */

type FormItem = { id: number; description: string; quantity: string; unitPrice: string };

type FormState = Omit<InvoiceData, "items" | "discountPercent" | "taxPercent"> & {
  items: FormItem[];
  discountPercent: string;
  taxPercent: string;
};

let nextId = 1;
const newItem = (): FormItem => ({ id: nextId++, description: "", quantity: "1", unitPrice: "" });

function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function initialState(): FormState {
  const today = isoDate();
  return {
    number: `GX-${today.replaceAll("-", "").slice(0, 6)}-001`,
    issueDate: today,
    dueDate: isoDate(14),
    showDueDate: true,
    currency: "USD",
    from: { name: "Grow Xeno", company: "", email: "hello@growxeno.com", phone: "", address: "" },
    billTo: { name: "", company: "", email: "", phone: "", address: "" },
    items: [newItem()],
    discountPercent: "",
    taxPercent: "",
    notes: "Thank you for choosing Grow Xeno. Please include the invoice number with your payment.",
    paymentDetails: "",
  };
}

const num = (value: string) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

function toInvoice(state: FormState): InvoiceData {
  return {
    ...state,
    discountPercent: num(state.discountPercent),
    taxPercent: num(state.taxPercent),
    items: state.items.map((item) => ({
      id: String(item.id),
      description: item.description,
      quantity: num(item.quantity),
      unitPrice: num(item.unitPrice),
    })),
  };
}

export function InvoiceBuilder() {
  const [form, setForm] = useState<FormState>(initialState);
  const [downloading, setDownloading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const invoice = useMemo(() => toInvoice(form), [form]);
  const totals = useMemo(() => computeTotals(invoice), [invoice]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setParty = (which: "from" | "billTo", key: keyof InvoiceParty, value: string) =>
    setForm((prev) => ({ ...prev, [which]: { ...prev[which], [key]: value } }));

  const setItem = (id: number, key: keyof Omit<FormItem, "id">, value: string) =>
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    }));

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, newItem()] }));

  const removeItem = (id: number) =>
    setForm((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((item) => item.id !== id) : [newItem()],
    }));

  const errors = {
    number: form.number.trim() ? undefined : "Enter an invoice number.",
    billTo: form.billTo.name.trim() ? undefined : "Enter who this invoice is for.",
    items: invoice.items.some((item) => item.description.trim())
      ? undefined
      : "Add at least one item with a description.",
  };
  const hasErrors = Object.values(errors).some(Boolean);

  async function handleDownload() {
    if (hasErrors) {
      setShowErrors(true);
      toast.error("A few details are missing", { description: "Check the highlighted fields." });
      return;
    }
    setDownloading(true);
    try {
      const { downloadInvoicePdf } = await import("@/lib/invoices/invoice-pdf");
      await downloadInvoicePdf(invoice);
      toast.success("Invoice downloaded");
    } catch {
      toast.error("Could not create the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  function handleReset() {
    setShowErrors(false);
    setForm(initialState());
  }

  const err = (message: string | undefined) => (showErrors ? message : undefined);

  return (
    <div className="grid gap-8 2xl:grid-cols-[minmax(0,1fr)_minmax(0,540px)]">
      {/* ── Form ─────────────────────────────────────────────────────── */}
      <div className="space-y-6">
        <Card>
          <CardHeader icon={FileText} tone="emerald" title="Invoice details" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Invoice number" htmlFor="inv-number" error={err(errors.number)}>
              <Input
                id="inv-number"
                value={form.number}
                onChange={(e) => set("number", e.target.value)}
                aria-invalid={Boolean(err(errors.number))}
              />
            </Field>
            <Field label="Issue date" htmlFor="inv-issue">
              <Input id="inv-issue" type="date" value={form.issueDate} onChange={(e) => set("issueDate", e.target.value)} />
            </Field>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="inv-due">Due date</Label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-muted">
                  <input
                    type="checkbox"
                    checked={form.showDueDate}
                    onChange={(e) => set("showDueDate", e.target.checked)}
                    className="size-3.5 accent-emerald-600"
                  />
                  Show on invoice
                </label>
              </div>
              <Input
                id="inv-due"
                type="date"
                value={form.dueDate}
                disabled={!form.showDueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            </div>
            <Field label="Currency" htmlFor="inv-currency">
              <Select id="inv-currency" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader icon={Building2} tone="emerald" title="Billed by" description="Your business details." />
            <PartyFields idPrefix="from" party={form.from} onChange={(k, v) => setParty("from", k, v)} />
          </Card>
          <Card>
            <CardHeader icon={UserRound} tone="emerald" title="Billed to" description="The client receiving this invoice." />
            <PartyFields
              idPrefix="to"
              party={form.billTo}
              onChange={(k, v) => setParty("billTo", k, v)}
              nameError={err(errors.billTo)}
            />
          </Card>
        </div>

        <Card>
          <CardHeader
            icon={ListPlus}
            tone="emerald"
            title="Items"
            description="Amount is quantity × price. Set quantity to 0 for a fixed-price item that isn't counted."
            actions={
              <Button size="sm" onClick={addItem}>
                <Plus aria-hidden="true" /> Add item
              </Button>
            }
          />

          <div className="mt-5">
            <div className="hidden grid-cols-[minmax(0,1fr)_80px_120px_110px_32px] gap-3 border-b border-line pb-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint md:grid">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Price</span>
              <span className="text-right">Amount</span>
              <span />
            </div>

            <ul className="divide-y divide-line-soft">
              {form.items.map((item, index) => {
                const amount = lineTotal(invoice.items[index]);
                return (
                  <li
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_32px] gap-3 py-3 md:grid-cols-[minmax(0,1fr)_80px_120px_110px_32px] md:items-start"
                  >
                    {/* Multi-line: Enter adds a line break; the box grows with its content. */}
                    <Textarea
                      aria-label={`Item ${index + 1} description`}
                      placeholder="e.g. YouTube channel monetization setup"
                      rows={Math.max(1, item.description.split("\n").length)}
                      value={item.description}
                      onChange={(e) => setItem(item.id, "description", e.target.value)}
                      className="col-span-1 min-h-8 resize-none py-1.5 leading-[1.35rem] field-sizing-content"
                    />
                    <div className="col-span-2 grid grid-cols-3 gap-3 md:contents">
                      <Input
                        aria-label={`Item ${index + 1} quantity`}
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        placeholder="0"
                        title="0 = not counted (fixed price)"
                        value={item.quantity}
                        onChange={(e) => setItem(item.id, "quantity", e.target.value)}
                        className="text-right tabular-nums"
                      />
                      <Input
                        aria-label={`Item ${index + 1} unit price`}
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={item.unitPrice}
                        onChange={(e) => setItem(item.id, "unitPrice", e.target.value)}
                        className="text-right tabular-nums"
                      />
                      <p className="self-center text-right text-[13px] font-medium tabular-nums text-ink-strong md:self-start md:pt-1.5">
                        {formatMoney(amount, form.currency)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove item ${index + 1}`}
                      className="row-start-1 col-start-2 w-8 px-0 md:row-auto md:col-auto"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>

            {err(errors.items) ? (
              <p className="mt-2 text-xs text-red-600" role="alert">
                {errors.items}
              </p>
            ) : null}

            <button
              type="button"
              onClick={addItem}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-[6px] border border-dashed border-zinc-300 py-2.5 text-[13px] text-ink-muted transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700"
            >
              <Plus aria-hidden="true" className="size-4" /> Add another item
            </button>

            <div className="mt-6 flex flex-col gap-6 border-t border-line pt-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="grid grid-cols-2 gap-4 sm:w-64">
                <Field label="Discount %" htmlFor="inv-discount">
                  <Input
                    id="inv-discount"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    placeholder="0"
                    value={form.discountPercent}
                    onChange={(e) => set("discountPercent", e.target.value)}
                  />
                </Field>
                <Field label="Tax %" htmlFor="inv-tax">
                  <Input
                    id="inv-tax"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={form.taxPercent}
                    onChange={(e) => set("taxPercent", e.target.value)}
                  />
                </Field>
              </div>
              <dl className="space-y-1.5 text-[13px] sm:w-64">
                <TotalRow label="Subtotal" value={formatMoney(totals.subtotal, form.currency)} />
                {totals.discount ? (
                  <TotalRow label="Discount" value={formatMoney(-totals.discount, form.currency)} />
                ) : null}
                {totals.tax ? <TotalRow label="Tax" value={formatMoney(totals.tax, form.currency)} /> : null}
                <div className="flex items-center justify-between border-t border-line pt-2 text-[15px] font-semibold text-ink-strong">
                  <dt>Total due</dt>
                  <dd className="tabular-nums text-emerald-700">{formatMoney(totals.total, form.currency)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={NotebookPen} tone="emerald" title="Notes & payment" description="Optional — printed at the bottom of the invoice." />
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Field label="Payment details" htmlFor="inv-payment">
              <Textarea
                id="inv-payment"
                rows={4}
                placeholder={"Bank: …\nAccount title: …\nIBAN / Account no: …"}
                value={form.paymentDetails}
                onChange={(e) => set("paymentDetails", e.target.value)}
              />
            </Field>
            <Field label="Notes" htmlFor="inv-notes">
              <Textarea id="inv-notes" rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
        </Card>
      </div>

      {/* ── Preview ──────────────────────────────────────────────────── */}
      <aside className="2xl:sticky 2xl:top-6 2xl:self-start">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-ink">Preview</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" onClick={handleReset}>
              <RotateCcw aria-hidden="true" /> New invoice
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleDownload}
              disabled={downloading}
            >
              <Download aria-hidden="true" /> {downloading ? "Preparing…" : "Download PDF"}
            </Button>
          </div>
        </div>
        <InvoicePreview invoice={invoice} />
        <p className="mt-3 text-xs text-ink-faint">
          Nothing is saved. The invoice exists only on this page until you download it.
        </p>
      </aside>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-ink-muted">
      <dt>{label}</dt>
      <dd className="tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function PartyFields({
  idPrefix,
  party,
  onChange,
  nameError,
}: {
  idPrefix: string;
  party: InvoiceParty;
  onChange: (key: keyof InvoiceParty, value: string) => void;
  nameError?: string;
}) {
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <Field label="Name" htmlFor={`${idPrefix}-name`} error={nameError}>
        <Input
          id={`${idPrefix}-name`}
          value={party.name}
          onChange={(e) => onChange("name", e.target.value)}
          aria-invalid={Boolean(nameError)}
        />
      </Field>
      <Field label="Company" htmlFor={`${idPrefix}-company`}>
        <Input id={`${idPrefix}-company`} value={party.company} onChange={(e) => onChange("company", e.target.value)} />
      </Field>
      <Field label="Email" htmlFor={`${idPrefix}-email`}>
        <Input id={`${idPrefix}-email`} type="email" value={party.email} onChange={(e) => onChange("email", e.target.value)} />
      </Field>
      <Field label="Phone" htmlFor={`${idPrefix}-phone`}>
        <Input id={`${idPrefix}-phone`} value={party.phone} onChange={(e) => onChange("phone", e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Address" htmlFor={`${idPrefix}-address`}>
          <Textarea
            id={`${idPrefix}-address`}
            rows={2}
            value={party.address}
            onChange={(e) => onChange("address", e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

/** On-screen mirror of the PDF layout (src/lib/invoices/invoice-pdf.ts). */
function InvoicePreview({ invoice }: { invoice: InvoiceData }) {
  const totals = computeTotals(invoice);
  const items = printableItems(invoice.items);
  const showQty = hasCountableItems(items);
  const money = (n: number) => formatMoney(n, invoice.currency);

  return (
    <div className="overflow-hidden rounded-[8px] border border-zinc-200 bg-white text-[#182126] shadow-lg shadow-zinc-900/10">
      <div className="h-1.5 bg-[#049652]" />
      <div className="p-7">
        <div className="flex items-start justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- same file the PDF embeds */}
          <img src="/brand/grow-xeno-wordmark.png" alt="Grow Xeno" width={720} height={171} className="h-10 w-auto" />
          <div className="text-right">
            <p className="text-2xl font-bold tracking-tight">INVOICE</p>
            <p className="text-xs text-zinc-500">No. {invoice.number || "—"}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_1fr_auto] gap-4 border-t border-zinc-200 pt-5 text-xs">
          <PreviewParty title="Billed by" party={invoice.from} />
          <PreviewParty title="Billed to" party={invoice.billTo} />
          <div className="min-w-36 rounded-[6px] bg-[#f1f9f4] p-3">
            <PreviewMeta label="Issue date" value={formatDate(invoice.issueDate) || "—"} />
            {invoice.showDueDate ? (
              <PreviewMeta label="Due date" value={formatDate(invoice.dueDate) || "—"} />
            ) : null}
            <div className="mt-2 border-t border-[#d0e6d8] pt-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Amount due</p>
              <p className="text-right text-base font-bold tabular-nums text-[#049652]">{money(totals.total)}</p>
            </div>
          </div>
        </div>

        <table className="mt-6 w-full text-xs">
          <thead>
            <tr className="bg-[#182126] text-[9px] uppercase tracking-wider text-white">
              <th className="rounded-l px-2 py-2 text-left font-bold">#</th>
              <th className="py-2 text-left font-bold">Description</th>
              {showQty ? (
                <>
                  <th className="px-2 py-2 text-right font-bold">Qty</th>
                  <th className="px-2 py-2 text-right font-bold">Price</th>
                </>
              ) : null}
              <th className="rounded-r px-2 py-2 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={showQty ? 5 : 3} className="py-4 text-center text-zinc-400">
                  Items you add appear here.
                </td>
              </tr>
            ) : (
              items.map((item, i) => (
                <tr key={item.id} className="border-b border-zinc-200 even:bg-[#f9fbfa]">
                  <td className="px-2 py-2 align-top text-zinc-400">{String(i + 1).padStart(2, "0")}</td>
                  <td className="whitespace-pre-wrap break-words py-2 align-top">{item.description || "—"}</td>
                  {showQty ? (
                    <>
                      <td className="px-2 py-2 text-right align-top tabular-nums text-zinc-500">
                        {isCountable(item) ? item.quantity : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-2 py-2 text-right align-top tabular-nums text-zinc-500">
                        {isCountable(item) ? money(item.unitPrice) : <span className="text-zinc-300">—</span>}
                      </td>
                    </>
                  ) : null}
                  <td className="px-2 py-2 text-right align-top font-semibold tabular-nums">{money(lineTotal(item))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-5 flex items-start justify-between gap-6 text-xs">
          <div className="min-w-0 flex-1 space-y-3">
            {invoice.paymentDetails.trim() ? <PreviewNote title="Payment details" body={invoice.paymentDetails} /> : null}
            {invoice.notes.trim() ? <PreviewNote title="Notes" body={invoice.notes} /> : null}
          </div>
          <div className="w-48 shrink-0 space-y-1.5">
            <PreviewTotal label="Subtotal" value={money(totals.subtotal)} />
            {invoice.discountPercent ? (
              <PreviewTotal label={`Discount (${invoice.discountPercent}%)`} value={money(-totals.discount)} />
            ) : null}
            {invoice.taxPercent ? <PreviewTotal label={`Tax (${invoice.taxPercent}%)`} value={money(totals.tax)} /> : null}
            <div className="flex items-center justify-between rounded bg-[#049652] px-2.5 py-2 font-bold text-white">
              <span>Total due</span>
              <span className="tabular-nums">{money(totals.total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-between border-t border-zinc-200 pt-3 text-[10px] text-zinc-400">
          <span className="font-semibold text-[#182126]">Thank you for your business.</span>
          <span>{[invoice.from.name, invoice.from.email].filter(Boolean).join(" · ")}</span>
        </div>
      </div>
    </div>
  );
}

function PreviewParty({ title, party }: { title: string; party: InvoiceParty }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{title}</p>
      <p className="mt-1.5 break-words text-sm font-bold">{party.name || "—"}</p>
      {partyLines(party).map((line, i) => (
        <p key={i} className="break-words text-zinc-500">
          {line}
        </p>
      ))}
    </div>
  );
}

function PreviewMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function PreviewNote({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{title}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-zinc-500">{body.trim()}</p>
    </div>
  );
}

function PreviewTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-2.5 text-zinc-500">
      <span>{label}</span>
      <span className="tabular-nums text-[#182126]">{value}</span>
    </div>
  );
}
