"use client";

import { CircleAlert, Loader2, Lock, Pencil, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { updateEmployeeProfileAction } from "@/lib/access/actions";
import { cn } from "@/lib/utils";

/**
 * Edit Profile for an employee (2026-11-04, owner request). Saves through
 * `updateEmployeeProfileAction` (users.edit), which re-validates everything
 * and enforces: no changing your own roles or status, no giving a role with
 * permissions you don't have, and no change that leaves nobody able to
 * administer the app. The checks here only give quicker feedback.
 */

export type EditableEmployee = {
  id: string;
  fullName: string;
  displayName: string | null;
  email: string;
  jobTitle: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  isActive: boolean;
  roleIds: string[];
  categories: string[];
  commissionPercent: number | null;
};

export type RoleOption = { id: string; name: string; description: string | null };

type Draft = {
  fullName: string;
  displayName: string;
  jobTitle: string;
  phone: string;
  whatsappNumber: string;
  isActive: boolean;
  roleIds: string[];
  commissionPercent: string;
};

type FieldKey = "fullName" | "displayName" | "jobTitle" | "phone" | "whatsappNumber" | "commissionPercent";
type Errors = Partial<Record<FieldKey, string>>;

const PHONE = /^\+?[0-9\s().-]{6,32}$/;

const toDraft = (e: EditableEmployee): Draft => ({
  fullName: e.fullName,
  displayName: e.displayName ?? "",
  jobTitle: e.jobTitle ?? "",
  phone: e.phone ?? "",
  whatsappNumber: e.whatsappNumber ?? "",
  isActive: e.isActive,
  roleIds: [...e.roleIds].sort(),
  commissionPercent: e.commissionPercent === null ? "" : String(e.commissionPercent),
});

function validate(d: Draft): Errors {
  const errors: Errors = {};
  if (!d.fullName.trim()) errors.fullName = "Name is required.";
  else if (d.fullName.trim().length > 160) errors.fullName = "Name can be at most 160 characters.";
  if (d.displayName.trim().length > 80) errors.displayName = "Display name can be at most 80 characters.";
  if (d.jobTitle.trim().length > 120) errors.jobTitle = "Job title can be at most 120 characters.";
  if (d.phone.trim() && !PHONE.test(d.phone.trim())) errors.phone = "Enter a phone number, e.g. +92 300 1234567.";
  if (d.whatsappNumber.trim() && !PHONE.test(d.whatsappNumber.trim())) {
    errors.whatsappNumber = "Enter a phone number, e.g. +92 300 1234567.";
  }
  const commission = d.commissionPercent.trim();
  if (commission && (!/^\d{1,3}(\.\d{1,2})?$/.test(commission) || Number(commission) > 100)) {
    errors.commissionPercent = "Enter a percentage from 0 to 100, e.g. 10 or 7.5.";
  }
  return errors;
}

const FIELD_IDS: Record<FieldKey, string> = {
  fullName: "edit-employee-name",
  displayName: "edit-employee-display-name",
  jobTitle: "edit-employee-job-title",
  phone: "edit-employee-phone",
  whatsappNumber: "edit-employee-whatsapp",
  commissionPercent: "edit-employee-commission",
};

const FIELD = "h-10 rounded-[8px]";

export function EditProfileButton({
  employee,
  roles,
  isSelf,
  fiverrFeePercent,
}: {
  employee: EditableEmployee;
  roles: readonly RoleOption[];
  /** Editing your own profile: roles, status and commission are locked (server rule). */
  isSelf: boolean;
  /** From Settings, to explain how commission is worked out. */
  fiverrFeePercent: number;
}) {
  const [open, setOpen] = useState(false);
  // Remount the form on each open so it always starts from the saved values.
  const [session, setSession] = useState(0);

  return (
    <>
      <Button
        variant="secondary"
        className="rounded-[8px]"
        onClick={() => {
          setSession((n) => n + 1);
          setOpen(true);
        }}
      >
        <Pencil aria-hidden="true" />
        Edit profile
      </Button>
      {open ? (
        <EditProfileDialog
          key={session}
          employee={employee}
          roles={roles}
          isSelf={isSelf}
          fiverrFeePercent={fiverrFeePercent}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function EditProfileDialog({
  employee,
  roles,
  isSelf,
  fiverrFeePercent,
  onClose,
}: {
  employee: EditableEmployee;
  roles: readonly RoleOption[];
  isSelf: boolean;
  fiverrFeePercent: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const initial = useMemo(() => toDraft(employee), [employee]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | undefined>();

  const dirty = JSON.stringify({ ...draft, roleIds: [...draft.roleIds].sort() }) !== JSON.stringify(initial);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const requestClose = () => {
    if (pending) return;
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    onClose();
  };

  const toggleRole = (roleId: string) =>
    set("roleIds", draft.roleIds.includes(roleId) ? draft.roleIds.filter((id) => id !== roleId) : [...draft.roleIds, roleId]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending || submitting.current) return;
    const found = validate(draft);
    setErrors(found);
    setServerError(undefined);
    const first = (Object.keys(FIELD_IDS) as FieldKey[]).find((key) => found[key]);
    if (first) {
      document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }

    submitting.current = true;
    startTransition(async () => {
      try {
        const result = await updateEmployeeProfileAction({
          userId: employee.id,
          fullName: draft.fullName,
          displayName: draft.displayName,
          jobTitle: draft.jobTitle,
          phone: draft.phone,
          whatsappNumber: draft.whatsappNumber,
          isActive: draft.isActive,
          roleIds: draft.roleIds,
          commissionPercent: draft.commissionPercent.trim(),
        });
        if (result.ok) {
          toast.success(result.message);
          onClose();
          router.refresh();
        } else {
          // Keep what they typed; show why it failed.
          setServerError(result.error);
          toast.error(result.error);
        }
      } catch {
        setServerError("Something went wrong while saving. Please try again.");
      } finally {
        submitting.current = false;
      }
    });
  };

  const textField = (key: FieldKey, label: string, props: { placeholder?: string; hint?: string; type?: string } = {}) => (
    <Field label={label} htmlFor={FIELD_IDS[key]} error={errors[key]} hint={props.hint}>
      <Input
        id={FIELD_IDS[key]}
        type={props.type ?? "text"}
        className={FIELD}
        placeholder={props.placeholder}
        value={draft[key]}
        onChange={(event) => set(key, event.target.value)}
        aria-invalid={errors[key] ? true : undefined}
      />
    </Field>
  );

  return (
    <Modal
      open
      onClose={onClose}
      onCancel={(event) => {
        // Escape: ask first if there are unsaved changes.
        if (pending || (dirty && !window.confirm("Discard your unsaved changes?"))) event.preventDefault();
      }}
      labelledBy="edit-employee-title"
      className="m-auto w-full max-w-2xl rounded-[16px] border border-zinc-200/80 bg-white p-0 text-ink shadow-[0_24px_64px_-16px_rgba(16,24,40,0.35)] backdrop:bg-zinc-950/30 backdrop:backdrop-blur-[2px]"
    >
      <form onSubmit={submit} noValidate aria-busy={pending}>
        <div className="flex items-start gap-3 border-b border-zinc-100 px-6 py-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-indigo-50 text-indigo-600">
            <UserRound aria-hidden="true" className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 id="edit-employee-title" className="text-[15px] font-semibold text-zinc-900">
              Edit profile
            </h2>
            <p className="mt-0.5 truncate text-[13px] text-zinc-500">{employee.email}</p>
          </div>
        </div>

        <fieldset disabled={pending} className="max-h-[68vh] space-y-6 overflow-y-auto px-6 py-5">
          {/* Profile */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Profile</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{textField("fullName", "Full name")}</div>
              {textField("displayName", "Display name", { hint: "Optional. A shorter name shown in the app." })}
              {textField("jobTitle", "Job title", { placeholder: "e.g. Account manager" })}
              {textField("phone", "Phone", { type: "tel", placeholder: "+92 300 1234567" })}
              {textField("whatsappNumber", "WhatsApp", { type: "tel", placeholder: "+92 300 1234567" })}
            </div>
          </section>

          {/* Access */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Access</h3>
              {isSelf ? (
                <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                  <Lock aria-hidden="true" className="size-3" />
                  You can&apos;t change your own roles, status or commission
                </span>
              ) : null}
            </div>

            <div>
              <p id="edit-employee-status-label" className="mb-1.5 text-[13px] font-medium text-ink">
                Account status
              </p>
              <div
                role="radiogroup"
                aria-labelledby="edit-employee-status-label"
                className={cn(
                  "inline-grid grid-cols-2 gap-1 rounded-[9px] bg-zinc-100 p-1 ring-1 ring-inset ring-zinc-200/70",
                  isSelf && "opacity-60",
                )}
              >
                {[
                  { value: true, label: "Active" },
                  { value: false, label: "Inactive" },
                ].map((option) => (
                  <label key={option.label} className="relative">
                    <input
                      type="radio"
                      name="edit-employee-status"
                      className="peer sr-only"
                      checked={draft.isActive === option.value}
                      disabled={isSelf}
                      onChange={() => set("isActive", option.value)}
                    />
                    <span className="block cursor-pointer rounded-[6px] px-4 py-1.5 text-[13px] font-medium text-zinc-500 transition peer-checked:bg-white peer-checked:text-zinc-900 peer-checked:shadow-[0_1px_2px_rgba(16,24,40,0.08)] peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500/40 peer-disabled:cursor-not-allowed">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
              {!draft.isActive && employee.isActive ? (
                <p className="mt-1.5 text-xs text-amber-700">Inactive accounts can&apos;t sign in and lose all permissions.</p>
              ) : null}
            </div>

            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink">Roles</p>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {roles.map((role) => {
                  const checked = draft.roleIds.includes(role.id);
                  return (
                    <li key={role.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-[10px] border px-3 py-2.5 transition",
                          checked ? "border-indigo-300 bg-indigo-50/60" : "border-zinc-200 hover:border-zinc-300",
                          isSelf && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                          checked={checked}
                          disabled={isSelf}
                          onChange={() => toggleRole(role.id)}
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-900">
                            {role.name}
                            {checked ? <ShieldCheck aria-hidden="true" className="size-3.5 text-indigo-600" /> : null}
                          </span>
                          {role.description ? (
                            <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500">{role.description}</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {draft.roleIds.length === 0 ? (
                <p className="mt-1.5 text-xs text-amber-700">With no role, this person has no permissions.</p>
              ) : null}
            </div>

            <CommissionField
              value={draft.commissionPercent}
              onChange={(value) => set("commissionPercent", value)}
              error={errors.commissionPercent}
              disabled={isSelf}
              fiverrFeePercent={fiverrFeePercent}
            />
          </section>

          {/* Read-only */}
          <section className="space-y-2 rounded-[12px] bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200/70">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Lock aria-hidden="true" className="size-3" />
              Not editable here
            </h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Email</dt>
                <dd className="truncate font-medium text-zinc-800">{employee.email}</dd>
                <dd className="text-xs text-zinc-500">Also their sign-in, so it isn&apos;t changed here.</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Categories / services</dt>
                <dd className="font-medium text-zinc-800">
                  {employee.categories.length > 0 ? employee.categories.join(", ") : "None yet"}
                </dd>
                <dd className="text-xs text-zinc-500">Comes from the orders they create.</dd>
              </div>
            </dl>
          </section>

          {serverError ? (
            <p role="alert" className="flex items-start gap-2 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {serverError}
            </p>
          ) : null}
        </fieldset>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-6 py-4">
          <p className="text-xs text-zinc-500">{dirty ? "You have unsaved changes." : "No changes yet."}</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="rounded-[8px]" onClick={requestClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" className="rounded-[8px]" disabled={pending || !dirty}>
              {pending ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Commission on the orders this person creates (2026-11-04). Empty = none.
 * The worked example uses the same rule as src/lib/finance/commission.ts.
 */
function CommissionField({
  value,
  onChange,
  error,
  disabled,
  fiverrFeePercent,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled: boolean;
  fiverrFeePercent: number;
}) {
  const percent = /^\d{1,3}(\.\d{1,2})?$/.test(value.trim()) ? Number(value) : null;
  const example = (base: number) => ((base * (percent ?? 0)) / 100).toFixed(2);
  return (
    <div>
      <Field label="Commission" htmlFor="edit-employee-commission" error={error}>
        <div className="relative w-40">
          <Input
            id="edit-employee-commission"
            inputMode="decimal"
            className={cn(FIELD, "pr-8 tabular-nums")}
            placeholder="None"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby="edit-employee-commission-help"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-zinc-500">%</span>
        </div>
      </Field>
      <p id="edit-employee-commission-help" className="mt-1.5 text-xs text-zinc-500">
        Of each order they create. Fiverr orders count after the {fiverrFeePercent}% Fiverr fee. Leave empty for no commission.
        {percent ? (
          <span className="mt-0.5 block text-zinc-600">
            On a 100.00 order: <span className="font-medium tabular-nums">{example(100 * (1 - fiverrFeePercent / 100))}</span> (Fiverr) ·{" "}
            <span className="font-medium tabular-nums">{example(100)}</span> (External)
          </span>
        ) : null}
      </p>
    </div>
  );
}
