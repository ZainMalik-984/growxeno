"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { updatePasswordAction, type UpdatePasswordState } from "@/lib/auth/actions";

const INITIAL: UpdatePasswordState = {};

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, INITIAL);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Field label="New password" htmlFor="password" error={state.fieldErrors?.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={state.fieldErrors?.password ? true : undefined}
        />
      </Field>

      <Field
        label="Confirm password"
        htmlFor="confirmPassword"
        error={state.fieldErrors?.confirmPassword}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={state.fieldErrors?.confirmPassword ? true : undefined}
        />
      </Field>

      {state.error ? (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
