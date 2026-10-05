"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createUserAction } from "@/lib/access/actions";

/**
 * Invite a user (specification Section 4).
 *
 * No password field: the invited person sets their own via the emailed link.
 * Sending an admin-chosen password would mean an administrator temporarily
 * knows someone else's credential, which the invitation flow exists to avoid.
 */
export function CreateUserForm({ roles }: { roles: ReadonlyArray<{ id: string; name: string }> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();

  const toggleRole = (id: string, checked: boolean) => {
    setRoleIds((current) => (checked ? [...current, id] : current.filter((roleId) => roleId !== id)));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await createUserAction({
        email,
        fullName,
        jobTitle: jobTitle || undefined,
        roleIds,
      });
      if (result.ok) {
        toast.success(result.message);
        router.push(`/settings/users/${result.userId}`);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-5" noValidate>
      <Field label="Email" htmlFor="new-user-email">
        <Input
          id="new-user-email"
          type="email"
          autoComplete="off"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      <Field label="Full name" htmlFor="new-user-name">
        <Input
          id="new-user-name"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </Field>

      <Field label="Job title" htmlFor="new-user-job-title" hint="Optional.">
        <Input id="new-user-job-title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
      </Field>

      <fieldset>
        <legend className="text-[13px] font-medium text-ink">Roles</legend>
        {roles.length === 0 ? (
          <p className="mt-1 text-[13px] text-ink-faint">No roles exist yet.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={roleIds.includes(role.id)}
                  onChange={(event) => toggleRole(role.id, event.target.checked)}
                  className="size-3.5 accent-zinc-900"
                />
                {role.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {error ? (
        <p role="alert" className="text-[13px] text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={pending || !email.trim() || !fullName.trim()}>
        {pending ? "Sending invitation…" : "Send invitation"}
      </Button>
    </form>
  );
}
