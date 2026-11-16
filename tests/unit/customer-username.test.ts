import { describe, expect, it } from "vitest";

import { customerUsername } from "@/lib/customers/username";

describe("customerUsername", () => {
  it("is the name when left empty", () => {
    expect(customerUsername("Cpiplo", undefined)).toBe("Cpiplo");
    expect(customerUsername(" Cpiplo ", "   ")).toBe("Cpiplo");
  });

  it("keeps a username that was typed", () => {
    expect(customerUsername("Cpiplo", " cpiplo_yt ")).toBe("cpiplo_yt");
  });
});
