import { describe, expect, it } from "vitest";

import { decideRoute, hostModeFor, isPublicRoute, isSitePath } from "@/lib/routing/hosts";

const SITE = "https://growxeno.com";
const APP = "https://app.growxeno.com";

describe("hostModeFor", () => {
  it("stays one domain until the site URL is configured", () => {
    expect(hostModeFor("growxeno.com", undefined)).toBe("combined");
    expect(hostModeFor("app.growxeno.com", "")).toBe("combined");
  });

  it("tells the public site from the app", () => {
    expect(hostModeFor("growxeno.com", SITE)).toBe("site");
    expect(hostModeFor("www.growxeno.com", SITE)).toBe("site");
    expect(hostModeFor("GrowXeno.com", SITE)).toBe("site");
    expect(hostModeFor("app.growxeno.com", SITE)).toBe("app");
  });

  it("treats every other host (previews, local app host) as the app", () => {
    expect(hostModeFor("business-manager-git-x.vercel.app", SITE)).toBe("app");
    expect(hostModeFor("app.localhost:3000", "http://localhost:3000")).toBe("app");
    expect(hostModeFor("localhost:3000", "http://localhost:3000")).toBe("site");
  });
});

describe("decideRoute on the public site", () => {
  const site = (pathname: string, search = "") => decideRoute({ mode: "site", pathname, search, signedIn: null, appUrl: APP });

  it("serves the homepage, its form posts and API routes itself", () => {
    expect(site("/")).toEqual({ kind: "next" });
    expect(site("/api/cron/youtube-stats")).toEqual({ kind: "next" });
    expect(isSitePath("/_next/static/chunk.js")).toBe(true);
  });

  it("sends every app page to the app subdomain, path and query kept", () => {
    expect(site("/login")).toEqual({ kind: "redirect", location: `${APP}/login`, permanent: false });
    expect(site("/orders", "?open=abc")).toEqual({ kind: "redirect", location: `${APP}/orders?open=abc`, permanent: false });
    expect(site("/auth/callback", "?token_hash=t&type=recovery")).toEqual({
      kind: "redirect",
      location: `${APP}/auth/callback?token_hash=t&type=recovery`,
      permanent: false,
    });
    expect(site("/dashboard")).toEqual({ kind: "redirect", location: `${APP}/dashboard`, permanent: false });
  });
});

describe("decideRoute on the app", () => {
  const app = (pathname: string, signedIn: boolean | null, search = "") => decideRoute({ mode: "app", pathname, search, signedIn, appUrl: APP });

  it("renders the dashboard at the root for a signed-in user", () => {
    expect(app("/", true)).toEqual({ kind: "rewrite", pathname: "/dashboard" });
  });

  it("sends a signed-out visitor at the root to sign in, with no return path", () => {
    expect(app("/", false)).toEqual({ kind: "redirect", location: "/login", permanent: false });
  });

  it("keeps where a signed-out visitor was going", () => {
    expect(app("/orders", false, "?open=1")).toEqual({ kind: "redirect", location: `/login?next=${encodeURIComponent("/orders?open=1")}`, permanent: false });
  });

  it("sends a signed-in user away from the sign-in page to the root", () => {
    expect(app("/login", true)).toEqual({ kind: "redirect", location: "/", permanent: false });
    expect(app("/login", false)).toEqual({ kind: "next" });
  });

  it("folds the old /dashboard URL into the root", () => {
    expect(app("/dashboard", true)).toEqual({ kind: "redirect", location: "/", permanent: false });
    expect(app("/dashboard", false, "?x=1")).toEqual({ kind: "redirect", location: "/?x=1", permanent: false });
  });

  it("leaves app pages alone for a signed-in user", () => {
    expect(app("/orders", true)).toEqual({ kind: "next" });
    expect(app("/settings/users", true)).toEqual({ kind: "next" });
  });

  it("never sends the redirect targets around in a loop", () => {
    // "/" → /login for signed-out users; /login is public, so it stops there.
    expect(app("/login", false)).toEqual({ kind: "next" });
    // Signed in: /login → "/" → rewrite, never back to /login.
    expect(app("/", true).kind).toBe("rewrite");
  });

  it("lets the scheduled job and sign-in helpers through without a session", () => {
    expect(app("/api/cron/youtube-stats", false)).toEqual({ kind: "next" });
    expect(app("/auth/callback", false)).toEqual({ kind: "next" });
    expect(app("/forgot-password", false)).toEqual({ kind: "next" });
  });

  it("only rewrites the root when auth is not configured", () => {
    expect(app("/", null)).toEqual({ kind: "rewrite", pathname: "/dashboard" });
    expect(app("/orders", null)).toEqual({ kind: "next" });
  });
});

describe("decideRoute while still one domain (combined)", () => {
  const one = (pathname: string, signedIn: boolean | null) => decideRoute({ mode: "combined", pathname, search: "", signedIn, appUrl: APP });

  it("behaves as before: homepage at the root, dashboard at /dashboard", () => {
    expect(one("/", false)).toEqual({ kind: "next" });
    expect(one("/", true)).toEqual({ kind: "next" });
    expect(one("/dashboard", true)).toEqual({ kind: "next" });
    expect(one("/dashboard", false)).toEqual({ kind: "redirect", location: "/login", permanent: false });
    expect(one("/login", true)).toEqual({ kind: "redirect", location: "/dashboard", permanent: false });
  });

  it("keeps the root public only in combined mode", () => {
    expect(isPublicRoute("/", "combined")).toBe(true);
    expect(isPublicRoute("/", "app")).toBe(false);
  });
});
