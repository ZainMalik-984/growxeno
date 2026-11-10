import "server-only";

import sharp from "sharp";

import { CATEGORY_IMAGE_MAX_DIMENSION, CATEGORY_IMAGE_STORED_MAX_BYTES } from "./images";

/**
 * Optimizes a category image before it is stored (owner request, 2026-11-05:
 * "image uploads should be optimized and compressed"):
 * - turned upright using the photo's orientation tag;
 * - resized to fit within 800 × 800 (never enlarged);
 * - re-encoded as WebP at quality 80;
 * - stripped of all metadata (EXIF, including any GPS location).
 * Re-encoding also means only real pixel data reaches storage.
 */
export async function optimizeCategoryImage(
  input: Uint8Array,
): Promise<{ ok: true; bytes: Buffer; width: number; height: number } | { ok: false; error: string }> {
  try {
    const { data, info } = await sharp(input, { limitInputPixels: 50_000_000, failOn: "error" })
      .rotate()
      .resize(CATEGORY_IMAGE_MAX_DIMENSION, CATEGORY_IMAGE_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    if (data.length > CATEGORY_IMAGE_STORED_MAX_BYTES) {
      return { ok: false, error: "That image couldn't be compressed enough. Try a simpler or smaller image." };
    }
    return { ok: true, bytes: data, width: info.width, height: info.height };
  } catch {
    return { ok: false, error: "That image couldn't be read. Try saving it again as a PNG or JPEG." };
  }
}
