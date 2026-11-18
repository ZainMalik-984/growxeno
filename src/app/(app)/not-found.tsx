import { InAppNotFound } from "./in-app-not-found";

/**
 * "Not found" inside the app (2026-11-18): a record that doesn't exist (or
 * was deleted, or isn't yours to see) shows a light card in the app's own
 * style, inside the sidebar and top bar, with a way back to its list. The
 * dark full-screen page (src/app/not-found.tsx) stays for anyone outside the
 * app.
 */
export default function AppNotFound() {
  return <InAppNotFound />;
}
