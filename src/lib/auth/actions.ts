"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { safeRedirectPath } from "@/lib/auth/redirect";
import { getAppUrl, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Authentication Server Actions.
 *
 * These are the only actions that run without an authorization check, because
 * they are how a caller becomes authorized in the first place. Everything else
 * in the application goes through src/lib/auth/authorize.ts.
 */

const signInSchema = z.object({
  email: z.email("Enter a valid email address.").transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export type SignInState = {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
};

/**
 * Only allow relative, single-slash paths as a post-login destination, so a
 * crafted `?next=https://evil.example` cannot turn the login form into an open
 * redirect.
 */

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Authentication is not configured on this deployment. Set the Supabase environment variables — see docs/ENVIRONMENT.md.",
    };
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    const fieldErrors: SignInState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "email") fieldErrors.email = issue.message;
      if (field === "password") fieldErrors.password = issue.message;
    }
    return { fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately generic: never reveal whether the address has an account.
    return { error: "Those credentials were not recognised." };
  }

  redirect(safeRedirectPath(parsed.data.next, "/dashboard"));
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Password reset (specification Section 14)
// ---------------------------------------------------------------------------

const requestResetSchema = z.object({
  email: z.email("Enter a valid email address.").transform((value) => value.trim().toLowerCase()),
});

export type RequestResetState = {
  sent?: boolean;
  fieldErrors?: { email?: string };
};

/**
 * Request a password-reset email.
 *
 * Always reports "sent", whether or not the address has an account — the same
 * reasoning as the generic sign-in error: this must not be usable to discover
 * who has one. Actual delivery additionally requires SMTP to be configured on
 * the Supabase project and its email templates updated to link to
 * `/auth/callback` (docs/ACCOUNTS_AND_CREDENTIALS.md); until then this call
 * still succeeds but no email arrives, which is indistinguishable from here on
 * purpose.
 */
export async function requestPasswordResetAction(
  _previous: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  if (!isSupabaseConfigured()) return { sent: true };

  const parsed = requestResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fieldErrors: { email: parsed.error.issues[0]?.message } };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getAppUrl()}/auth/reset-password`,
  });

  return { sent: true };
}

const updatePasswordSchema = z
  .object({
    password: z.string().min(12, "Use at least 12 characters."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type UpdatePasswordState = {
  error?: string;
  fieldErrors?: { password?: string; confirmPassword?: string };
};

/**
 * Set a new password from `/auth/reset-password`.
 *
 * Requires an active Supabase session already established by `/auth/callback`
 * verifying the emailed link. This same action finishes both a password reset
 * and a first-time invitation, which use the same "set a password" step.
 */
export async function updatePasswordAction(
  _previous: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors: UpdatePasswordState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "password") fieldErrors.password = issue.message;
      if (field === "confirmPassword") fieldErrors.confirmPassword = issue.message;
    }
    return { fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "This link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: "Could not update the password. Request a new link and try again." };
  }

  redirect("/dashboard");
}
