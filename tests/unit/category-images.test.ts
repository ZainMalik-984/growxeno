import { describe, expect, it } from "vitest";

import { categoryImageUrl, sniffImage } from "@/lib/categories/images";

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);

describe("category images", () => {
  it("recognises PNG, JPEG and WebP by their bytes", () => {
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe("png");
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe("jpg");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffImage(webp)?.contentType).toBe("image/webp");
  });

  it("refuses anything else, including SVG and a renamed text file", () => {
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("GIF89a........"))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });

  it("builds the public URL from the stored path", () => {
    expect(categoryImageUrl("abc/1 2.png", "https://proj.supabase.co/")).toBe(
      "https://proj.supabase.co/storage/v1/object/public/category-images/abc/1%202.png",
    );
    expect(categoryImageUrl(null, "https://proj.supabase.co")).toBeNull();
    expect(categoryImageUrl("abc/x.png", undefined)).toBeNull();
  });
});
