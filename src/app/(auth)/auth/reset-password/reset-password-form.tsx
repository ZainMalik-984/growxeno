"use client";

import { Check, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { type ReactNode, useActionState, useState } from "react";

import { AUTH_ALERT_CLASS, AUTH_BUTTON_CLASS, AUTH_FIELD_CLASS, AUTH_FIELD_ICON_CLASS, AuthField, AuthSubmitLabel } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <form action={formAction} className="gx-stagger space-y-5" noValidate>
      <AuthField label="Password" htmlFor="password" error={state.fieldErrors?.password} icon={<LockKeyhole />}>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            placeholder={`At least ${MIN_LENGTH} characters`}
            className={cn(AUTH_FIELD_CLASS, AUTH_FIELD_ICON_CLASS, "pr-12")}
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
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-[14px] text-[var(--gx-dim)] transition-colors hover:text-[var(--gx-text)] focus-visible:text-[var(--gx-text)] focus-visible:outline-none"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
          >
            {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
          </button>
        </div>
      </AuthField>

      {/* Live strength meter: four segments, filled as the password gets stronger. */}
      <div id="password-checks" className="-mt-2 space-y-2.5">
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-300",
                i < strength.score ? strength.barClass : "bg-[var(--gx-line)]",
              )}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-xs">
          <Requirement met={longEnough}>At least {MIN_LENGTH} characters</Requirement>
          {password ? <span className={cn("font-medium", strength.textClass)}>{strength.label}</span> : null}
        </div>
      </div>

      <AuthField label="Confirm password" htmlFor="confirmPassword" error={state.fieldErrors?.confirmPassword} icon={<LockKeyhole />}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Type it again"
          className={cn(AUTH_FIELD_CLASS, AUTH_FIELD_ICON_CLASS)}
          required
          minLength={MIN_LENGTH}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          aria-invalid={state.fieldErrors?.confirmPassword ? true : undefined}
        />
      </AuthField>
      {confirm && !state.fieldErrors?.confirmPassword ? (
        <p className="gx-fade -mt-3 text-xs">
          <Requirement met={matches}>{matches ? "Passwords match" : "Passwords don't match yet"}</Requirement>
        </p>
      ) : null}

      {state.error ? (
        <p role="alert" className={AUTH_ALERT_CLASS}>
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="lg" disabled={pending} className={AUTH_BUTTON_CLASS}>
        <AuthSubmitLabel pending={pending} idle={submitLabel} busy="Saving…" />
      </Button>
    </form>
  );
}

function Requirement({ met, children }: { met: boolean; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 transition-colors", met ? "text-[var(--gx-accent)]" : "text-[var(--gx-muted)]")}>
      <span
        className={cn(
          "grid size-4 place-items-center rounded-full transition-colors",
          met ? "bg-[var(--gx-accent)] text-[var(--gx-accent-ink)]" : "bg-[var(--gx-line)] text-transparent",
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
    { label: "Too short", barClass: "bg-red-400", textClass: "text-red-300" },
    { label: "Weak", barClass: "bg-red-400", textClass: "text-red-300" },
    { label: "Fair", barClass: "bg-amber-400", textClass: "text-amber-300" },
    { label: "Good", barClass: "bg-[var(--gx-accent-hi)]", textClass: "text-[var(--gx-accent-hi)]" },
    { label: "Strong", barClass: "bg-[var(--gx-accent)]", textClass: "text-[var(--gx-accent)]" },
  ];
  const level = value.length < MIN_LENGTH ? levels[0] : levels[Math.min(score, 4)];
  return { score, ...level };
}
