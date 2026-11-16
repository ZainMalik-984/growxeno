"use client";

import { Building2, UserRound } from "lucide-react";

import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CustomerFieldValues = {
  name: string;
  username: string;
  type: "INDIVIDUAL" | "COMPANY";
  email: string;
  phone: string;
  whatsapp: string;
  notes: string;
};

export const EMPTY_CUSTOMER: CustomerFieldValues = { name: "", username: "", type: "INDIVIDUAL", email: "", phone: "", whatsapp: "", notes: "" };

/**
 * The customer form's fields, compact (owner request, 2026-11-16): short
 * labels, examples as placeholders instead of hint lines, Type as a two-way
 * switch, related fields side by side. Used by the New and Edit popups.
 */
export function CustomerFields({
  idPrefix,
  values,
  onChange,
  autoFocus = false,
}: {
  idPrefix: string;
  values: CustomerFieldValues;
  onChange: (next: CustomerFieldValues) => void;
  autoFocus?: boolean;
}) {
  const set = <K extends keyof CustomerFieldValues>(key: K, value: CustomerFieldValues[K]) => onChange({ ...values, [key]: value });
  const id = (key: string) => `${idPrefix}-${key}`;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Compact label="Name" htmlFor={id("name")}>
          <Input id={id("name")} required autoFocus={autoFocus} value={values.name} onChange={(e) => set("name", e.target.value)} />
        </Compact>
        <Compact label="Username" htmlFor={id("username")} optional>
          <Input id={id("username")} value={values.username} placeholder={values.name || "Same as name"} onChange={(e) => set("username", e.target.value)} />
        </Compact>
      </div>

      <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 gap-1 rounded-[9px] bg-zinc-100 p-1">
        {(
          [
            ["INDIVIDUAL", "Individual", UserRound],
            ["COMPANY", "Company", Building2],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={values.type === value}
            onClick={() => set("type", value)}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] text-[13px] font-medium transition",
              values.type === value ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-zinc-500 hover:text-zinc-800",
            )}
          >
            <Icon aria-hidden="true" className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      <Compact label="Email" htmlFor={id("email")} optional>
        <Input id={id("email")} type="email" value={values.email} placeholder="name@example.com" onChange={(e) => set("email", e.target.value)} />
      </Compact>

      <div className="grid gap-3 sm:grid-cols-2">
        <Compact label="Phone" htmlFor={id("phone")} optional>
          <Input id={id("phone")} type="tel" inputMode="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} />
        </Compact>
        <Compact label="WhatsApp" htmlFor={id("whatsapp")} optional>
          <Input id={id("whatsapp")} type="tel" inputMode="tel" value={values.whatsapp} placeholder="+92 300 1234567" onChange={(e) => set("whatsapp", e.target.value)} />
        </Compact>
      </div>

      <Compact label="Notes" htmlFor={id("notes")} optional>
        <Textarea id={id("notes")} rows={2} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
      </Compact>
    </div>
  );
}

function Compact({ label, htmlFor, optional = false, children }: { label: string; htmlFor: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <label htmlFor={htmlFor} className="text-[12px] font-medium text-zinc-700">
          {label}
        </label>
        {optional ? <span className="text-[11px] text-zinc-400">Optional</span> : null}
      </div>
      {children}
    </div>
  );
}

/** What the create/update actions take. */
export function customerPayload(values: CustomerFieldValues) {
  return {
    name: values.name,
    username: values.username || undefined,
    type: values.type,
    email: values.email || undefined,
    phone: values.phone || undefined,
    whatsappNumber: values.whatsapp || undefined,
    notes: values.notes || undefined,
  };
}
