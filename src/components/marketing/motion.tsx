"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

/**
 * Interaction pieces for the Grow Xeno home page (2026-11-16): media-query
 * hooks, smooth scrolling, magnetic buttons, 3D tilt and the glass-ball
 * cursor. Each one switches
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

/** The page's smooth scroller while one is running (code that scrolls the page should go through it). */
let lenis: Lenis | null = null;
export function getSmoothScroll(): Lenis | null {
  return lenis;
}

/** Scrolls to a position, smoothly through the scroller when there is one. */
export function scrollToY(y: number) {
  if (lenis) lenis.scrollTo(y, { duration: 1.2 });
  else window.scrollTo({ top: y, behavior: window.matchMedia(REDUCED).matches ? "auto" : "smooth" });
}

/**
 * Momentum smooth scrolling for wheel and trackpad (Lenis), driven by GSAP's
 * ticker so ScrollTrigger pins and scrubs read the smoothed position. Touch
 * keeps the device's own scrolling; reduced motion keeps plain scrolling.
 * In-page anchor links scroll smoothly too, stopping clear of the sticky nav.
 */
export function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia(REDUCED).matches) return;
    const instance = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 1,
      anchors: { offset: -80 },
      autoRaf: false,
    });
    lenis = instance;
    instance.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      instance.destroy();
      if (lenis === instance) lenis = null;
    };
  }, []);
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

/**
 * The cursor companion: a small 3D glass ball that trails the pointer
 * (2026-11-16, owner request). Layered CSS: a clear body with a silver rim and
 * an emerald glow from inside, a slight refraction of whatever is behind it,
 * and a fixed specular highlight. It stretches along the direction of travel
 * as it moves, swells over anything clickable and squishes on press. The
 * system cursor stays. Fine pointers only, never for reduced motion.
 */
export function GlassCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLSpanElement>(null);
  const enabled = useMedia(FINE_MOTION);
  useEffect(() => {
    const el = ref.current;
    const ball = body.current;
    if (!enabled || !el || !ball) return;
    const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
    let lastX = 0;
    let lastY = 0;
    let lastT = performance.now();
    const move = (e: PointerEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
      el.dataset.visible = "1";
      const target = e.target instanceof Element ? e.target.closest("a, button, [data-cursor], input, textarea, label, select") : null;
      if (el.dataset.state !== "down") el.dataset.state = target ? "link" : "";
      // Squash and stretch along the direction of travel.
      const now = performance.now();
      const dt = Math.max(8, now - lastT);
      const vx = (e.clientX - lastX) / dt;
      const vy = (e.clientY - lastY) / dt;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = now;
      const speed = Math.min(1, Math.hypot(vx, vy) / 2.2);
      gsap.to(ball, {
        rotation: (Math.atan2(vy, vx) * 180) / Math.PI,
        scaleX: 1 + speed * 0.32,
        scaleY: 1 - speed * 0.2,
        duration: 0.25,
        ease: "power2.out",
        overwrite: true,
        onComplete: () => {
          gsap.to(ball, { scaleX: 1, scaleY: 1, duration: 0.6, ease: "elastic.out(1, 0.55)" });
        },
      });
    };
    const down = () => (el.dataset.state = "down");
    const up = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target.closest("a, button, [data-cursor], input, textarea, label, select") : null;
      el.dataset.state = target ? "link" : "";
    };
    const leaveWindow = () => (el.dataset.visible = "0");
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    document.documentElement.addEventListener("pointerleave", leaveWindow);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      document.documentElement.removeEventListener("pointerleave", leaveWindow);
    };
  }, [enabled]);
  if (!enabled) return null;
  return (
    <div ref={ref} aria-hidden className="gx-cursor">
      <span className="gx-ball">
        <span ref={body} className="gx-ball-body" />
        <span className="gx-ball-shine" />
      </span>
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
