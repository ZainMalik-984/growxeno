"use client";

import { Eye, EyeOff, KeyRound, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SURFACE_CLASS } from "@/components/ui/page";
import { changePasswordAction, savePaymentDetailsAction } from "@/lib/profile/actions";
import { cn } from "@/lib/utils";

/** Profile page body (2026-11-19): who you are, payment details (workers), change password. */
export function ProfileForms({
  name,
  email,
  roles,
  paymentDetails,
}: {
  name: string;
  email: string;
  roles: readonly string[];
  /** Null for anyone who isn't an outsourced worker (no payment details section). */
  paymentDetails: string | null;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="space-y-4">
      <section className={cn(SURFACE_CLASS, "flex items-center gap-4 p-5")}>
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-indigo-50 text-[15px] font-semibold text-indigo-700">
          {initials || "?"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-zinc-900">{name}</p>
          <p className="truncate text-[13px] text-zinc-500">{email}</p>
          {roles.length > 0 ? <p className="mt-0.5 text-xs text-zinc-400">{roles.join(", ")}</p> : null}
        </div>
      </section>

      {paymentDetails !== null ? <PaymentDetailsForm initial={paymentDetails} /> : null}
      <ChangePasswordForm />
    </div>
  );
}

function Panel({ icon, title, hint, children }: { icon: ReactNode; title: string; hint: string; children: ReactNode }) {
  return (
    <section className={cn(SURFACE_CLASS, "p-5")}>
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-zinc-100 text-zinc-600 [&_svg]:size-4">{icon}</span>
        <div>
          <h2 className="text-[14px] font-semibold text-zinc-900">{title}</h2>
          <p className="text-[13px] text-zinc-500">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function PaymentDetailsForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await savePaymentDetailsAction({ paymentDetails: value });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(value.trim());
      toast.success(result.message);
      router.refresh();
    });
  };

  return (
    <Panel icon={<Wallet />} title="Payment details" hint="How you want to be paid. Only you and the admins see this.">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Payment details"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={500}
          placeholder="e.g. JazzCash 0300 1234567, Zia Ali"
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="primary" disabled={pending || value.trim() === saved}>
          Save
        </Button>
      </form>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </Panel>
  );
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await changePasswordAction({ currentPassword: current, password: next, confirmPassword: confirm });
      if (!result.ok) {
        setError({ message: result.error, field: result.field });
        return;
      }
      toast.success(result.message);
      setCurrent("");
      setNext("");
      setConfirm("");
    });
  };

  const type = show ? "text" : "password";
  const fieldError = (field: string) =>
    error?.field === field ? (
      <p role="alert" className="mt-1 text-xs text-red-600">
        {error.message}
      </p>
    ) : null;

  return (
    <Panel icon={<KeyRound />} title="Change password" hint="At least 12 characters.">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="profile-current-password" className="mb-1.5 block text-[13px] font-medium text-zinc-800">
            Current password
          </label>
          <Input id="profile-current-password" type={type} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-invalid={error?.field === "currentPassword" || undefined} />
          {fieldError("currentPassword")}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-new-password" className="mb-1.5 block text-[13px] font-medium text-zinc-800">
              New password
            </label>
            <Input id="profile-new-password" type={type} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={error?.field === "password" || undefined} />
            {fieldError("password")}
          </div>
          <div>
            <label htmlFor="profile-confirm-password" className="mb-1.5 block text-[13px] font-medium text-zinc-800">
              Confirm new password
            </label>
            <Input id="profile-confirm-password" type={type} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={error?.field === "confirmPassword" || undefined} />
            {fieldError("confirmPassword")}
          </div>
        </div>
        {error && !error.field ? (
          <p role="alert" className="text-xs text-red-600">
            {error.message}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button type="button" onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800">
            {show ? <EyeOff aria-hidden className="size-3.5" /> : <Eye aria-hidden className="size-3.5" />}
            {show ? "Hide passwords" : "Show passwords"}
          </button>
          <Button type="submit" variant="primary" disabled={pending || !current || !next || !confirm}>
            {pending ? "Changing…" : "Change password"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
