/**
 * Gig thumbnail images — stored in the Supabase Storage bucket below.
 * Same approach as category-images (src/lib/categories/images.ts):
 * checked by bytes, compressed to WebP before storage, full public URL
 * stored in fiverr_gigs.thumbnail_url.
 *
 * Bucket setup: create a PUBLIC bucket named "fiverr-gig-thumbnails" in
 * Supabase Storage (no additional RLS policy required; upload goes through
 * the server with the secret key, same as category images).
 */

export const GIG_THUMBNAIL_BUCKET = "fiverr-gig-thumbnails";
/** Largest original accepted (browser-side check). Server checks again. */
export const GIG_THUMBNAIL_MAX_BYTES = 8 * 1024 * 1024;
export const GIG_THUMBNAIL_ACCEPT = "image/png,image/jpeg,image/webp";

/** Full public URL for a path in the bucket. */
export function gigThumbnailUrl(path: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  if (!supabaseUrl) return null;
  const base = supabaseUrl.replace(/\/+$/, "");
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${GIG_THUMBNAIL_BUCKET}/${safePath}`;
}

/** Extracts the storage path from a full Supabase public URL, or null if it's not one of ours. */
export function pathFromGigThumbnailUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${GIG_THUMBNAIL_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}
