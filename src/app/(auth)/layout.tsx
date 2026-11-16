import { Instrument_Serif, Inter, Inter_Tight } from "next/font/google";
import type { ReactNode } from "react";

/**
 * Signed-out pages share the home page's type (2026-11-16): Inter Tight for
 * display, Instrument Serif italic for emphasis, Inter for body. Self-hosted
 * through next/font, exposed as the `--font-gx-*` variables that the `.gxo`
 * tokens in globals.css read.
 */
const bodyFont = Inter({ subsets: ["latin"], variable: "--font-gx-body", display: "swap" });
const displayFont = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-gx-display", display: "swap" });
const serifFont = Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", variable: "--font-gx-serif", display: "swap" });

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className={`${bodyFont.variable} ${displayFont.variable} ${serifFont.variable}`}>{children}</div>;
}
