import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy (Phase 10).
 *
 * The browser never talks to Supabase or any other third party — authentication,
 * data and search all go through this app's own server — so everything is
 * restricted to this origin. What this blocks: framing by another site
 * (clickjacking), plugins, a `<base>` or form pointed elsewhere, images/fonts/
 * scripts loaded from anywhere else, and data being sent to any other host.
 *
 * `script-src` keeps 'unsafe-inline' because Next.js emits inline bootstrap
 * scripts and this app's public pages are statically rendered (a per-request
 * nonce needs every page dynamic). That means CSP is defence in depth here, not
 * the XSS control: the primary defences are that React escapes everything, no
 * `dangerouslySetInnerHTML` exists, and stored links are restricted to http(s)
 * (`src/lib/orders/url-normalize.ts`). 'unsafe-eval' is development-only (React
 * refresh).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isProduction ? "" : " ws: wss:"}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // HSTS only over HTTPS in production; sending it from http://localhost is ignored by browsers but pointless.
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // Do not advertise the framework and version on every response.
  poweredByHeader: false,
  // Never ship source maps to browsers: they reveal the original source of every client module.
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
