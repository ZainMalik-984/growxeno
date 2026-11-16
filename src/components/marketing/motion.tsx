"use client";

import { gsap } from "gsap";
import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

/**
 * Interaction pieces for the Grow Xeno home page (2026-11-16): media-query
 * hooks, magnetic buttons, 3D tilt and the cursor ring. Each one switches
 * itself off for touch screens and for prefers-reduced-motion, so the page
 * stays plain and usable there.
 */

export const FINE_MOTION = "(pointer: fine) and (prefers-reduced-motion: no-preference)";
export const REDUCED = "(prefers-reduced-motion: reduce)";

/** A media query as state. False on the server and during hydration. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Pulls its child toward the pointer while hovered, then settles back. */
export function Magnetic({ children, strength = 0.32, className = "" }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const enabled = useMedia(FINE_MOTION);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    };
    const leave = () => {
      xTo(0);
      yTo(0);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      gsap.set(el, { x: 0, y: 0 });
    };
  }, [enabled, strength]);
  return (
    <span ref={ref} className={`inline-flex will-change-transform ${className}`}>
      {children}
    </span>
  );
}

/**
 * Tilts toward the pointer in 3D. Children marked with `data-depth` (in px)
 * are pushed forward on the z axis, so layers separate as it turns.
 */
export function Tilt({
  children,
  max = 6,
  className = "",
  style,
}: {
  children: ReactNode;
  max?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const enabled = useMedia(FINE_MOTION);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const layers = el.querySelectorAll<HTMLElement>("[data-depth]");
    layers.forEach((layer) => {
      layer.style.transform = enabled ? `translateZ(${layer.dataset.depth}px)` : "";
    });
    if (!enabled) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty("--gx-mx", `${px * 100}%`);
      el.style.setProperty("--gx-my", `${py * 100}%`);
      gsap.to(el, { rotationY: (px - 0.5) * 2 * max, rotationX: -(py - 0.5) * 2 * max, duration: 0.7, ease: "power3.out", transformPerspective: 1200 });
    };
    const leave = () => gsap.to(el, { rotationY: 0, rotationX: 0, duration: 1, ease: "power3.out" });
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [enabled, max]);
  return (
    <div ref={ref} className={`[transform-style:preserve-3d] ${className}`} style={style}>
      {children}
    </div>
  );
}

/** A ring that trails the pointer and opens up over anything clickable. The system cursor stays. */
export function CursorRing() {
  const ref = useRef<HTMLDivElement>(null);
  const enabled = useMedia(FINE_MOTION);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const xTo = gsap.quickTo(el, "x", { duration: 0.45, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.45, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
      el.dataset.visible = "1";
      const target = e.target instanceof Element ? e.target.closest("a, button, [data-cursor], input, textarea, label") : null;
      el.dataset.state = target ? "link" : "";
    };
    const down = () => (el.dataset.state = "down");
    const leaveWindow = () => (el.dataset.visible = "0");
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down);
    document.documentElement.addEventListener("pointerleave", leaveWindow);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      document.documentElement.removeEventListener("pointerleave", leaveWindow);
    };
  }, [enabled]);
  if (!enabled) return null;
  return (
    <div ref={ref} aria-hidden className="gx-cursor">
      <span />
    </div>
  );
}

/** Splits a heading into masked words that rise into view (see `.gx-word` in globals.css). */
export function MaskWords({ text, className, wordClassName = "" }: { text: string; className?: string; wordClassName?: string }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((w, i) => (
        <span key={i}>
          <span className="gx-word">
            <span className={wordClassName}>{w}</span>
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}
