"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, PanelLeft, X } from "lucide-react";
import { useEffect, useState } from "react";

import { BrandSymbol } from "@/components/brand/brand-logo";
import { FALLBACK_NAV_ICON, NAV_ICONS } from "@/components/layout/nav-icons";
import { setPersistedFlag, usePersistedFlag } from "@/components/layout/use-persisted-flag";
import { currentNavChild, isNavNodeActive, type NavNode, type NavSection } from "@/lib/navigation/nav-tree";
import { cn } from "@/lib/utils";

/**
 * Application sidebar.
 *
 * Restyled 2026-11-03 (owner-directed) to match the app's layered look: a
 * white panel against the tinted canvas, a header that lines up with the top
 * bar, a soft indigo current-page highlight, and nested links hanging off a
 * thin guide line. Still restrained — no colourful tiles, no glow.
 *
 * It receives an ALREADY-FILTERED tree. It performs no permission logic of its
 * own — that happens on the server, and the routes enforce it independently.
 *
 * On tablet/mobile it becomes an overlay drawer rather than a squeezed column.
 */

const OPEN_GROUPS_STORAGE_KEY = "bm.sidebar.openGroups";

export function Sidebar({ sections }: { sections: readonly NavSection[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The drawer is stored together with the path it was opened on, so navigating
  // closes it by DERIVATION rather than by a setState inside an effect (which
  // would cause a cascading render).
  const [drawer, setDrawer] = useState<{ open: boolean; path: string }>({
    open: false,
    path: pathname,
  });
  const drawerOpen = drawer.open && drawer.path === pathname;
  const setDrawerOpen = (open: boolean) => setDrawer({ open, path: pathname });

  // Escape closes the drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Functional update: keeps `setDrawer` (a stable setter) as the only
      // dependency, rather than closing over the current pathname.
      if (event.key === "Escape") setDrawer((current) => ({ ...current, open: false }));
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open navigation"
        aria-expanded={drawerOpen}
        className="fixed left-3 top-3 z-30 inline-flex size-8 items-center justify-center rounded-[8px] border border-zinc-200 bg-white text-zinc-600 shadow-[0_1px_2px_rgba(16,24,40,0.06)] hover:text-zinc-900 lg:hidden"
      >
        <PanelLeft aria-hidden="true" className="size-4" />
      </button>

      {drawerOpen ? (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/30 backdrop-blur-[2px] lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <nav
        aria-label="Main"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-sidebar flex-col",
          "border-r border-zinc-200/80 bg-white",
          "transition-transform duration-200 lg:translate-x-0",
          drawerOpen ? "translate-x-0 shadow-[0_24px_64px_-16px_rgba(16,24,40,0.35)]" : "-translate-x-full",
        )}
      >
        {/* Same height as the top bar so the two read as one frame. */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200/80 px-4">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-[8px] px-1 py-1 hover:bg-zinc-50">
            <BrandSymbol className="h-6" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-zinc-900">Grow Xeno</span>
              <span className="truncate text-[11px] text-zinc-500">Business Manager</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
            className="inline-flex size-8 items-center justify-center rounded-[8px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 lg:hidden"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4 [scrollbar-width:thin]">
          {sections.map((section) => (
            <SidebarSection key={section.label} section={section} pathname={pathname} search={searchParams} />
          ))}
        </div>
      </nav>
    </>
  );
}

function SidebarSection({
  section,
  pathname,
  search,
}: {
  section: NavSection;
  pathname: string;
  search: URLSearchParams;
}) {
  return (
    <div>
      <p className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{section.label}</p>
      <ul className="space-y-0.5">
        {section.items.map((item) => (
          <li key={`${section.label}-${item.href}-${item.label}`}>
            {item.children && item.children.length > 0 ? (
              <SidebarGroup node={item} pathname={pathname} search={search} />
            ) : (
              <SidebarLink node={item} active={isNavNodeActive(item, pathname)} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NavIcon({ node, active, emphasised }: { node: NavNode; active: boolean; emphasised?: boolean }) {
  const Icon = node.icon ? (NAV_ICONS[node.icon] ?? FALLBACK_NAV_ICON) : null;
  if (!Icon) return null;
  return (
    <Icon
      aria-hidden="true"
      className={cn(
        "size-[18px] shrink-0 transition-colors",
        active ? "text-indigo-600" : emphasised ? "text-zinc-700" : "text-zinc-400 group-hover:text-zinc-600",
      )}
    />
  );
}

function SidebarLink({ node, active }: { node: NavNode; active: boolean }) {
  return (
    <Link
      href={node.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-2.5 rounded-[8px] px-2.5 text-[13px] transition-colors",
        active
          ? "bg-indigo-50 font-medium text-indigo-700 ring-1 ring-inset ring-indigo-100"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
      )}
    >
      <NavIcon node={node} active={active} />
      <span className="truncate">{node.label}</span>
    </Link>
  );
}

function SidebarGroup({ node, pathname, search }: { node: NavNode; pathname: string; search: URLSearchParams }) {
  const children = node.children ?? [];
  const containsActive = isNavNodeActive(node, pathname) || children.some((child) => isNavNodeActive(child, pathname));
  // Exactly one child is "current" — query strings included (see currentNavChild).
  const current = currentNavChild(children, pathname, search);

  const storageKey = `${OPEN_GROUPS_STORAGE_KEY}.${node.href}`;

  // The section containing the current page is ALWAYS open — a sidebar that
  // hides where you currently are is disorienting. For every other section the
  // user's last choice wins, read without an effect (no cascading render).
  const persisted = usePersistedFlag(storageKey, false);
  const open = containsActive || persisted;
  const toggle = () => setPersistedFlag(storageKey, !open);

  const panelId = `nav-group-${node.href.replace(/[^\w-]/g, "-")}`;

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "group flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-[13px] transition-colors",
          containsActive ? "font-medium text-zinc-900 hover:bg-zinc-100" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
        )}
      >
        <NavIcon node={node} active={false} emphasised={containsActive} />
        <span className="flex-1 truncate text-left">{node.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3.5 text-zinc-400 transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      {/* Children hang off a thin guide line aligned under the parent icon. */}
      <ul id={panelId} hidden={!open} className="relative ml-[19px] mt-0.5 space-y-0.5 border-l border-zinc-200 pb-1 pl-2.5">
        {children.map((child) => {
          const active = child === current;
          return (
            <li key={`${child.href}-${child.label}`} className="relative">
              {active ? (
                <span aria-hidden="true" className="absolute -left-[11px] top-1.5 bottom-1.5 w-0.5 rounded-full bg-indigo-500" />
              ) : null}
              <Link
                href={child.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center rounded-[7px] px-2.5 text-[13px] transition-colors",
                  active ? "bg-indigo-50 font-medium text-indigo-700" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
                )}
              >
                <span className="truncate">{child.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
