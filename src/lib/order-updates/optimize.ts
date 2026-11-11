import "server-only";

import sharp from "sharp";

import { ITEM_UPDATE_MAX_DIMENSION } from "./rules";

/**
 * Prepares an update screenshot for storage, like category images: turned
 * upright, fitted within 1600 × 1600 (never enlarged), re-encoded as WebP
 * and stripped of all metadata (EXIF, including any GPS location). Quality
 * is a little higher than for catalog images so numbers stay readable.
 */
export async function optimizeUpdateImage(input: Uint8Array): Promise<{ ok: true; bytes: Buffer } | { ok: false; error: string }> {
  try {
    const bytes = await sharp(input, { limitInputPixels: 60_000_000, failOn: "error" })
      .rotate()
      .resize(ITEM_UPDATE_MAX_DIMENSION, ITEM_UPDATE_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    return { ok: true, bytes };
  } catch {
    return { ok: false, error: "A screenshot couldn't be read. Try saving it again as a PNG or JPEG." };
  }
}
