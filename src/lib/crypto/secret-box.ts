/**
 * Symmetric encryption for a small number of genuinely sensitive values stored
 * in the database — currently only a Fiverr account's PayPal password
 * (confirmed directly, 2026-09-27: PayPal email + password, "for now").
 *
 * Deliberately NOT `server-only`: it needs to be unit-testable under plain
 * Vitest, the same reasoning as `src/lib/orders/state-machine.ts`. Node's
 * `crypto` does not exist in a browser bundle at all, so importing this from
 * a "use client" file fails at build time regardless — only ever import it
 * from a domain's `service.ts`.
 *
 * AES-256-GCM, no third-party dependency. Output is `iv (12) + authTag (16) +
 * ciphertext`, base64-encoded, so it round-trips through a single `text`
 * column. `CREDENTIALS_ENCRYPTION_KEY` must be a base64-encoded 32-byte key
 * (`openssl rand -base64 32`) — see docs/ENVIRONMENT.md. Missing or malformed
 * key fails the write closed rather than ever storing a secret in plain text.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function loadKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY is not set — refusing to store a credential in plain text. Generate one with `openssl rand -base64 32`.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes. Generate one with `openssl rand -base64 32`.");
  }
  return key;
}

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, loadKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(encoded: string): string {
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = raw.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, loadKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
