"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { requestPasswordResetAction, type RequestResetState } from "@/lib/auth/actions";

const INITIAL: RequestResetState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, INITIAL);

  if (state.sent) {
    return (
      <p className="text-[13px] text-ink">
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
          required
          aria-invalid={state.fieldErrors?.email ? true : undefined}
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
