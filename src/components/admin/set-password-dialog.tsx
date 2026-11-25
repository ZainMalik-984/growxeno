"use client";

import { KeyRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { setUserPasswordAction } from "@/lib/access/actions";

const SHEET =
  "mx-0 mb-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[14px] border border-zinc-200 bg-white p-0 text-ink shadow-xl shadow-zinc-900/10 backdrop:bg-zinc-950/40 backdrop:backdrop-blur-[2px] " +
  "sm:m-auto sm:max-h-[88dvh] sm:max-w-[440px] sm:rounded-[12px]";

export function SetPasswordButton({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <KeyRound aria-hidden="true" className="size-4" />
        Set password
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy="set-pw-title" className={SHEET}>
        {open ? <SetPasswordForm userId={userId} name={name} onClose={() => setOpen(false)} /> : null}
      </Modal>
    </>
  );
}

function SetPasswordForm({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(undefined);
    setFieldErrors({});
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await setUserPasswordAction({
        userId,
        password: data.get("password"),
        confirmPassword: data.get("confirmPassword"),
      });
      if (result.ok) {
        toast.success(result.message);
        formRef.current?.reset();
        onClose();
        router.refresh();
      } else if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  };

  return (
    <div className="flex max-h-[inherit] flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4">
        <h2 id="set-pw-title" className="text-[15px] font-semibold text-zinc-900">
          Set password — {name}
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded-[6px] p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5 overflow-y-auto px-5 py-5">
        {error ? (
          <p className="rounded-[10px] bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>
        ) : null}

        <FormField label="New password" htmlFor="sp-password" error={fieldErrors.password}>
          <Input
            id="sp-password"
            name="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            required
            placeholder="At least 12 characters"
            aria-invalid={!!fieldErrors.password}
          />
        </FormField>

        <FormField label="Confirm password" htmlFor="sp-confirm" error={fieldErrors.confirmPassword}>
          <Input
            id="sp-confirm"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Repeat the password"
            aria-invalid={!!fieldErrors.confirmPassword}
          />
        </FormField>

        <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save password"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function FormField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-zinc-700">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
