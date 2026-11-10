/**
 * Category images (2026-11-05, owner request), stored in the Supabase Storage
 * bucket below. Pure, so it is unit-tested; the upload itself is in
 * service.ts. Setup steps for the bucket: docs/ENVIRONMENT.md → "Category images".
 */

export const CATEGORY_IMAGE_BUCKET = "category-images";
/** Largest original accepted for upload. It is compressed before storage (optimize.ts). */
export const CATEGORY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
/** Largest file the bucket accepts (its own limit is set to the same value). */
export const CATEGORY_IMAGE_STORED_MAX_BYTES = 2 * 1024 * 1024;
/** Stored images fit within this many pixels on each side. */
export const CATEGORY_IMAGE_MAX_DIMENSION = 800;
export const CATEGORY_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

export type ImageKind = { ext: "png" | "jpg" | "webp"; contentType: "image/png" | "image/jpeg" | "image/webp" };

/**
 * What the file really is, from its first bytes — never the name or the type
 * the browser claims. SVG is deliberately not accepted: it can carry scripts.
 */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  const at = (i: number) => bytes[i];
  if (bytes.length >= 8 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) {
    return { ext: "png", contentType: "image/png" };
  }
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(at(0), at(1), at(2), at(3)) === "RIFF" &&
    String.fromCharCode(at(8), at(9), at(10), at(11)) === "WEBP"
  ) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

/** Public URL of an object in the bucket (the bucket is public: these are catalog images, not private files). */
export function categoryImageUrl(path: string | null, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  if (!path || !supabaseUrl) return null;
  const base = supabaseUrl.replace(/\/+$/, "");
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${CATEGORY_IMAGE_BUCKET}/${safePath}`;
}
