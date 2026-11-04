import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Button.
 *
 * Deliberately restrained: small radius (never a pill), no shadow, no gradient,
 * no glow. Hierarchy comes from weight and contrast, not decoration.
 * See docs/DESIGN_SYSTEM.md.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[8px] font-medium " +
    "whitespace-nowrap transition-colors " +
    "disabled:pointer-events-none disabled:opacity-40 " +
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 " +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** The single strongest action on a screen. */
        primary: "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-500 active:bg-indigo-700",
        /** Ordinary actions. A hairline, not a filled box. */
        secondary:
          "border border-zinc-200 bg-white text-ink shadow-[0_1px_1px_rgba(16,24,40,0.03)] hover:border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100",
        /** Tertiary actions inside dense rows. */
        ghost: "text-ink-muted hover:bg-zinc-100 hover:text-ink",
        /** Destructive actions. Colour is reserved for exactly this. */
        danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
        /** Reads as text; used for inline destructive actions in tables. */
        dangerGhost: "text-red-600 hover:bg-red-50 active:bg-red-100",
        /**
         * Elevated colour accent, for the pages that opted into real depth
         * (2026-10-14) alongside `Card` — not used by the flat pages, which
         * keep `primary`.
         */
        accent: "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-500 active:bg-indigo-700",
      },
      size: {
        sm: "h-8 px-3 text-xs [&_svg]:size-3.5",
        md: "h-9 px-3.5 text-[13px] [&_svg]:size-4",
        lg: "h-10 px-4 text-sm [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
