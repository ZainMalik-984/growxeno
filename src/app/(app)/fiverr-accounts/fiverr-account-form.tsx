"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createFiverrAccountAction, revealFiverrPaypalPasswordAction, updateFiverrAccountAction } from "@/lib/fiverr-accounts/actions";

export type FiverrAccountFormInitial = {
  name: string;
  email: string | null;
  paypalEmail: string | null;
  hasPaypalPassword: boolean;
};

/**
 * Create/edit form for a Fiverr account. The PayPal password field is
 * write-only: it is always blank on load (never fetched — see
 * `getFiverrAccountDetail`), and left untouched means "no change" rather than
 * "clear it". Revealing the current password is a separate, explicit action
 * gated on `fiverr_accounts.credentials.view` — the button is only rendered
 * for someone holding it (`canRevealCredentials`), decided server-side.
 */
export function FiverrAccountForm({
  mode,
  accountId,
  initial,
  canRevealCredentials = false,
}: {
  mode: "create" | "edit";
  accountId?: string;
  initial?: FiverrAccountFormInitial;
  canRevealCredentials?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [paypalEmail, setPaypalEmail] = useState(initial?.paypalEmail ?? "");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    setError(undefined);
    startTransition(async () => {
      const payload = {
        name,
        email: email || undefined,
        paypalEmail: paypalEmail || undefined,
        paypalPassword: passwordTouched ? passwordInput : undefined,
      };
      const result =
        mode === "create"
          ? await createFiverrAccountAction(payload)
          : await updateFiverrAccountAction({ accountId: accountId!, ...payload });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      if (mode === "create" && "accountId" in result) router.push(`/fiverr-accounts/${result.accountId}`);
      else router.refresh();
    });
  };

  const reveal = () => {
    setRevealing(true);
    startTransition(async () => {
      const result = await revealFiverrPaypalPasswordAction({ accountId: accountId! });
      setRevealing(false);
      if (result.ok) setRevealedPassword(result.password);
      else toast.error(result.error);
    });
  };

  return (
    <div className="max-w-lg space-y-5">
      <Field label="Name" htmlFor="fiverr-account-name">
        <Input id="fiverr-account-name" required value={name} onChange={(event) => setName(event.target.value)} />
      </Field>

      <Field label="Email" htmlFor="fiverr-account-email" hint="Optional.">
        <Input id="fiverr-account-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>

      <Field label="PayPal email" htmlFor="fiverr-account-paypal-email" hint="Optional.">
        <Input id="fiverr-account-paypal-email" type="email" value={paypalEmail} onChange={(event) => setPaypalEmail(event.target.value)} />
      </Field>

      <Field
        label="PayPal password"
        htmlFor="fiverr-account-paypal-password"
        hint={
          mode === "edit" && initial?.hasPaypalPassword && !passwordTouched
            ? "A password is saved. Leave blank to keep it, or type a new one to replace it."
            : "Stored encrypted. Never shown again except on request."
        }
      >
        <Input
          id="fiverr-account-paypal-password"
          type="password"
          autoComplete="new-password"
          placeholder={mode === "edit" && initial?.hasPaypalPassword && !passwordTouched ? "•••••••• (unchanged)" : ""}
          value={passwordInput}
          onChange={(event) => {
            setPasswordInput(event.target.value);
            setPasswordTouched(true);
          }}
        />
      </Field>

      {mode === "edit" && initial?.hasPaypalPassword ? (
        <div className="text-[13px]">
          {revealedPassword !== null ? (
            <p className="text-ink">
              Current password: <span className="font-mono">{revealedPassword}</span>{" "}
              <button type="button" onClick={() => setRevealedPassword(null)} className="text-ink-muted underline hover:text-ink">
                Hide
              </button>
            </p>
          ) : canRevealCredentials ? (
            <button type="button" onClick={reveal} disabled={revealing} className="text-ink-muted underline hover:text-ink">
              {revealing ? "Revealing…" : "Show current password"}
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-[13px] text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="button" variant="primary" onClick={submit} disabled={pending || !name.trim()}>
        {pending ? "Saving…" : mode === "create" ? "Add account" : "Save changes"}
      </Button>
    </div>
  );
}
