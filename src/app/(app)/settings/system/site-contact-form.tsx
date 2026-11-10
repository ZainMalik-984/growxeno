"use client";

import { ExternalLink, Mail, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ComponentType, type ReactNode, useState, useTransition } from "react";
import { SiFacebook, SiInstagram, SiWhatsapp, SiX } from "react-icons/si";
import { toast } from "sonner";

import { Field, Input, Textarea } from "@/components/ui/input";
import { saveSiteContactAction } from "@/lib/settings/actions";
import {
  DEFAULT_WHATSAPP_MESSAGE,
  normalizeSocialLink,
  siteContactSchema,
  SOCIAL_LABELS,
  whatsappHref,
  type SiteContact,
  type SocialKind,
} from "@/lib/settings/site-contact";
import { cn } from "@/lib/utils";
import { SaveBar, SettingsGroup, useUnsavedWarning } from "./settings-ui";

type Draft = Record<"email" | "phone" | "whatsapp" | "whatsappMessage" | SocialKind, string>;
type Errors = Partial<Record<keyof Draft, string>>;

const toDraft = (c: SiteContact): Draft => ({
  email: c.email,
  phone: c.phone ?? "",
  whatsapp: c.whatsapp ?? "",
  whatsappMessage: c.whatsappMessage ?? "",
  instagram: c.instagram ?? "",
  twitter: c.twitter ?? "",
  facebook: c.facebook ?? "",
});

const SOCIAL_FIELDS: Array<{ key: SocialKind; Icon: ComponentType<{ className?: string }>; placeholder: string; color: string }> = [
  { key: "instagram", Icon: SiInstagram, placeholder: "@growxeno or instagram.com/growxeno", color: "text-[#E4405F]" },
  { key: "twitter", Icon: SiX, placeholder: "@growxeno or x.com/growxeno", color: "text-zinc-900" },
  { key: "facebook", Icon: SiFacebook, placeholder: "facebook.com/growxeno", color: "text-[#1877F2]" },
];

const MESSAGE_LIMIT = 500;

