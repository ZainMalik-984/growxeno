import { NextResponse, type NextRequest } from "next/server";

import { getCurrentActor } from "@/lib/auth/session";
import { globalSearch } from "@/lib/search/queries";

/**
 * Global search endpoint (specification Section 76). A GET Route Handler rather
 * than a Server Action so the browser can abort a superseded request (Server
 * Actions queue and cannot be cancelled), and so nothing about a keystroke
 * triggers a page re-render. Authorizes for itself, like every handler here;
 * per-category visibility is enforced inside `globalSearch`. `no-store` because
 * results are per-user and must never be served from a shared cache.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const actor = await getCurrentActor();
  if (!actor || !actor.user.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await globalSearch(actor, q);
  return NextResponse.json({ results }, { headers: { "Cache-Control": "private, no-store" } });
}
