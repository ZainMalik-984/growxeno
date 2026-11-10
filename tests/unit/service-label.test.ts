import { describe, expect, it } from "vitest";

import { serviceLabel } from "@/lib/services/label";

describe("serviceLabel", () => {
  it("puts the platform before the service", () => {
    expect(serviceLabel("Views", "TikTok")).toBe("TikTok · Views");
    expect(serviceLabel("Followers", "X")).toBe("X · Followers");
    // A one-letter category must not match a letter inside a word.
    expect(serviceLabel("Max views", "X")).toBe("X · Max views");
    expect(serviceLabel("X followers", "X")).toBe("X followers");
  });

  it("leaves names that already say the platform, or have none", () => {
    expect(serviceLabel("YouTube Views", "YouTube")).toBe("YouTube Views");
    expect(serviceLabel("youtube views", "YouTube")).toBe("youtube views");
    expect(serviceLabel("Views", null)).toBe("Views");
    expect(serviceLabel("Views", "  ")).toBe("Views");
  });
});
