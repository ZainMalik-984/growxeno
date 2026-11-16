"use client";

import { useId, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

/**
 * GrowXenoLoader (2026-11-16): the Grow Xeno monogram as the app's loading
 * indicator, replacing generic spinners.
 *
 * Built from the exact paths of public/brand/gx-symbol.svg, so the logo's
 * geometry never changes. Each loop (owner direction: "start from a dot, then
 * draw itself, the arrow goes through it"):
 *   1. a green dot appears where the arrow begins,
 *   2. the letterforms draw themselves outward as outlines,
 *   3. the arrow shoots from the dot up through the monogram to its tip,
 *      a bright head running along its front,
 *   4. the letterforms fill in, a light sweeps across, the arrow glows,
 *   5. everything fades back and the loop starts again.
 * xs and sm use a shorter version (the logo is already drawn; the dot and the
 * arrow run through it), since a full draw-in doesn't read at 20-28px.
 * Reduced motion shows the finished logo with a slow fade.
 *
 * Only stroke-dashoffset, transform and opacity animate (see `.gx-loader` in
 * src/app/globals.css), and every distance is in the logo's own units, so it
 * looks the same at every size.
 *
 * `variant` is the tone of the letterforms, for the surface behind it:
 * "default" the original graphite (light surfaces), "light" metallic silver
 * (dark or filled surfaces), "dark" deep monochrome (bright tinted surfaces).
 * The box is square, so swapping it in never shifts layout. Pass `label=""`
 * when visible text beside it already says what is loading.
 */

export type GrowXenoLoaderSize = "xs" | "sm" | "md" | "lg" | "xl";
export type GrowXenoLoaderVariant = "default" | "light" | "dark";

const SIZES: Record<GrowXenoLoaderSize, number> = { xs: 20, sm: 28, md: 48, lg: 72, xl: 100 };

/** Fill gradient stops and outline colour for each tone. */
const TONES: Record<GrowXenoLoaderVariant, { fill: [string, string, string]; line: string; shine: number }> = {
  default: { fill: ["#303E44", "#202B30", "#11191E"], line: "#3A4A50", shine: 0.5 },
  light: { fill: ["#F4F5F4", "#C7C8CC", "#8E9296"], line: "#E4E6E8", shine: 0.95 },
  dark: { fill: ["#1B2320", "#0E1412", "#050706"], line: "#1B2320", shine: 0.4 },
};

/* The monogram, path for path from public/brand/gx-symbol.svg. */
const ARROW = "M628 710 L870 443 L788 407 Q782 404 790 401 L1064 322 Q1079 317 1077 334 L1034 572 Q1032 583 1025 578 L980 519 L716 817 Z";
const LEAF = "M254 882 C292 912 364 910 408 879 C447 853 471 817 480 786 L567 886 C535 922 490 949 445 951 C366 956 307 934 254 882 Z";
const LETTERFORMS = [
  "M421 449 L659 449 Q665 449 669 455 L749 550 Q751 553 746 558 L667 643 Q661 648 657 643 L594 568 Q591 565 585 565 L425 565 C410 565 398 573 384 585 L242 727 C218 751 205 786 204 820 C177 786 162 749 162 705 C162 641 189 576 232 533 C287 477 346 449 421 449 Z",
  "M379 650 L570 650 Q575 650 579 654 L820 943 Q824 948 816 948 L620 946 Q615 946 612 942 L373 665 Q367 659 372 653 Q374 650 379 650 Z",
  "M830 715 Q834 710 838 715 L1042 942 Q1048 948 1041 948 L870 948 Q867 948 864 944 L753 804 Q749 800 753 797 Z",
  "M272 716 L366 817 C399 851 439 829 480 786 C468 833 438 864 405 884 C377 900 350 904 314 904 C258 904 221 864 221 822 C221 783 240 745 272 716 Z",
];
/** Where the arrow begins: the middle of its base. The dot sits here. */
const ORIGIN = { x: 672, y: 763 };

export function GrowXenoLoader({
  size = "md",
  variant = "default",
  speed = 1,
  label = "Loading",
  className,
}: {
  size?: GrowXenoLoaderSize;
  variant?: GrowXenoLoaderVariant;
  /** Animation speed multiplier: 2 is twice as fast, 0.5 half as fast. */
  speed?: number;
  /** Screen-reader text. Empty string marks it decorative. */
  label?: string;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const px = SIZES[size];
  const tone = TONES[variant];
  const compact = size === "xs" || size === "sm";
  const decorative = label === "";
  const style = { width: px, height: px, "--gxl-duration": `${3 / Math.max(0.1, speed)}s` } as CSSProperties;

  return (
    <span
      role={decorative ? undefined : "status"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      data-mode={compact ? "compact" : "full"}
      className={cn("gx-loader inline-grid shrink-0 place-items-center align-middle", className)}
      style={style}
    >
      <svg viewBox="90 255 1050 780" aria-hidden="true" focusable="false" style={{ width: "100%", height: "100%", overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}-arrow`} x1="9%" y1="100%" x2="91%" y2="4%">
            <stop offset="0" stopColor="#008E60" />
            <stop offset="0.42" stopColor="#00C954" />
            <stop offset="1" stopColor="#08F52C" />
          </linearGradient>
          <linearGradient id={`${id}-leaf`} x1="90%" y1="95%" x2="25%" y2="8%">
            <stop offset="0" stopColor="#008C55" />
            <stop offset="0.48" stopColor="#00CF48" />
            <stop offset="1" stopColor="#2AFA3B" />
          </linearGradient>
          <linearGradient id={`${id}-fill`} x1="8%" y1="4%" x2="92%" y2="96%">
            <stop offset="0" stopColor={tone.fill[0]} />
            <stop offset="0.46" stopColor={tone.fill[1]} />
            <stop offset="1" stopColor={tone.fill[2]} />
          </linearGradient>
          <linearGradient id={`${id}-shine`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity={tone.shine} />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-head`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#EFFFF1" stopOpacity="0" />
            <stop offset="0.7" stopColor="#EFFFF1" stopOpacity="0.95" />
            <stop offset="1" stopColor="#EFFFF1" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${id}-letters`}>
            {LETTERFORMS.map((d) => (
              <path key={d} d={d} />
            ))}
          </clipPath>
          <clipPath id={`${id}-arrow-clip`}>
            <path d={ARROW} />
          </clipPath>
          {/* Grows from the arrow's base toward its tip, revealing it. Rotated to the arrow's angle. */}
          <mask id={`${id}-grow`} maskUnits="userSpaceOnUse" x="0" y="0" width="1300" height="1200">
            <g transform="rotate(-45 850 570)">
              <rect className="gxl-grow" x="560" y="250" width="680" height="640" fill="#fff" />
            </g>
          </mask>
          <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="24" />
          </filter>
        </defs>

        <g className="gxl-mark">
          {/* Letterforms: outlines that draw themselves, then the solid fill. */}
          <g className="gxl-fill">
            <path d={LEAF} fill={`url(#${id}-leaf)`} />
            {LETTERFORMS.map((d) => (
              <path key={d} d={d} fill={`url(#${id}-fill)`} />
            ))}
          </g>
          <g fill="none" strokeWidth="16" strokeLinejoin="round" strokeLinecap="round">
            {LETTERFORMS.map((d, i) => (
              <path key={d} className="gxl-line" d={d} pathLength={1} stroke={tone.line} style={{ animationDelay: `calc(var(--gxl-duration) * ${0.03 * i})` }} />
            ))}
            <path className="gxl-line" d={LEAF} pathLength={1} stroke="#00C954" style={{ animationDelay: `calc(var(--gxl-duration) * 0.1)` }} />
          </g>
          <g clipPath={`url(#${id}-letters)`}>
            <g transform="skewX(-22)">
              <rect className="gxl-shine" x="-60" y="240" width="220" height="820" fill={`url(#${id}-shine)`} />
            </g>
          </g>

          {/* The arrow: glow, body revealed from its base, and a bright head on its front. */}
          <g className="gxl-arrow">
            <path className="gxl-glow" d={ARROW} fill="#08E52F" filter={`url(#${id}-glow)`} />
            <path d={ARROW} fill={`url(#${id}-arrow)`} mask={`url(#${id}-grow)`} />
            <g clipPath={`url(#${id}-arrow-clip)`}>
              <g transform="rotate(-45 850 570)">
                <rect className="gxl-head" x="430" y="250" width="160" height="640" fill={`url(#${id}-head)`} />
              </g>
            </g>
          </g>

          {/* The dot everything starts from. */}
          <circle className="gxl-dot-glow" cx={ORIGIN.x} cy={ORIGIN.y} r="70" fill="#08E52F" filter={`url(#${id}-glow)`} />
          <circle className="gxl-dot" cx={ORIGIN.x} cy={ORIGIN.y} r="30" fill="#08E52F" />
        </g>
      </svg>
    </span>
  );
}
