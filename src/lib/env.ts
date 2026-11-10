import { z } from "zod";

/**
 * Environment access.
 *
 * Values are validated LAZILY, at the point of use, not at module import.
 * That is deliberate: `next build` and `vitest` must succeed on a machine with
 * no Supabase project configured, while any code path that actually needs a
 * credential must fail closed with a clear message rather than silently
 * behaving as if the integration worked.
 *
 * Every variable is documented in docs/ENVIRONMENT.md and listed in .env.example.
 */

/** Thrown when a feature is used but its configuration is absent or malformed. */
export class ConfigurationError extends Error {
  readonly missing: readonly string[];

  constructor(feature: string, missing: readonly string[]) {
    super(
      `${feature} is not configured. Missing or invalid environment ` +
        `variable(s): ${missing.join(", ")}. See docs/ENVIRONMENT.md.`,
    );
    this.name = "ConfigurationError";
    this.missing = missing;
  }
}

function parseOrThrow<T extends z.ZodType>(feature: string, schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".") || "(root)");
    throw new ConfigurationError(feature, [...new Set(missing)]);
  }
  return result.data;
}

// --- Public (browser-visible) -----------------------------------------------
// These MUST be referenced as literal `process.env.NEXT_PUBLIC_*` so that
// Next.js can inline them into the client bundle. Do not read them dynamically.

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicSchema>;

/** Supabase settings safe to expose to the browser. Throws if unconfigured. */
export function getPublicEnv(): PublicEnv {
  return parseOrThrow("Supabase", publicSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

/** True when Supabase Auth can be used at all. Lets UI render a clear notice. */
export function isSupabaseConfigured(): boolean {
  return publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }).success;
}

// --- Server-only ------------------------------------------------------------
// Never import these from a Client Component. `SUPABASE_SECRET_KEY` bypasses
// RLS entirely and must never reach a browser bundle.

const databaseSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

/** Runtime database connection (pooled). Throws if unconfigured. */
export function getDatabaseEnv(): z.infer<typeof databaseSchema> {
  return parseOrThrow("Database", databaseSchema, {
    DATABASE_URL: process.env.DATABASE_URL,
  });
}

export function isDatabaseConfigured(): boolean {
  return databaseSchema.safeParse({ DATABASE_URL: process.env.DATABASE_URL }).success;
}

const adminSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

/**
 * Privileged Supabase key used for administrative operations such as creating
 * an auth identity when an operator adds a user. Server-only.
 */
export function getSupabaseAdminEnv(): z.infer<typeof adminSchema> {
  return parseOrThrow("Supabase administrative access", adminSchema, {
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
}

export function isSupabaseAdminConfigured(): boolean {
  return adminSchema.safeParse({ SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY }).success;
}

/** Canonical application URL, used for links in emails and auth redirects. */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

/**
 * YouTube Data API v3 key (2026-11-10): reads public channel and video stats
 * for order item links. Optional — without it the stats features say so and
 * everything else works. Server-only; restrict the key to the YouTube Data API.
 */
export function getYoutubeApiKey(): string | null {
  return process.env.YOUTUBE_API_KEY?.trim() || null;
}

/**
 * Shared secret for scheduled jobs called over HTTP (e.g. Vercel Cron, which
 * sends it as `Authorization: Bearer …`). Without it those endpoints refuse
 * every call.
 */
export function getCronSecret(): string | null {
  const value = process.env.CRON_SECRET?.trim();
  return value && value.length >= 16 ? value : null;
}

/**
 * Resend email (2026-11-11): the API key and the sender address. Null when
 * either is missing, so email is reported as not set up instead of failing.
 */
export function getEmailEnv(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  return apiKey && from ? { apiKey, from } : null;
}
