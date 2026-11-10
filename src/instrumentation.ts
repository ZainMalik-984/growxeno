/**
 * Runs once when a Next.js server starts.
 *
 * YouTube stats timer (owner request, 2026-11-10): on a long-running server
 * (`next dev`, `next start`, a container) this checks every 15 minutes for
 * order items whose stats are older than the interval in Settings and
 * refreshes them. Serverless hosts (Vercel) don't keep a process alive between
 * requests, so there the scheduled endpoint /api/cron/youtube-stats does this
 * job instead (docs/DEPLOYMENT.md). Set STATS_TIMER=off to disable the timer.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.VERCEL || process.env.STATS_TIMER === "off" || process.env.NODE_ENV === "test") return;

  const TICK_MS = 15 * 60 * 1000;
  const { refreshDueItemStats } = await import("@/lib/youtube/stats-service");
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await refreshDueItemStats({ limit: 200 });
      if (result.checked > 0) console.info(`[youtube-stats] refreshed ${result.checked} item(s), ${result.failed} failed`);
    } catch (error) {
      console.error("[youtube-stats] scheduled refresh failed", error);
    } finally {
      running = false;
    }
  };
  // First run shortly after start, then on the timer; unref so it never keeps the process alive.
  setTimeout(tick, 60_000).unref();
  setInterval(tick, TICK_MS).unref();
}
