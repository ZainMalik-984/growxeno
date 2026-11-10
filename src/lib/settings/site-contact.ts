import { z } from "zod";

/**
 * Contact details shown on the public home page (owner request, 2026-11-04):
 * email, phone, WhatsApp (with the message it opens with) and social profiles
 * (Instagram, X/Twitter, Facebook page). Edited in Settings → Website →
 * Contact details (`settings.edit`, which only Super Admin holds by default).
 * Pure, so it is unit-tested.
 */

export const SITE_CONTACT_SETTING_KEY = "site_contact";

const PHONE = /^\+?[0-9\s().-]{6,32}$/;

export const DEFAULT_WHATSAPP_MESSAGE = "Hi Grow Xeno, I'd like to know more about your services.";

const optionalPhone = (label: string) =>
  z
    .string()
    .trim()
    .max(32, `${label} is too long.`)
    .nullable()
    .optional()
    .transform((value) => value || null)
    .refine((value) => value === null || PHONE.test(value), `${label} should look like +92 300 1234567.`);

export type SocialKind = "instagram" | "twitter" | "facebook";

const SOCIAL: Record<SocialKind, { label: string; hosts: string[]; base: string }> = {
  instagram: { label: "Instagram", hosts: ["instagram.com"], base: "https://www.instagram.com/" },
  twitter: { label: "X (Twitter)", hosts: ["x.com", "twitter.com"], base: "https://x.com/" },
  facebook: { label: "Facebook", hosts: ["facebook.com", "fb.com", "fb.me"], base: "https://www.facebook.com/" },
};

/**
 * Turns what someone typed into a full profile link, or null if it isn't one:
 * "@growxeno" or "growxeno" → https://www.instagram.com/growxeno, and a pasted
 * link is kept if it points at the right site (http is upgraded to https).
 */
export function normalizeSocialLink(kind: SocialKind, input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const { hosts, base } = SOCIAL[kind];
  const handle = value.replace(/^@/, "");
  const looksLikeSite = hosts.some((host) => value.toLowerCase().includes(host));
  if (!looksLikeSite && /^[A-Za-z0-9._-]{1,80}$/.test(handle)) return `${base}${handle}`;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, "");
    if (!hosts.includes(host) || url.pathname.length <= 1) return null;
    url.protocol = "https:";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

const optionalSocial = (kind: SocialKind) =>
  z
    .string()
    .trim()
    .max(300, `${SOCIAL[kind].label} link is too long.`)
    .nullable()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const link = normalizeSocialLink(kind, value);
      if (!link) {
        ctx.addIssue({ code: "custom", message: `Enter a ${SOCIAL[kind].label} link or @handle.` });
        return z.NEVER;
      }
      return link;
    });

export const siteContactSchema = z.object({
  email: z.email("Enter a valid email address.").trim().max(320),
  phone: optionalPhone("Phone"),
  whatsapp: optionalPhone("WhatsApp number"),
  whatsappMessage: z
    .string()
    .trim()
    .max(500, "Keep the WhatsApp message under 500 characters.")
    .nullable()
    .optional()
    .transform((value) => value || null),
  instagram: optionalSocial("instagram"),
  twitter: optionalSocial("twitter"),
  facebook: optionalSocial("facebook"),
});

export type SiteContact = z.infer<typeof siteContactSchema>;

/** Also seeded by the migration that added this setting — keep the two in step. */
export const DEFAULT_SITE_CONTACT: SiteContact = {
  email: "hello@growxeno.com",
  phone: null,
  whatsapp: null,
  whatsappMessage: DEFAULT_WHATSAPP_MESSAGE,
  instagram: null,
  twitter: null,
  facebook: null,
};

/** Values saved before the social fields existed still parse (they are optional). */
export function parseSiteContact(value: unknown): SiteContact {
  const parsed = siteContactSchema.safeParse(value);
  if (!parsed.success) return DEFAULT_SITE_CONTACT;
  // Saved before the WhatsApp message existed: start from the default text.
  const hasMessageField = typeof value === "object" && value !== null && "whatsappMessage" in value;
  return hasMessageField ? parsed.data : { ...parsed.data, whatsappMessage: DEFAULT_WHATSAPP_MESSAGE };
}

export const SOCIAL_LABELS: Record<SocialKind, string> = {
  instagram: SOCIAL.instagram.label,
  twitter: SOCIAL.twitter.label,
  facebook: SOCIAL.facebook.label,
};

/** "tel:+923001234567" — digits and a leading plus only. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** "https://wa.me/923001234567?text=…" — digits only, with the opening message if there is one. */
export function whatsappHref(phone: string, message?: string | null): string {
  const base = `https://wa.me/${phone.replace(/\D/g, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
