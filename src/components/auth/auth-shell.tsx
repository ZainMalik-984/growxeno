import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { AuthScene } from "@/components/auth/auth-scene";
import { GrowXenoLoader } from "@/components/brand/grow-xeno-loader";

/**
 * Shared frame for the signed-out pages: sign in, forgot password, set
 * password and account inactive (2026-11-16, second pass: "plain and AI
 * generated" feedback). Built on the home page's identity instead of a
 * template: `.gxo` tokens (black and graphite, electric green, metallic
 * silver), fonts from src/app/(auth)/layout.tsx.
 *
 * Large screens: on the left the home page's 3D growth sculpture with the
 * workspace highlights floating over it in depth, and the headline set large
 * and editorial; on the right the form in its own column, no boxed card, with
 * "Back to website" above and help text anchored at the bottom. Phones: the
 * monogram and headline in a compact band over the form.
 */
export function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="gxo grid min-h-dvh lg:grid-cols-[minmax(0,1.25fr)_minmax(480px,1fr)]">
      <BrandPanel />

      <main className="relative isolate flex min-h-dvh flex-col bg-[var(--gx-s1)] px-6 py-7 sm:px-10 lg:border-l lg:border-[var(--gx-line)] lg:px-14 xl:px-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -right-1/3 top-1/4 h-[60%] w-[90%] rounded-full bg-[radial-gradient(closest-side,rgb(0_185_91/0.07),transparent)]" />
          <div className="gx-grain absolute inset-0" />
        </div>

        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 rounded-[6px] lg:hidden" aria-label="Grow Xeno home">
            <Image src="/brand/gx-symbol-light.svg" alt="" aria-hidden="true" width={1050} height={780} className="h-7 w-auto" priority />
            <span className="gx-display text-lg tracking-[-0.03em] text-[var(--gx-text)]">Grow Xeno</span>
          </Link>
          <Link
            href="/"
            className="group ml-auto inline-flex items-center gap-2 text-[13px] text-[var(--gx-muted)] transition-colors hover:text-[var(--gx-text)]"
          >
            <ArrowLeft aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
            Back to website
          </Link>
        </div>

        <div className="gx-auth-rise mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">{children}</div>

        <div className="flex flex-col gap-1.5 border-t border-[var(--gx-line)] pt-5 text-xs leading-relaxed text-[var(--gx-dim)] sm:flex-row sm:items-center sm:justify-between">
          <span>{footer ?? "Need assistance? Contact your coordinator or supervisor for support."}</span>
          <span className="shrink-0">© {new Date().getFullYear()} Grow Xeno</span>
        </div>
      </main>
    </div>
  );
}

/** Eyebrow, large title and one-line description. */
export function AuthHeading({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-10">
      <p className="gx-eyebrow flex items-center gap-3 text-[var(--gx-muted)]">
        <span aria-hidden="true" className="h-px w-7 bg-[var(--gx-accent)]" />
        Business Manager
      </p>
      <h1 className="gx-display mt-5 text-[clamp(2.4rem,4vw,3.25rem)] tracking-[-0.045em] text-[var(--gx-text)]">{title}</h1>
      {description ? <p className="mt-3 max-w-[38ch] text-[0.9375rem] leading-relaxed text-[var(--gx-muted)]">{description}</p> : null}
    </div>
  );
}

