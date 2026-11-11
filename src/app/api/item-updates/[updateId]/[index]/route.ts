import { getCurrentActor } from "@/lib/auth/session";
import { readItemUpdateImage } from "@/lib/order-updates/service";

/**
 * One screenshot from an order item's updates thread (2026-11-11). The file
 * lives in a private bucket; this checks the signed-in person may see the
 * item, then streams it from this app's own origin, so the browser never
 * talks to Supabase (the CSP allows images from 'self' only).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: RouteContext<"/api/item-updates/[updateId]/[index]">): Promise<Response> {
  const { updateId, index } = await params;
  const position = Number(index);
  if (!UUID.test(updateId) || !Number.isInteger(position) || position < 0 || position > 9) {
    return new Response("Not found", { status: 404 });
  }

  const actor = await getCurrentActor();
  if (!actor) return new Response("Unauthorized", { status: 401 });

  const image = await readItemUpdateImage(actor, updateId, position);
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(image, {
    headers: {
      "Content-Type": "image/webp",
      // Private to this browser; a post's screenshots never change.
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
