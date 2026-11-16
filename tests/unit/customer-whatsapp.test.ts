import { describe, expect, it } from "vitest";

import { customerWhatsappUrl } from "@/lib/customers/whatsapp";

describe("customerWhatsappUrl", () => {
  it("makes a click-to-chat link from an international number", () => {
    expect(customerWhatsappUrl("+92 300 123-4567")).toBe("https://wa.me/923001234567");
    expect(customerWhatsappUrl("0092 300 1234567")).toBe("https://wa.me/923001234567");
  });

  it("is null without digits", () => {
    expect(customerWhatsappUrl("")).toBeNull();
    expect(customerWhatsappUrl(null)).toBeNull();
  });
});