/** A labelled field: label row (with an optional link at its end), an optional leading icon, hint and error. */
export function AuthField({
  label,
  htmlFor,
  hint,
  error,
  aside,
  icon,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  /** Something at the right end of the label row, such as "Forgot password?". */
  aside?: ReactNode;
  /** A small icon inside the field, at its start. Give the input AUTH_FIELD_ICON_CLASS. */
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-[var(--gx-text)]">
          {label}
        </label>
        {aside}
      </div>
      <div className="group/field relative">
        {icon ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 grid w-12 place-items-center text-[var(--gx-dim)] transition-colors group-focus-within/field:text-[var(--gx-accent)] [&_svg]:size-[18px]"
          >
            {icon}
          </span>
        ) : null}
        {children}
      </div>
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-[var(--gx-muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Field styling: a deep graphite well, hairline border, green focus. */
export const AUTH_FIELD_CLASS =
  "h-[54px] rounded-[14px] border-[var(--gx-line)] bg-[var(--gx-bg)] px-4 text-[0.9375rem] text-[var(--gx-text)] shadow-[inset_0_1px_2px_rgb(0_0_0/0.4)] " +
  "placeholder:text-[var(--gx-dim)] hover:border-[var(--gx-line-2)] focus:border-[var(--gx-accent)] focus:bg-[var(--gx-bg)] " +
  "focus:ring-4 focus:ring-[rgb(8_229_47/0.14)]";

/** Add to an input that sits under an AuthField icon. */
export const AUTH_FIELD_ICON_CLASS = "pl-12";

/** The full-width primary button: electric green with dark text. */
export const AUTH_BUTTON_CLASS =
  "group h-[54px] w-full gap-2.5 rounded-full bg-[var(--gx-accent)] px-6 text-[0.9375rem] font-semibold text-[var(--gx-accent-ink)] " +
  "shadow-[0_12px_34px_-12px_rgb(8_229_47/0.75)] hover:bg-[var(--gx-accent-hi)] active:bg-[var(--gx-accent-hi)] " +
  "focus-visible:ring-[rgb(8_229_47/0.3)] disabled:opacity-80";

/** A secondary action shaped like the primary one. */
export const AUTH_GHOST_CLASS =
  "inline-flex h-[54px] w-full items-center justify-center rounded-full border border-[var(--gx-line-2)] px-6 text-[0.9375rem] font-medium " +
  "text-[var(--gx-text)] transition-colors hover:border-[var(--gx-text)]/40";

/** Error box for a failed submit. */
export const AUTH_ALERT_CLASS = "rounded-[12px] border border-red-400/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200";

/** Quiet text link. */
export const AUTH_LINK_CLASS = "font-medium text-[var(--gx-muted)] underline-offset-4 transition-colors hover:text-[var(--gx-text)] hover:underline";

/** Submit button content: label and arrow, or the logo loader while the form works. */
export function AuthSubmitLabel({ pending, idle, busy }: { pending: boolean; idle: string; busy: string }) {
  return pending ? (
    <>
      <GrowXenoLoader size="xs" variant="dark" label="" />
      {busy}
    </>
  ) : (
    <>
      {idle}
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 transition-transform duration-300 group-hover:translate-x-0.5">
        <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-[var(--gx-bg)] lg:block">
      <AuthScene />

      {/* Light and texture over the scene. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="gx-ambient absolute -left-1/4 -top-1/3 h-[70%] w-[80%] rounded-full bg-[radial-gradient(closest-side,rgb(0_185_91/0.16),transparent)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--gx-bg)] via-[var(--gx-bg)]/70 to-transparent" />
        <div className="gx-grain absolute inset-0" />
      </div>

      <div className="pointer-events-none relative flex h-full min-h-dvh flex-col justify-between p-12 xl:p-16">
        <Link href="/" className="pointer-events-auto flex w-fit items-center gap-3 rounded-[6px]" aria-label="Grow Xeno home">
          <Image src="/brand/gx-symbol-light.svg" alt="" aria-hidden="true" width={1050} height={780} className="h-9 w-auto" priority />
          <span className="leading-tight">
            <span className="gx-display block text-lg tracking-[-0.03em] text-[var(--gx-text)]">Grow Xeno</span>
            <span className="block text-xs text-[var(--gx-dim)]">Business Manager</span>
          </span>
        </Link>

        <div className="gx-auth-rise max-w-[30rem]">
          <h2 className="gx-display text-[clamp(2.6rem,4.3vw,4.25rem)] leading-[0.95] tracking-[-0.05em] text-[var(--gx-text)]">
            Your workspace,
            <br />
            <span className="gx-serif gx-metal pr-2 text-[1.06em]">all in one place.</span>
          </h2>
        </div>
      </div>
    </aside>
  );
}
