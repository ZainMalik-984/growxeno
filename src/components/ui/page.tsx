import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Page furniture: breadcrumbs, page header, section, empty state.
 *
 * These exist so that every screen has the same vertical rhythm without each
 * one inventing its own wrapper. None of them draws a card.
 */

export type Crumb = { label: string; href?: string };

/** Restrained breadcrumbs. Small, muted, never visually dominant (Section 85). */
export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-faint">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-ink-muted hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className={cn(isLast && "text-ink-muted")} aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!isLast ? <ChevronRight aria-hidden="true" className="size-3" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-zinc-900">{title}</h1>
        {description ? (
          <div className="mt-1 max-w-2xl text-[13px] text-zinc-500">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Raised white surface used across the app (owner-directed, 2026-11-03): hairline border + soft layered shadow. */
export const SURFACE_CLASS =
  "rounded-[12px] border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(16,24,40,0.12)]";

/**
 * A titled block of content. By default it is a raised white card on the
 * tinted app canvas (2026-11-03 restyle, matching the New Order page).
 * `plain` keeps the old flat band — for a Section that already sits inside
 * a Card, so there is never a card inside a card.
 */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  plain = false,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  plain?: boolean;
}) {
  return (
    <section className={cn(plain ? "mb-8" : cn(SURFACE_CLASS, "mb-6 p-5 sm:p-6"), className)}>
      {title ? (
        <div
          className={cn(
            "mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2",
            plain && "border-b border-zinc-200/80 pb-2",
          )}
        >
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-zinc-900">{title}</h2>
            {description ? <p className="mt-0.5 text-[13px] text-zinc-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Useful empty state: says what is missing and what to do (Section 135). */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-zinc-100 text-zinc-500">
        <Inbox aria-hidden="true" className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-zinc-900">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-[13px] text-zinc-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** A short definition list used on detail pages for metadata. */
export function MetaList({
  items,
  className,
}: {
  items: ReadonlyArray<{ label: string; value: ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-medium text-zinc-500">{item.label}</dt>
          <dd className="mt-1 text-sm font-medium text-zinc-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