/** Contact details and social profiles on the public website (2026-11-04). */
export function SiteContactForm({ initial, canEdit }: { initial: SiteContact; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<Draft>(toDraft(initial));
  const [draft, setDraft] = useState<Draft>(saved);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | undefined>();
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsavedWarning(dirty);

  const set = (key: keyof Draft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setServerError(undefined);
  };

  const save = () => {
    const parsed = siteContactSchema.safeParse(draft);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Draft] ??= issue.message;
      setErrors(next);
      const first = Object.keys(next)[0];
      if (first) document.getElementById(`site-${first}`)?.focus();
      return;
    }
    startTransition(async () => {
      const result = await saveSiteContactAction(parsed.data);
      if (result.ok) {
        toast.success(result.message);
        // Show the cleaned-up values (e.g. @handle → full link) as the saved state.
        const clean = toDraft(parsed.data);
        setSaved(clean);
        setDraft(clean);
        router.refresh();
      } else {
        setServerError(result.error);
      }
    });
  };

  const previewSocial = SOCIAL_FIELDS.map((f) => ({ ...f, link: normalizeSocialLink(f.key, draft[f.key]) })).filter((f) => f.link);
  const whatsappLink = draft.whatsapp.trim() ? whatsappHref(draft.whatsapp, draft.whatsappMessage.trim() || null) : null;

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <fieldset disabled={!canEdit || pending} className="min-w-0 space-y-5">
        <SettingsGroup title="Email & phone" description="The email is required; the Email us buttons point to it.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <IconField id="site-email" label="Email" icon={<Mail className="size-4 text-zinc-400" aria-hidden />} error={errors.email}>
              <Input id="site-email" type="email" className="h-10 rounded-[8px] pl-9" placeholder="hello@growxeno.com" value={draft.email}
                aria-invalid={errors.email ? true : undefined} onChange={(e) => set("email", e.target.value)} />
            </IconField>
            <IconField id="site-phone" label="Phone" hint="Optional. Hidden when empty." icon={<Phone className="size-4 text-zinc-400" aria-hidden />} error={errors.phone}>
              <Input id="site-phone" type="tel" className="h-10 rounded-[8px] pl-9" placeholder="+92 300 1234567" value={draft.phone}
                aria-invalid={errors.phone ? true : undefined} onChange={(e) => set("phone", e.target.value)} />
            </IconField>
          </div>
        </SettingsGroup>

        <SettingsGroup title="WhatsApp" description="Visitors tap WhatsApp and a chat opens with this message already typed.">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-4">
              <IconField id="site-whatsapp" label="WhatsApp number" hint="With country code. Optional." icon={<SiWhatsapp className="size-4 text-[#25D366]" />} error={errors.whatsapp}>
                <Input id="site-whatsapp" type="tel" className="h-10 rounded-[8px] pl-9" placeholder="+92 300 1234567" value={draft.whatsapp}
                  aria-invalid={errors.whatsapp ? true : undefined} onChange={(e) => set("whatsapp", e.target.value)} />
              </IconField>
              <Field label="Opening message" htmlFor="site-whatsappMessage" error={errors.whatsappMessage}>
                <Textarea id="site-whatsappMessage" rows={3} className="rounded-[8px]" value={draft.whatsappMessage} maxLength={MESSAGE_LIMIT}
                  placeholder={DEFAULT_WHATSAPP_MESSAGE} onChange={(e) => set("whatsappMessage", e.target.value)} />
              </Field>
              <div className="-mt-2 flex items-center justify-between text-xs text-zinc-500">
                <button type="button" className="font-medium text-indigo-600 hover:underline disabled:opacity-50" onClick={() => set("whatsappMessage", DEFAULT_WHATSAPP_MESSAGE)}>
                  Use the default text
                </button>
                <span className="tabular-nums">{draft.whatsappMessage.length}/{MESSAGE_LIMIT}</span>
              </div>
            </div>

            {/* Chat preview */}
            <div className="rounded-[12px] bg-[#efeae2] p-3 ring-1 ring-inset ring-zinc-200/70">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                <SiWhatsapp className="size-3 text-[#25D366]" /> Preview
              </p>
              <div className="ml-auto max-w-[90%] rounded-[10px] rounded-tr-[2px] bg-[#d9fdd3] px-3 py-2 text-[13px] leading-snug text-zinc-800 shadow-[0_1px_1px_rgba(0,0,0,0.08)]">
                {draft.whatsappMessage.trim() || <span className="italic text-zinc-500">No message — the chat opens empty.</span>}
              </div>
              {whatsappLink ? (
                <a href={whatsappLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline">
                  Try it <ExternalLink aria-hidden="true" className="size-3" />
                </a>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">Add a number to try the link.</p>
              )}
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup title="Social profiles" description="Paste a profile link or type an @handle. Only the ones you fill in appear on the website.">
          <div className="space-y-4">
            {SOCIAL_FIELDS.map(({ key, Icon, placeholder, color }) => {
              const link = normalizeSocialLink(key, draft[key]);
              return (
                <IconField key={key} id={`site-${key}`} label={SOCIAL_LABELS[key]} icon={<Icon className={cn("size-4", color)} />} error={errors[key]}
                  hint={draft[key].trim() ? (link ? <>Links to <a href={link} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">{link.replace(/^https:\/\//, "")}</a></> : undefined) : "Optional."}>
                  <Input id={`site-${key}`} className="h-10 rounded-[8px] pl-9" placeholder={placeholder} value={draft[key]}
                    aria-invalid={errors[key] || (draft[key].trim() && !link) ? true : undefined} onChange={(e) => set(key, e.target.value)} />
                </IconField>
              );
            })}
          </div>
        </SettingsGroup>

        <SaveBar
          dirty={dirty}
          pending={pending}
          error={serverError}
          canEdit={canEdit}
          onSave={save}
          onDiscard={() => {
            setDraft(saved);
            setErrors({});
            setServerError(undefined);
          }}
        />
      </fieldset>

      {/* How it looks on the website */}
      <aside className="rounded-[12px] border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] xl:sticky xl:top-20">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-zinc-900">On the website</p>
          <a href="/#contact" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
            Open <ExternalLink aria-hidden="true" className="size-3" />
          </a>
        </div>
        <p className="mt-0.5 text-xs text-zinc-500">The footer&apos;s Contact column, as visitors see it.</p>
        <div className="mt-4 rounded-[10px] bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200/70">
          <p className="text-[13px] font-semibold text-zinc-900">Contact</p>
          <ul className="mt-3 space-y-2 text-[13px] text-zinc-600">
            <li className="flex items-center gap-2"><Mail className="size-3.5" aria-hidden />{draft.email || <span className="text-red-600">Email required</span>}</li>
            {draft.phone.trim() ? <li className="flex items-center gap-2"><Phone className="size-3.5" aria-hidden />{draft.phone}</li> : null}
            <li className="text-zinc-500">Remote-first, worldwide</li>
          </ul>
          {whatsappLink || previewSocial.length > 0 ? (
            <ul className="mt-3 flex gap-2">
              {whatsappLink ? (
                <li className="grid size-8 place-items-center rounded-full border border-zinc-300 bg-white text-zinc-600" title="WhatsApp"><SiWhatsapp className="size-3.5" /></li>
              ) : null}
              {previewSocial.map(({ key, Icon }) => (
                <li key={key} className="grid size-8 place-items-center rounded-full border border-zinc-300 bg-white text-zinc-600" title={SOCIAL_LABELS[key]}><Icon className="size-3.5" /></li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-zinc-400">No WhatsApp or social links yet.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

/** A labelled input with an icon inside its left edge. */
function IconField({
  id,
  label,
  icon,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
        {children}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="truncate text-xs text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}
