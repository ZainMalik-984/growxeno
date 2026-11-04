"use client";

import { CircleAlert, ClipboardList, Clock, Loader2, PackagePlus, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { addOrderItemAction, createOrderAction } from "@/lib/orders/actions";
import type { ServicePickerRow } from "@/lib/services/queries";
import { cn } from "@/lib/utils";
import { CustomerPicker, type SelectedCustomer } from "../customer-picker";
import {
  FIELD_CLASS,
  FormField,
  InsetPanel,
  Muted,
  OptionalTag,
  SegmentedControl,
  SummaryRow,
  TEXTAREA_CLASS,
} from "./order-form-fields";
import {
  describeItem,
  type DraftItem,
  formatCount,
  ITEM_FIELD_ORDER,
  type ItemErrors,
  type ItemFieldKey,
  itemFieldId,
  OrderItemEditor,
  validateItem,
} from "./order-item-editor";

// Owner-directed simplification (confirmed directly, 2026-09-27: "currently
// there are only two sources for order Fiverr and External"), replacing the
// original generic four-value enum (DIRECT/WHOLESALE/MANUAL/OTHER).
type Source = "FIVERR" | "EXTERNAL";

const SOURCE_OPTIONS = [
  { value: "FIVERR", label: "Fiverr" },
  { value: "EXTERNAL", label: "External" },
] as const satisfies ReadonlyArray<{ value: Source; label: string }>;

/** Orders are priced in USD unless a currency is sent; this form never sends one (service.ts defaults it). */
const ORDER_CURRENCY = "USD";

// Same rule the server applies (src/lib/orders/actions.ts, service.ts), checked
// up front so a typo is caught BEFORE the order exists rather than after it.
const MONEY = /^\d+(\.\d{1,2})?$/;

type FieldKey = "fiverrAccount" | "totalAmount" | "deadline";
type Errors = Partial<Record<FieldKey, string>>;

function withoutKeys<K extends string>(errors: Partial<Record<K, string>>, keys: readonly K[]): Partial<Record<K, string>> {
  const next = { ...errors };
  for (const key of keys) delete next[key];
  return next;
}

/** DOM id per order field, in on-screen order — the first invalid one gets focus. */
const FIELD_IDS: Record<FieldKey, string> = {
  fiverrAccount: "order-fiverr-account",
  totalAmount: "order-total-amount",
  deadline: "order-deadline",
};

const blankItem = (key: string): DraftItem => ({ key, serviceId: "", channelLink: "", startingCount: "", requiredCount: "" });

function formatDeadline(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CreateOrderForm({
  fiverrAccounts,
  services,
  canCreateCustomer,
}: {
  fiverrAccounts: ReadonlyArray<{ id: string; name: string }>;
  services: readonly ServicePickerRow[];
  canCreateCustomer: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const submittingRef = useRef(false);

  const [source, setSource] = useState<Source>("EXTERNAL");
  const [externalReference, setExternalReference] = useState("");
  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [fiverrAccountId, setFiverrAccountId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");

  // Items (2026-11-03: several can be entered before the order is created).
  // One blank item shows by default; left blank, it means "no item yet"
  // (confirmed directly, 2026-10-09: creation should have "no much hurdles").
  const keySeq = useRef(1);
  const [items, setItems] = useState<DraftItem[]>(() => [blankItem("i0")]);
  const [itemErrors, setItemErrors] = useState<Record<string, ItemErrors>>({});
  /** Field to focus once the list re-renders (after Add / Duplicate). */
  const focusAfterRender = useRef<string | null>(null);
  useEffect(() => {
    if (!focusAfterRender.current) return;
    document.getElementById(focusAfterRender.current)?.focus();
    focusAfterRender.current = null;
  }, [items]);

  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | undefined>();

  const fiverrAccountName = fiverrAccounts.find((a) => a.id === fiverrAccountId)?.name;

  /** Services grouped by category, keeping the server's order. */
  const serviceGroups = useMemo(() => {
    const groups = new Map<string, ServicePickerRow[]>();
    for (const service of services) {
      const list = groups.get(service.categoryName) ?? [];
      list.push(service);
      groups.set(service.categoryName, list);
    }
    return [...groups.entries()];
  }, [services]);

  const clearError = (key: FieldKey) => {
    if (errors[key]) setErrors((current) => withoutKeys(current, [key]));
  };

  const changeSource = (next: Source) => {
    setSource(next);
    clearError("fiverrAccount");
  };

  const newKey = () => `i${keySeq.current++}`;

  const updateItem = (next: DraftItem, touched: ItemFieldKey[]) => {
    setItems((current) => current.map((item) => (item.key === next.key ? next : item)));
    if (itemErrors[next.key]) {
      setItemErrors((current) => ({ ...current, [next.key]: withoutKeys(current[next.key] ?? {}, touched) }));
    }
  };

  const addItem = () => {
    const key = newKey();
    setItems((current) => [...current, blankItem(key)]);
    focusAfterRender.current = itemFieldId(key, "service");
  };

  /** Copies the link and counts into a new item right below; only the service is left to choose. */
  const duplicateItem = (original: DraftItem) => {
    const key = newKey();
    setItems((current) => {
      const at = current.findIndex((item) => item.key === original.key);
      const copy: DraftItem = { ...original, key, serviceId: "" };
      return [...current.slice(0, at + 1), copy, ...current.slice(at + 1)];
    });
    focusAfterRender.current = itemFieldId(key, "service");
  };

  const removeItem = (key: string) => {
    setItems((current) => {
      const rest = current.filter((item) => item.key !== key);
      return rest.length > 0 ? rest : [blankItem(newKey())];
    });
    setItemErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (source === "FIVERR" && !fiverrAccountId) {
      next.fiverrAccount = "Choose the Fiverr account this order came in on.";
    }
    if (totalAmount.trim() && !MONEY.test(totalAmount.trim())) {
      next.totalAmount = "Enter an amount like 120 or 120.50.";
    }
    if (deadline && Number.isNaN(Date.parse(deadline))) {
      next.deadline = "Enter a valid deadline.";
    }
    return next;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending || submittingRef.current) return; // no duplicate submissions

    setServerError(undefined);
    const found = validate();
    const foundItems: Record<string, ItemErrors> = {};
    for (const item of items) {
      const itemFound = validateItem(item, services, items.length === 1);
      if (Object.keys(itemFound).length > 0) foundItems[item.key] = itemFound;
    }
    setErrors(found);
    setItemErrors(foundItems);

    const invalidIds = [
      ...(Object.keys(FIELD_IDS) as FieldKey[]).filter((key) => found[key]).map((key) => FIELD_IDS[key]),
      ...items.flatMap((item) =>
        ITEM_FIELD_ORDER.filter((field) => foundItems[item.key]?.[field]).map((field) => itemFieldId(item.key, field)),
      ),
    ];
    if (invalidIds.length > 0) {
      document.getElementById(invalidIds[0])?.focus();
      return;
    }

    const toAdd = items.filter((item) => item.serviceId);

    submittingRef.current = true;
    startTransition(async () => {
      try {
        const result = await createOrderAction({
          source,
          externalReference: externalReference.trim() || undefined,
          customerId: customer?.id ?? null,
          fiverrAccountId: source === "FIVERR" ? fiverrAccountId || null : null,
          totalAmount: totalAmount.trim() || undefined,
          deadline: deadline || null,
          notes: notes.trim() || undefined,
        });
        if (!result.ok) {
          setServerError(result.error);
          return;
        }

        // One at a time, so items keep the order they were entered in.
        let failed = 0;
        let firstFailure = "";
        for (const item of toAdd) {
          const d = describeItem(item, services);
          const itemResult = await addOrderItemAction({
            orderId: result.orderId,
            serviceId: item.serviceId,
            channelLink: d.metricType ? item.channelLink.trim() || undefined : undefined,
            targetCount: d.metricType && d.targetValue !== null ? d.targetValue : undefined,
            currentCount: d.metricType ? d.startingValue : undefined,
          });
          if (!itemResult.ok) {
            failed += 1;
            firstFailure ||= itemResult.error;
          }
        }
        if (failed > 0) {
          toast.error(
            failed === 1
              ? `Order created, but one item could not be added: ${firstFailure}`
              : `Order created, but ${failed} items could not be added: ${firstFailure}`,
          );
        }

        toast.success(result.message);
        router.push(`/orders/${result.orderId}`);
      } catch {
        setServerError("Something went wrong while creating the order. Please try again.");
      } finally {
        submittingRef.current = false;
      }
    });
  };

  const errorCount =
    Object.keys(errors).length + Object.values(itemErrors).reduce((sum, e) => sum + Object.keys(e).length, 0);
  const addedItems = items.filter((item) => item.serviceId);
  const busy = pending;

  return (
    <form onSubmit={submit} noValidate aria-busy={busy}>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-6">
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          {/* ── A. Order details (primary) ─────────────────────────────── */}
          <Card className="border-zinc-200/80 p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)] sm:p-7">
            <CardHeader icon={ClipboardList} tone="indigo" title="Order details" description="Where it came from and who it's for." />

            <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <p id="order-source-label" className="text-[13px] font-medium text-zinc-800">
                  Source
                </p>
                <SegmentedControl
                  name="order-source"
                  labelledBy="order-source-label"
                  value={source}
                  options={SOURCE_OPTIONS}
                  onChange={changeSource}
                />
              </div>

              <FormField
                label="Reference"
                htmlFor="order-external-reference"
                tag={<OptionalTag />}
                hint={source === "FIVERR" ? "The Fiverr order number." : "Your own order or invoice number."}
              >
                <Input
                  id="order-external-reference"
                  className={FIELD_CLASS}
                  placeholder={source === "FIVERR" ? "e.g. FO81A2B3C4D5" : "e.g. INV-1042"}
                  value={externalReference}
                  onChange={(event) => setExternalReference(event.target.value)}
                  aria-describedby="order-external-reference-hint"
                />
              </FormField>

              {source === "FIVERR" ? (
                <InsetPanel className="sm:col-span-2">
                  <FormField
                    label="Fiverr account"
                    htmlFor="order-fiverr-account"
                    hint={fiverrAccounts.length === 0 ? "No Fiverr accounts are set up yet." : "The profile this order came in on."}
                    error={errors.fiverrAccount}
                    className="sm:max-w-[calc(50%-10px)]"
                  >
                    <Select
                      id="order-fiverr-account"
                      className={FIELD_CLASS}
                      value={fiverrAccountId}
                      disabled={fiverrAccounts.length === 0}
                      aria-invalid={Boolean(errors.fiverrAccount) || undefined}
                      aria-describedby={errors.fiverrAccount ? "order-fiverr-account-error" : "order-fiverr-account-hint"}
                      onChange={(event) => {
                        setFiverrAccountId(event.target.value);
                        clearError("fiverrAccount");
                      }}
                    >
                      <option value="">Choose an account…</option>
                      {fiverrAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </InsetPanel>
              ) : null}

              <div className="h-px bg-zinc-100 sm:col-span-2" aria-hidden="true" />

              <FormField
                label="Customer"
                htmlFor="order-customer"
                tag={<OptionalTag />}
                hint={canCreateCustomer ? "Search by name, or create a new customer." : "Search by name."}
                className="sm:col-span-2"
              >
                <CustomerPicker
                  id="order-customer"
                  initial={customer}
                  onChange={setCustomer}
                  canCreate={canCreateCustomer}
                  inputClassName={FIELD_CLASS}
                />
              </FormField>

              <FormField label="Order price" htmlFor="order-total-amount" tag={<OptionalTag />} error={errors.totalAmount}>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-medium text-zinc-500">
                    {ORDER_CURRENCY}
                  </span>
                  <Input
                    id="order-total-amount"
                    className={cn(FIELD_CLASS, "pl-12 tabular-nums")}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={totalAmount}
                    aria-invalid={Boolean(errors.totalAmount) || undefined}
                    aria-describedby={errors.totalAmount ? "order-total-amount-error" : undefined}
                    onChange={(event) => {
                      setTotalAmount(event.target.value);
                      clearError("totalAmount");
                    }}
                  />
                </div>
              </FormField>

              <FormField
                label="Deadline"
                htmlFor="order-deadline"
                tag={
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <Clock aria-hidden="true" className="size-3" />
                    Needed before processing
                  </span>
                }
                hint="Can be left empty for now."
                error={errors.deadline}
              >
                <Input
                  id="order-deadline"
                  className={FIELD_CLASS}
                  type="datetime-local"
                  value={deadline}
                  aria-invalid={Boolean(errors.deadline) || undefined}
                  aria-describedby={errors.deadline ? "order-deadline-error" : "order-deadline-hint"}
                  onChange={(event) => {
                    setDeadline(event.target.value);
                    clearError("deadline");
                  }}
                />
              </FormField>

              <FormField label="Notes" htmlFor="order-notes" tag={<OptionalTag />} className="sm:col-span-2">
                <Textarea
                  id="order-notes"
                  className={TEXTAREA_CLASS}
                  rows={3}
                  placeholder="Anything the team should know about this order"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </FormField>
            </div>
          </Card>

          {/* ── B. Items (optional, secondary) ─────────────────────────── */}
          <Card className="border-zinc-200/80 p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-7">
            <CardHeader
              icon={PackagePlus}
              tone="emerald"
              title="Items"
              description="Add services now, or later from the order page. Duplicate an item to reuse its link with another service."
              actions={
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-500 ring-1 ring-inset ring-zinc-200">
                  Optional
                </span>
              }
            />

            <ol className="space-y-3">
              {items.map((item, index) => (
                <li key={item.key}>
                  <OrderItemEditor
                    item={item}
                    index={index}
                    total={items.length}
                    services={services}
                    serviceGroups={serviceGroups}
                    errors={itemErrors[item.key] ?? {}}
                    onChange={updateItem}
                    onDuplicate={() => duplicateItem(item)}
                    onRemove={() => removeItem(item.key)}
                  />
                </li>
              ))}
            </ol>

            <button
              type="button"
              onClick={addItem}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-zinc-300 px-3 py-2.5 text-[13px] font-medium text-zinc-600 transition hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
            >
              <Plus aria-hidden="true" className="size-4" />
              Add another item
            </button>
          </Card>
        </fieldset>

        {/* ── Summary + actions (wide screens) ─────────────────────────── */}
        <aside className="hidden xl:sticky xl:top-20 xl:block">
          <Card className="border-zinc-200/80 p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)] sm:p-6">
            <h2 className="text-[15px] font-semibold text-zinc-900">Summary</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Updates as you fill in the form.</p>

            <dl className="mt-4 divide-y divide-zinc-100 border-y border-zinc-100">
              <SummaryRow label="Source">
                {source === "FIVERR" ? (
                  <>
                    Fiverr
                    <span className="block text-xs font-normal text-zinc-500">
                      {fiverrAccountName ?? <span className="text-amber-700">Account not chosen</span>}
                    </span>
                  </>
                ) : (
                  "External"
                )}
              </SummaryRow>
              <SummaryRow label="Reference">
                <span className="break-all">{externalReference.trim() || <Muted>—</Muted>}</span>
              </SummaryRow>
              <SummaryRow label="Customer">{customer?.name ?? <Muted>Not linked</Muted>}</SummaryRow>
              <SummaryRow label="Price">
                {totalAmount.trim() && MONEY.test(totalAmount.trim()) ? (
                  <span className="tabular-nums">
                    {ORDER_CURRENCY} {Number(totalAmount.trim()).toFixed(2)}
                  </span>
                ) : (
                  <Muted>—</Muted>
                )}
              </SummaryRow>
              <SummaryRow label="Deadline">
                {deadline ? formatDeadline(deadline) : <span className="font-normal text-amber-700">Not set yet</span>}
              </SummaryRow>
              <SummaryRow label={addedItems.length > 1 ? `Items (${addedItems.length})` : "Item"}>
                {addedItems.length === 0 ? (
                  <Muted>None</Muted>
                ) : (
                  <ul className="space-y-1.5">
                    {addedItems.map((item) => {
                      const d = describeItem(item, services);
                      return (
                        <li key={item.key}>
                          {d.service?.name}
                          {d.metricType && d.targetValue !== null ? (
                            <span className="block text-xs font-normal text-emerald-700 tabular-nums">
                              Target {formatCount(d.targetValue)} {d.metricUnit}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SummaryRow>
            </dl>

            <p className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
              <span className="size-1.5 rounded-full bg-zinc-400" aria-hidden="true" />
              Starts as <span className="font-medium text-zinc-700">Pending</span>
            </p>

            <FormFeedback serverError={serverError} errorCount={errorCount} className="mt-4" />

            <div className="mt-5 space-y-2">
              <SubmitButton busy={busy} itemCount={addedItems.length} className="w-full" />
              <Link
                href="/orders"
                className={buttonVariants({ variant: "ghost", className: "h-9 w-full rounded-[8px]" })}
                aria-disabled={busy || undefined}
              >
                Cancel
              </Link>
            </div>
          </Card>
        </aside>
      </div>

      {/* ── Sticky action bar (below xl) ───────────────────────────────── */}
      <div className="sticky bottom-3 z-20 mt-5 xl:hidden">
        <div className="rounded-[14px] border border-zinc-200/80 bg-white/95 p-3 shadow-[0_8px_30px_-8px_rgba(16,24,40,0.18)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <FormFeedback serverError={serverError} errorCount={errorCount} className="mb-3" />
          <div className="flex items-center justify-between gap-3">
            <p className="hidden text-xs text-zinc-500 sm:block">
              Starts as <span className="font-medium text-zinc-700">Pending</span>
              {addedItems.length > 0 ? ` · ${addedItems.length} ${addedItems.length === 1 ? "item" : "items"}` : null}
              {!deadline ? <span className="text-amber-700"> · deadline not set</span> : null}
            </p>
            <div className="flex flex-1 items-center justify-end gap-2">
              <Link
                href="/orders"
                className={buttonVariants({ variant: "secondary", className: "h-10 rounded-[8px] px-4" })}
                aria-disabled={busy || undefined}
              >
                Cancel
              </Link>
              <SubmitButton busy={busy} itemCount={addedItems.length} className="flex-1 sm:flex-none" />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

function SubmitButton({ busy, itemCount, className }: { busy: boolean; itemCount: number; className?: string }) {
  return (
    <Button
      type="submit"
      variant="accent"
      disabled={busy}
      className={cn("h-10 rounded-[8px] px-5 text-sm font-semibold", className)}
    >
      {busy ? (
        <>
          <Loader2 aria-hidden="true" className="animate-spin" />
          {itemCount > 0 ? "Creating order and items…" : "Creating order…"}
        </>
      ) : (
        "Create order"
      )}
    </Button>
  );
}

function FormFeedback({
  serverError,
  errorCount,
  className,
}: {
  serverError?: string;
  errorCount: number;
  className?: string;
}) {
  if (!serverError && errorCount === 0) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700",
        className,
      )}
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        {serverError ??
          (errorCount === 1 ? "One field needs attention." : `${errorCount} fields need attention.`)}
      </span>
    </div>
  );
}
