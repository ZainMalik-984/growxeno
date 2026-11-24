"use client";

import { Mail } from "lucide-react";
import { useActionState } from "react";

import {
  AUTH_BUTTON_CLASS,
  AUTH_FIELD_CLASS,
  AUTH_FIELD_ICON_CLASS,
  AuthField,
  AuthSubmitLabel,
} from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordResetAction, type RequestResetState } from "@/lib/auth/actions";

const INITIAL: RequestResetState = {};

export function ExpiredLinkResend() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, INITIAL);

  if (state.sent) {
    return (
      <div role="status" className="gx-note gx-stagger py-1">
        <p className="text-[0.9375rem] font-medium text-[var(--gx-text)]">Check your inbox</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--gx-muted)]">
          A new link is on its way. It expires in 24 hours — use it promptly.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="gx-stagger space-y-6" noValidate>
      <AuthField label="Email" htmlFor="expired-email" error={state.fieldErrors?.email} icon={<Mail />}>
        <Input
          id="expired-email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          placeholder="name@example.com"
          className={`${AUTH_FIELD_CLASS} ${AUTH_FIELD_ICON_CLASS}`}
          required
          aria-invalid={state.fieldErrors?.email ? true : undefined}
        />
      </AuthField>

      <Button type="submit" variant="primary" size="lg" disabled={pending} className={AUTH_BUTTON_CLASS}>
        <AuthSubmitLabel pending={pending} idle="Send new link" busy="Sending…" />
      </Button>
    </form>
  );
}
