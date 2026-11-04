import { cn } from "@/lib/utils";

/**
 * The thin indigo bar along the top of the window. Shown by two owners so it
 * stays up for a whole navigation: `NavigationProgress` (from the click until
 * the URL changes) and the `(app)/loading.tsx` skeleton (from the URL change
 * until the page's content arrives). `phase` only picks where the fill starts,
 * so the hand-over between the two reads as one continuous bar.
 */
export function TopProgressBar({ phase }: { phase: "start" | "loading" }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden">
      <div
        className={cn(
          "h-full w-full origin-left bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]",
          phase === "start"
            ? "animate-[nav-progress_2.5s_cubic-bezier(0.1,0.7,0.2,1)_forwards]"
            : "animate-[nav-progress-loading_6s_cubic-bezier(0.1,0.7,0.2,1)_forwards]",
        )}
      />
    </div>
  );
}
