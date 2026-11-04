"use client";

import { Check, Eye, EyeOff } from "lucide-react";
import { type ReactNode, useActionState, useState } from "react";

import { AUTH_BUTTON_CLASS, AUTH_FIELD_CLASS } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { updatePasswordAction, type UpdatePasswordState } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const INITIAL: UpdatePasswordState = {};

/** Must match updatePasswordSchema in src/lib/auth/actions.ts. */
const MIN_LENGTH = 12;

export function ResetPasswordForm({ submitLabel = "Save password" }: { submitLabel?: string }) {
  const [state, formAction, pending] = useActionState(updatePasswordAction, INITIAL);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);

  const longEnough = password.length >= MIN_LENGTH;
  const matches = confirm.length > 0 && password === confirm;
  const strength = passwordStrength(password);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            placeholder={`At least ${MIN_LENGTH} characters`}
            className={cn(AUTH_FIELD_CLASS, "pr-11")}
            required
            minLength={MIN_LENGTH}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={state.fieldErrors?.password ? true : undefined}
            aria-describedby="password-checks"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[8px] text-zinc-400 transition hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
          >
            {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
          </button>
        </div>
      </Field>

      {/* Live strength meter: four segments, filled as the password gets stronger. */}
      <div id="password-checks" className="-mt-2 space-y-2.5">
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-300",
                i < strength.score ? strength.barClass : "bg-zinc-200",
              )}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-xs">
          <Requirement met={longEnough}>At least {MIN_LENGTH} characters</Requirement>
          {password ? <span className={cn("font-medium", strength.textClass)}>{strength.label}</span> : null}
        </div>
      </div>

      <Field label="Confirm password" htmlFor="confirmPassword" error={state.fieldErrors?.confirmPassword}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Type it again"
          className={AUTH_FIELD_CLASS}
          required
          minLength={MIN_LENGTH}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          aria-invalid={state.fieldErrors?.confirmPassword ? true : undefined}
        />
      </Field>
      {confirm && !state.fieldErrors?.confirmPassword ? (
        <p className="-mt-3 text-xs">
          <Requirement met={matches}>{matches ? "Passwords match" : "Passwords don't match yet"}</Requirement>
        </p>
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="lg" disabled={pending} className={AUTH_BUTTON_CLASS}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

function Requirement({ met, children }: { met: boolean; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 transition-colors", met ? "text-emerald-700" : "text-ink-muted")}>
      <span
        className={cn(
          "grid size-4 place-items-center rounded-full transition-colors",
          met ? "bg-emerald-500 text-white" : "bg-zinc-200 text-transparent",
        )}
        aria-hidden="true"
      >
        <Check className="size-2.5" strokeWidth={3} />
      </span>
      {children}
    </span>
  );
}

/** Rough guide only — the server enforces just the minimum length. */
function passwordStrength(value: string) {
  if (!value) return { score: 0, label: "", barClass: "", textClass: "" };
  let score = 0;
  if (value.length >= MIN_LENGTH) score += 1;
  if (value.length >= 16) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  if (value.length < MIN_LENGTH) score = Math.min(score, 1) || 1;
  const levels = [
    { label: "Too short", barClass: "bg-red-400", textClass: "text-red-600" },
    { label: "Weak", barClass: "bg-red-400", textClass: "text-red-600" },
    { label: "Fair", barClass: "bg-amber-400", textClass: "text-amber-700" },
    { label: "Good", barClass: "bg-emerald-400", textClass: "text-emerald-700" },
    { label: "Strong", barClass: "bg-emerald-500", textClass: "text-emerald-700" },
  ];
  const level = value.length < MIN_LENGTH ? levels[0] : levels[Math.min(score, 4)];
  return { score, ...level };
}
