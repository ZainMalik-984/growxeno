"use client";

import { CalendarDays, ClipboardList, Wallet } from "lucide-react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { useEffect, useRef, useState } from "react";

import { REDUCED, useMedia } from "@/components/marketing/motion";

/**
 * The sign-in pages' brand visual (2026-11-16): the home page's 3D growth
 * sculpture (src/components/marketing/hero-scene.tsx) with the workspace
 * highlights floating over it as glass panels at different depths. The panels
 * drift with the pointer, nearer ones further. three.js loads only on large
 * screens (the panel is hidden below `lg`) and after first paint; reduced
 * motion holds everything still.
 */

const HeroScene = dynamic(() => import("@/components/marketing/hero-scene"), { ssr: false, loading: () => null });

// Seen by employees and external workers, so it names only what they use,
// never admin-only areas such as finance or invoicing.
const PANELS = [
  {
    icon: ClipboardList,
    title: "Tasks & Shifts",
    text: "View your assigned work and tracking from intake to completion.",
    place: "left-[7%] top-[14%]",
    depth: 46,
  },
  {
    icon: CalendarDays,
    title: "Schedules",
    text: "Keep track of active projects and upcoming timelines.",
    place: "left-[38%] top-[31%]",
    depth: 70,
  },
  {
    icon: Wallet,
    title: "Payouts",
    text: "Monitor your completed tasks and upcoming payment summaries transparently.",
    place: "right-[6%] top-[11%]",
    depth: 28,
  },
] as const;

export function AuthScene() {
  const wide = useMedia("(min-width: 1024px)");
  const reduced = useMedia(REDUCED);
  const [mount, setMount] = useState(false);
  const [ready, setReady] = useState(false);
  const layers = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wide) return;
    const t = window.setTimeout(() => setMount(true), 150);
    return () => window.clearTimeout(t);
  }, [wide]);

  // Panels drift with the pointer.
  useEffect(() => {
    const host = layers.current;
    if (!host || reduced || !window.matchMedia("(pointer: fine)").matches) return;
    const items = Array.from(host.querySelectorAll<HTMLElement>("[data-depth]")).map((el) => ({
      depth: Number(el.dataset.depth),
      x: gsap.quickTo(el, "x", { duration: 1.2, ease: "power3.out" }),
      y: gsap.quickTo(el, "y", { duration: 1.2, ease: "power3.out" }),
    }));
    const move = (e: PointerEvent) => {
      const px = e.clientX / window.innerWidth - 0.5;
      const py = e.clientY / window.innerHeight - 0.5;
      items.forEach((it) => {
        it.x(px * it.depth);
        it.y(py * it.depth);
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [reduced]);

  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${ready ? "opacity-0" : "opacity-100"} bg-[radial-gradient(55%_45%_at_55%_70%,rgb(0_185_91/0.2),transparent_70%)]`}
      />
      {/* The scene sits low in the panel, under the headline. */}
      <div className="absolute inset-x-0 bottom-[-4%] top-[36%] [mask-image:linear-gradient(to_bottom,transparent,#000_18%,#000_85%,transparent)]">
        {mount && wide ? <HeroScene simplified={false} reducedMotion={reduced} active onReady={() => setReady(true)} /> : null}
      </div>

      <div ref={layers} className="absolute inset-0">
        {PANELS.map(({ icon: Icon, title, text, place, depth }, i) => (
          <div key={title} data-depth={depth} className={`absolute ${place}`}>
            <div
              className="gx-auth-float w-[248px] rounded-[16px] border border-[var(--gx-line-2)] bg-[var(--gx-s2)]/95 p-4 shadow-[var(--gx-shadow-3)]"
              style={{ animationDelay: `${0.25 + i * 0.15}s` }}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[rgb(8_229_47/0.3)] bg-[rgb(8_229_47/0.1)] text-[var(--gx-accent)]">
                  <Icon className="size-4" />
                </span>
                <span className="text-sm font-medium text-[var(--gx-text)]">{title}</span>
              </div>
              <p className="mt-3 text-[0.8125rem] leading-relaxed text-[var(--gx-muted)]">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
