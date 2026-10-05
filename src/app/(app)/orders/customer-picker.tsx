"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createCustomerAction, searchCustomersAction } from "@/lib/customers/actions";
import type { CustomerSearchHit } from "@/lib/customers/queries";
import { cn } from "@/lib/utils";

export type SelectedCustomer = { id: string; name: string };

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

/**
 * Order-form customer field (confirmed directly, 2026-09-27): type a name,
 * pick a match, or create one inline if none exists — never a separate page.
 * A customer has only a name and an optional email; other fields (type,
 * buyer, phone, notes) stay available on the full `/customers/[id]` page for
 * later editing, but are not asked for here.
 *
 * Three distinct states after a search, each with a different next step:
 * loading, a genuine empty result (offer to create), and a failed request
 * (offer to retry) — never conflated into one generic "nothing found".
 */
export function CustomerPicker({
  id,
  initial,
  onChange,
  canCreate,
}: {
  id: string;
  initial: SelectedCustomer | null;
  onChange: (customer: SelectedCustomer | null) => void;
  canCreate: boolean;
}) {
  const [query, setQuery] = useState(initial?.name ?? "");
  const [selected, setSelected] = useState<SelectedCustomer | null>(initial ?? null);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CustomerSearchHit[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createError, setCreateError] = useState<string | undefined>();
  const containerRef = useRef<HTMLDivElement>(null);

  const runSearch = () => {
    const term = query.trim();
    if (term.length < MIN_QUERY_LENGTH) {
      setResults(null);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    searchCustomersAction({ query: term }).then((result) => {
      if (result.ok) {
        setResults(result.customers);
        setStatus("loaded");
      } else {
        setStatus("error");
      }
    });
  };

  useEffect(() => {
    if (!open) return;
    if (selected && query === selected.name) return; // showing the confirmed selection, nothing to search
    const timer = setTimeout(runSearch, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runSearch closes over `query`, re-created each render, which is exactly what should re-trigger the debounce
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const select = (customer: SelectedCustomer) => {
    setSelected(customer);
    setQuery(customer.name);
    setOpen(false);
    onChange(customer);
  };

  const clear = () => {
    setSelected(null);
    setQuery("");
    setResults(null);
    setStatus("idle");
    onChange(null);
  };

  const openCreate = () => {
    setCreateError(undefined);
    setCreateEmail("");
    setShowCreate(true);
  };

  const submitCreate = () => {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    setCreateError(undefined);
    createCustomerAction({ name, type: "INDIVIDUAL", email: createEmail || undefined }).then((result) => {
      setCreating(false);
      if (result.ok) {
        toast.success(result.message);
        setShowCreate(false);
        select({ id: result.customerId, name });
      } else {
        setCreateError(result.error);
      }
    });
  };

  const term = query.trim();
  const showDropdown = open && term.length >= MIN_QUERY_LENGTH && !(selected && query === selected.name);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-2">
        <Input
          id={id}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            if (selected) {
              setSelected(null);
              onChange(null);
            }
          }}
          placeholder="Start typing a name…"
          autoComplete="off"
        />
        {selected ? (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            Clear
          </Button>
        ) : null}
      </div>

      {showDropdown ? (
        <div role="listbox" className="absolute z-40 mt-1 w-full border border-line bg-canvas shadow-sm">
          {status === "loading" ? (
            <p className="px-3 py-3 text-[13px] text-ink-faint">Searching…</p>
          ) : status === "error" ? (
            <div className="flex items-center justify-between px-3 py-3 text-[13px]">
              <span className="text-red-600">Search failed.</span>
              <button type="button" onClick={runSearch} className="text-ink-muted underline hover:text-ink">
                Retry
              </button>
            </div>
          ) : results && results.length > 0 ? (
            <ul className="max-h-56 overflow-y-auto">
              {results.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => select(customer)}
                    className={cn("flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-canvas-subtle")}
                  >
                    <span className="text-ink">{customer.name}</span>
                    {customer.email ? <span className="truncate text-xs text-ink-faint">{customer.email}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-3 text-[13px]">
              <p className="text-ink-faint">No customer named &ldquo;{term}&rdquo;.</p>
              {canCreate ? (
                <button type="button" onClick={openCreate} className="mt-1 text-ink underline hover:no-underline">
                  Create &ldquo;{term}&rdquo;
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {showCreate ? (
        <Modal open onClose={() => setShowCreate(false)} labelledBy="create-customer-title">
          <h2 id="create-customer-title" className="text-[15px] font-medium text-ink-strong">
            New customer
          </h2>
          <div className="mt-5 space-y-4">
            <Field label="Name" htmlFor="create-customer-name">
              <Input id="create-customer-name" value={query} onChange={(event) => setQuery(event.target.value)} />
            </Field>
            <Field label="Email" htmlFor="create-customer-email" hint="Optional.">
              <Input id="create-customer-email" type="email" value={createEmail} onChange={(event) => setCreateEmail(event.target.value)} />
            </Field>
            {createError ? (
              <p role="alert" className="text-[13px] text-red-600">
                {createError}
              </p>
            ) : null}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={creating}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitCreate} disabled={creating || !query.trim()}>
              {creating ? "Creating…" : "Create customer"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
