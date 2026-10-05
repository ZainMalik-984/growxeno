import { randomBytes } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";

beforeEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a value", () => {
    const cipherText = encryptSecret("correct horse battery staple");
    expect(decryptSecret(cipherText)).toBe("correct horse battery staple");
  });

  it("round-trips an empty string and unicode", () => {
    expect(decryptSecret(encryptSecret(""))).toBe("");
    expect(decryptSecret(encryptSecret("پاس ورڈ 🔒"))).toBe("پاس ورڈ 🔒");
  });

  it("never stores the plain text in the ciphertext", () => {
    const cipherText = encryptSecret("correct horse battery staple");
    expect(cipherText).not.toContain("correct horse battery staple");
  });

  it("produces a different ciphertext each time (random IV), but both decrypt correctly", () => {
    const a = encryptSecret("same value");
    const b = encryptSecret("same value");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same value");
    expect(decryptSecret(b)).toBe("same value");
  });

  it("fails closed when the key is missing", () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(/CREDENTIALS_ENCRYPTION_KEY/);
  });

  it("fails closed when the key is the wrong length", () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.from("too short").toString("base64");
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
  });

  it("rejects tampered ciphertext rather than returning garbage", () => {
    const cipherText = encryptSecret("correct horse battery staple");
    const tampered = Buffer.from(cipherText, "base64");
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decryptSecret(tampered.toString("base64"))).toThrow();
  });
});
