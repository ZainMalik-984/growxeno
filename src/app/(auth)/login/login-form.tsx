"use client";

import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { AUTH_ALERT_CLASS, AUTH_BUTTON_CLASS, AUTH_FIELD_CLASS, AUTH_FIELD_ICON_CLASS, AUTH_LINK_CLASS, AuthField, AuthSubmitLabel } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const INITIAL: SignInState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signIn, INITIAL);
  const [visible, setVisible] = useState(false);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <AuthField label="Email" htmlFor="email" error={state.fieldErrors?.email} icon={<Mail />}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="name@example.com"
          className={cn(AUTH_FIELD_CLASS, AUTH_FIELD_ICON_CLASS)}
          required
          aria-invalid={state.fieldErrors?.email ? true : undefined}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        />
      </AuthField>

      <AuthField
        label="Password"
        htmlFor="password"
        error={state.fieldErrors?.password}
        icon={<LockKeyhole />}
        aside={
          <Link href="/forgot-password" className={cn("text-xs", AUTH_LINK_CLASS)}>
            Forgot password?
          </Link>
        }
      >
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className={cn(AUTH_FIELD_CLASS, AUTH_FIELD_ICON_CLASS, "pr-12")}
            required
            aria-invalid={state.fieldErrors?.password ? true : undefined}
            aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-[14px] text-[var(--gx-dim)] transition-colors hover:text-[var(--gx-text)] focus-visible:text-[var(--gx-text)] focus-visible:outline-none"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
          >
            {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
          </button>
        </div>
      </AuthField>

      {state.error ? (
        <p role="alert" className={AUTH_ALERT_CLASS}>
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="lg" disabled={pending} className={cn("mt-2", AUTH_BUTTON_CLASS)}>
        <AuthSubmitLabel pending={pending} idle="Sign in" busy="Signing in…" />
      </Button>
    </form>
  );
}
