"use client";

import { Mail, MailCheck } from "lucide-react";
import { useActionState } from "react";

import { AUTH_BUTTON_CLASS, AUTH_FIELD_CLASS, AUTH_FIELD_ICON_CLASS, AuthField, AuthSubmitLabel } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordResetAction, type RequestResetState } from "@/lib/auth/actions";

const INITIAL: RequestResetState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, INITIAL);

  if (state.sent) {
    return (
      <div role="status" className="flex gap-3.5 rounded-[14px] border border-[rgb(8_229_47/0.25)] bg-[rgb(8_229_47/0.06)] px-4 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--gx-accent)] text-[var(--gx-accent-ink)]">
          <MailCheck aria-hidden="true" className="size-4" />
        </span>
        <p className="text-[13px] leading-relaxed text-[var(--gx-text)]">
          If that address has an account, a reset link is on its way. It expires soon, so use it promptly.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <AuthField label="Email" htmlFor="email" error={state.fieldErrors?.email} icon={<Mail />}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="name@example.com"
          className={`${AUTH_FIELD_CLASS} ${AUTH_FIELD_ICON_CLASS}`}
          required
          aria-invalid={state.fieldErrors?.email ? true : undefined}
        />
      </AuthField>

      <Button type="submit" variant="primary" size="lg" disabled={pending} className={AUTH_BUTTON_CLASS}>
        <AuthSubmitLabel pending={pending} idle="Send reset link" busy="Sending…" />
      </Button>
    </form>
  );
}
