import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { renderedToMessage } from "@/lib/email/send";
import { inviteEmail, passwordResetEmail } from "@/lib/email/templates";
import { getAppUrl, getEmailEnv } from "@/lib/env";
import { getEmailProvider } from "@/lib/notifications/providers";
import { getSiteContact } from "@/lib/settings/queries";

/**
 * Invitations and password resets emailed by the app (2026-11-12). Supabase
 * Auth's own email sending failed in production ("Error sending invite
 * email": its SMTP isn't set up for the domain), so when Resend is configured
 * the app asks Supabase only for a one-time token (`generateLink`, which sends
 * nothing) and emails the link itself, on the branded template.
 *
 * The link goes to this app's /auth/callback with the token hash, which
 * verifies it on the server and opens /auth/reset-password signed in (see
 * src/app/(auth)/auth/callback/route.ts). Supabase's own `action_link` is
 * NOT used: it hands the session back in the URL fragment, which this
 * server-rendered page can't read.
 *
 * Without Resend it falls back to Supabase's own emails, as before.
 */

/** /auth/callback?token_hash=…&type=…&next=/auth/reset-password on this app. */
export function authCallbackLink(appUrl: string, tokenHash: string, type: "invite" | "recovery", options: { welcome?: boolean } = {}): string {
  const url = new URL("/auth/callback", appUrl);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  url.searchParams.set("next", options.welcome ? "/auth/reset-password?welcome=1" : "/auth/reset-password");
  return url.toString();
}

async function contactEmail(): Promise<string | undefined> {
  try {
    return (await getSiteContact()).email || undefined;
  } catch {
    return undefined;
  }
}

export async function inviteByEmail(
  admin: SupabaseClient,
  input: { email: string; fullName: string; kind: "worker" | "team" },
): Promise<{ ok: true; authUserId: string } | { ok: false; error: string }> {
  const appUrl = getAppUrl();
  const redirectTo = `${appUrl}/auth/reset-password`;

  if (!getEmailEnv()) {
    const invited = await admin.auth.admin.inviteUserByEmail(input.email, { data: { full_name: input.fullName }, redirectTo });
    return invited.data.user ? { ok: true, authUserId: invited.data.user.id } : { ok: false, error: invited.error?.message ?? "Could not send the invitation." };
  }

  const generated = await admin.auth.admin.generateLink({
    type: "invite",
    email: input.email,
    options: { data: { full_name: input.fullName }, redirectTo },
  });
  const user = generated.data?.user;
  const tokenHash = generated.data?.properties?.hashed_token;
  if (!user || !tokenHash) return { ok: false, error: generated.error?.message ?? "Could not create the invitation." };

  const email = inviteEmail({
    fullName: input.fullName,
    link: authCallbackLink(appUrl, tokenHash, "invite"),
    kind: input.kind,
    appUrl,
    contactEmail: await contactEmail(),
  });
  const receipt = await getEmailProvider().sendTemplate(renderedToMessage(input.email, email));
  if (!receipt.ok) {
    await admin.auth.admin.deleteUser(user.id).catch(() => {});
    return { ok: false, error: `The invitation email couldn't be sent: ${receipt.error}` };
  }
  return { ok: true, authUserId: user.id };
}

/**
 * Sends a pending invitation again (2026-11-12): the account already exists
 * but they never set a password, so Supabase won't "invite" it twice; a
 * one-time recovery token does the same job. The email is the same branded
 * invitation, and the set-password page still greets them as new.
 */
export async function resendInviteEmail(
  admin: SupabaseClient,
  input: { email: string; fullName: string; kind: "worker" | "team" },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!getEmailEnv()) return { ok: false, error: "Email isn't set up (RESEND_API_KEY and EMAIL_FROM)." };
  const appUrl = getAppUrl();
  const generated = await admin.auth.admin.generateLink({ type: "recovery", email: input.email, options: { redirectTo: `${appUrl}/auth/reset-password` } });
  const tokenHash = generated.data?.properties?.hashed_token;
  if (!tokenHash) return { ok: false, error: generated.error?.message ?? "Could not create a new invitation link." };
  const email = inviteEmail({
    fullName: input.fullName,
    link: authCallbackLink(appUrl, tokenHash, "recovery", { welcome: true }),
    kind: input.kind,
    appUrl,
    contactEmail: await contactEmail(),
  });
  const receipt = await getEmailProvider().sendTemplate(renderedToMessage(input.email, email));
  return receipt.ok ? { ok: true } : { ok: false, error: `The invitation email couldn't be sent: ${receipt.error}` };
}

/**
 * "Forgot password" by the app (2026-11-12), on the branded template. Says
 * nothing about whether the address has an account: an unknown address simply
 * gets no email (the caller always reports "sent").
 */
export async function sendPasswordResetEmail(admin: SupabaseClient, email: string): Promise<void> {
  const appUrl = getAppUrl();
  const generated = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: `${appUrl}/auth/reset-password` } });
  const tokenHash = generated.data?.properties?.hashed_token;
  if (!tokenHash) return;
  const message = passwordResetEmail({ link: authCallbackLink(appUrl, tokenHash, "recovery"), appUrl, contactEmail: await contactEmail() });
  await getEmailProvider().sendTemplate(renderedToMessage(email, message));
}
