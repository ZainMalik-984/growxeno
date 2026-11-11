import { beforeEach, describe, expect, it, vi } from "vitest";

/** Invitations and password resets emailed by the app through Resend (2026-11-12). */

vi.mock("server-only", () => ({}));
let emailEnv: { apiKey: string; from: string } | null = { apiKey: "re_test", from: "Grow Xeno <info@growxeno.com>" };
vi.mock("@/lib/env", () => ({ getAppUrl: () => "https://www.growxeno.com", getEmailEnv: () => emailEnv }));
vi.mock("@/lib/settings/queries", () => ({ getSiteContact: async () => ({ email: "info@growxeno.com" }) }));
const send = vi.fn<
  (message: { to: string; subject: string; body: string; html?: string }) => Promise<{ ok: true; providerMessageId: string } | { ok: false; error: string }>
>();
vi.mock("@/lib/notifications/providers", () => ({ getEmailProvider: () => ({ sendTemplate: send }) }));

const { authCallbackLink, inviteByEmail, sendPasswordResetEmail } = await import("@/lib/auth/invite");

function adminClient(tokenHash: string | null = "hash123") {
  return {
    auth: {
      admin: {
        generateLink: vi.fn(async () =>
          tokenHash
            ? { data: { user: { id: "auth-1" }, properties: { hashed_token: tokenHash, action_link: "https://x.supabase.co/auth/v1/verify?token=abc" } }, error: null }
            : { data: { user: null, properties: null }, error: { message: "User not found" } },
        ),
        inviteUserByEmail: vi.fn(async () => ({ data: { user: { id: "auth-2" } }, error: null })),
        deleteUser: vi.fn(async () => ({ data: null, error: null })),
      },
    },
  };
}

const LINK = "https://www.growxeno.com/auth/callback?token_hash=hash123&type=invite&next=%2Fauth%2Freset-password";

describe("inviteByEmail", () => {
  beforeEach(() => {
    send.mockReset();
    emailEnv = { apiKey: "re_test", from: "Grow Xeno <info@growxeno.com>" };
  });

  it("emails a link to this app's /auth/callback (not Supabase's action link), on the branded template", async () => {
    send.mockResolvedValue({ ok: true, providerMessageId: "m1" });
    const admin = adminClient();
    const result = await inviteByEmail(admin as never, { email: "zee@example.com", fullName: "Zain Ul Abideen", kind: "worker" });
    expect(result).toEqual({ ok: true, authUserId: "auth-1" });
    expect(admin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
    const message = send.mock.calls[0]![0];
    expect(message).toMatchObject({ to: "zee@example.com", subject: "Your Grow Xeno portal invitation" });
    expect(message.body).toContain(LINK);
    expect(message.html).toContain(LINK.replace(/&/g, "&amp;"));
    expect(message.html).not.toContain("supabase.co/auth/v1/verify");
    expect(message.html).toContain("Welcome to the Grow Xeno portal");
  });

  it("removes the new account when the email can't be sent, so a retry starts clean", async () => {
    send.mockResolvedValue({ ok: false, error: "domain not verified" });
    const admin = adminClient();
    const result = await inviteByEmail(admin as never, { email: "zee@example.com", fullName: "Zain", kind: "team" });
    expect(result).toEqual({ ok: false, error: "The invitation email couldn't be sent: domain not verified" });
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith("auth-1");
  });

  it("falls back to Supabase's own invite email when Resend isn't set up", async () => {
    emailEnv = null;
    const admin = adminClient();
    expect(await inviteByEmail(admin as never, { email: "zee@example.com", fullName: "Zain", kind: "team" })).toEqual({ ok: true, authUserId: "auth-2" });
    expect(admin.auth.admin.generateLink).not.toHaveBeenCalled();
  });
});

describe("sendPasswordResetEmail", () => {
  beforeEach(() => send.mockReset());

  it("sends a branded reset email with a recovery link", async () => {
    send.mockResolvedValue({ ok: true, providerMessageId: "m2" });
    await sendPasswordResetEmail(adminClient() as never, "zee@example.com");
    const message = send.mock.calls[0]![0];
    expect(message.subject).toBe("Reset your Grow Xeno password");
    expect(message.body).toContain("type=recovery");
  });

  it("sends nothing for an address without an account (and says nothing about it)", async () => {
    await sendPasswordResetEmail(adminClient(null) as never, "nobody@example.com");
    expect(send).not.toHaveBeenCalled();
  });
});

describe("authCallbackLink", () => {
  it("builds the link the callback route verifies", () => {
    expect(authCallbackLink("https://www.growxeno.com", "hash123", "invite")).toBe(LINK);
  });
});
