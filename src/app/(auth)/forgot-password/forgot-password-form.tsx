"use client";

import { useActionState } from "react";

import { AUTH_BUTTON_CLASS, AUTH_FIELD_CLASS } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { requestPasswordResetAction, type RequestResetState } from "@/lib/auth/actions";

const INITIAL: RequestResetState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, INITIAL);

  if (state.sent) {
    return (
      <p role="status" className="rounded-[10px] border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-[13px] text-emerald-900">
        If that address has an account, a reset link is on its way. It expires soon, so use it
        promptly.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="name@example.com"
          className={AUTH_FIELD_CLASS}
          required
          aria-invalid={state.fieldErrors?.email ? true : undefined}
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" disabled={pending} className={AUTH_BUTTON_CLASS}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
