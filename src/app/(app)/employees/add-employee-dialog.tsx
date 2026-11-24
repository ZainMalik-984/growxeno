"use client";

import { Plus, UserRoundPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createUserAction } from "@/lib/access/actions";

const SHEET =
  "mx-0 mb-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[14px] border border-zinc-200 bg-white p-0 text-ink shadow-xl shadow-zinc-900/10 backdrop:bg-zinc-950/40 backdrop:backdrop-blur-[2px] " +
  "sm:m-auto sm:max-h-[88dvh] sm:max-w-[480px] sm:rounded-[12px]";

export function AddEmployeeButton({ roles }: { roles: ReadonlyArray<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Add employee
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy="add-employee-title" className={SHEET}>
        {open ? <AddEmployeeForm roles={roles} onClose={() => setOpen(false)} /> : null}
      </Modal>
    </>
  );
}

function AddEmployeeForm({
  roles,
  onClose,
}: {
  roles: ReadonlyArray<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();

  const toggleRole = (roleId: string, checked: boolean) => {
    setRoleIds((current) => (checked ? [...current, roleId] : current.filter((r) => r !== roleId)));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await createUserAction({ email, fullName, jobTitle: jobTitle || undefined, roleIds });
      if (result.ok) {
        toast.success(result.message);
        router.push(`/employees/${result.userId}`);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex max-h-[inherit] flex-col">
      <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
          <UserRoundPlus aria-hidden className="size-4" />
        </span>
        <h2 id="add-employee-title" className="min-w-0 flex-1 text-[15px] font-semibold text-zinc-900">
          Add employee
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1.5 rounded-[6px] p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
        <Field label="Email" htmlFor={`${id}-email`}>
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="off"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </Field>

        <Field label="Full name" htmlFor={`${id}-name`}>
          <Input
            id={`${id}-name`}
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>

        <Field label="Job title" htmlFor={`${id}-job-title`} hint="Optional.">
          <Input id={`${id}-job-title`} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        </Field>

        {roles.length > 0 && (
          <fieldset>
            <legend className="text-[13px] font-medium text-zinc-800">Roles</legend>
            <div className="mt-2 space-y-1.5">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-[13px] text-zinc-700">
                  <input
                    type="checkbox"
                    checked={roleIds.includes(role.id)}
                    onChange={(e) => toggleRole(role.id, e.target.checked)}
                    className="size-3.5 rounded border-zinc-300 accent-indigo-600"
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {error ? (
          <p role="alert" className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/70 px-5 py-3">
        <Button type="button" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending || !email.trim() || !fullName.trim()}>
          {pending ? "Sending invitation…" : "Send invitation"}
        </Button>
      </div>
    </form>
  );
}
