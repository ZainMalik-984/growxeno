import { describe, expect, it } from "vitest";

import { inquirySchema } from "@/lib/inquiries/schema";
import {
  DEFAULT_SITE_CONTACT,
  DEFAULT_WHATSAPP_MESSAGE,
  normalizeSocialLink,
  parseSiteContact,
  siteContactSchema,
  telHref,
  whatsappHref,
} from "@/lib/settings/site-contact";

describe("inquiry form", () => {
  it("accepts a normal inquiry and trims it", () => {
    const parsed = inquirySchema.parse({ name: "  Sara ", email: "sara@example.com", service: "", message: "I want to grow my channel." });
    expect(parsed).toEqual({ name: "Sara", email: "sara@example.com", service: null, message: "I want to grow my channel." });
  });

  it("rejects missing or oversized fields", () => {
    expect(inquirySchema.safeParse({ name: "", email: "a@b.co", message: "Hello there" }).success).toBe(false);
    expect(inquirySchema.safeParse({ name: "A", email: "not-an-email", message: "Hello there" }).success).toBe(false);
    expect(inquirySchema.safeParse({ name: "A", email: "a@b.co", message: "x".repeat(5001) }).success).toBe(false);
  });
});

describe("site contact", () => {
  it("requires an email and validates optional numbers", () => {
    expect(siteContactSchema.parse({ email: "hello@growxeno.com", phone: "", whatsapp: "+92 300 1234567" })).toMatchObject({
      email: "hello@growxeno.com",
      phone: null,
      whatsapp: "+92 300 1234567",
    });
    expect(siteContactSchema.safeParse({ email: "", phone: null, whatsapp: null }).success).toBe(false);
    expect(siteContactSchema.safeParse({ email: "a@b.co", phone: "call me", whatsapp: null }).success).toBe(false);
  });

  it("falls back to the default when the stored value is unreadable", () => {
    expect(parseSiteContact(null)).toEqual(DEFAULT_SITE_CONTACT);
    expect(parseSiteContact({ email: "nope" })).toEqual(DEFAULT_SITE_CONTACT);
  });

  it("builds safe phone and WhatsApp links", () => {
    expect(telHref("+92 (300) 123-4567")).toBe("tel:+923001234567");
    expect(whatsappHref("+92 300 1234567")).toBe("https://wa.me/923001234567");
  });
});

describe("social links and WhatsApp message", () => {
  it("turns handles and pasted links into full profile links", () => {
    expect(normalizeSocialLink("instagram", "@growxeno")).toBe("https://www.instagram.com/growxeno");
    expect(normalizeSocialLink("instagram", "instagram.com/grow.xeno/")).toBe("https://instagram.com/grow.xeno");
    expect(normalizeSocialLink("twitter", "growxeno")).toBe("https://x.com/growxeno");
    expect(normalizeSocialLink("twitter", "http://twitter.com/growxeno")).toBe("https://twitter.com/growxeno");
    expect(normalizeSocialLink("facebook", "https://www.facebook.com/growxeno")).toBe("https://www.facebook.com/growxeno");
  });

  it("refuses links to the wrong site or with no profile", () => {
    expect(normalizeSocialLink("instagram", "https://evil.example/growxeno")).toBeNull();
    expect(normalizeSocialLink("facebook", "instagram.com/growxeno")).toBeNull();
    expect(normalizeSocialLink("instagram", "instagram.com")).toBeNull();
    expect(siteContactSchema.safeParse({ email: "a@b.co", instagram: "https://evil.example/x" }).success).toBe(false);
  });

  it("opens WhatsApp with the message typed in", () => {
    expect(whatsappHref("+92 300 1234567", "Hi, I'd like a quote")).toBe("https://wa.me/923001234567?text=Hi%2C%20I'd%20like%20a%20quote");
    expect(whatsappHref("+92 300 1234567", null)).toBe("https://wa.me/923001234567");
  });

  it("gives values saved before the message existed the default text", () => {
    expect(parseSiteContact({ email: "hello@growxeno.com", phone: null, whatsapp: null }).whatsappMessage).toBe(DEFAULT_WHATSAPP_MESSAGE);
    expect(parseSiteContact({ email: "hello@growxeno.com", whatsappMessage: "" }).whatsappMessage).toBeNull();
  });
});
