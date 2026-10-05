import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { parse } from "dotenv";

/**
 * Secret-exposure scan (Phase 10). Uses the REAL secret values from .env.local
 * and searches for them — never printing a value, only the variable name and
 * where it was found:
 *
 *   1. the production browser bundle (`.next/static`) — anything here is served
 *      to every visitor. Run `pnpm build` first.
 *   2. every file git would commit (tracked, plus untracked and not ignored)
 *   3. git history, all branches
 *
 * Also flags anything shaped like a key (JWT, Resend, Supabase secret, a
 * postgres:// URL with a password) in committable files, even if it is not in
 * .env.local. Exits non-zero on any finding.
 *
 *   pnpm build && pnpm security:secrets
 */

const findings: string[] = [];
const note = (line: string) => findings.push(line);

const envPath = ".env.local";
if (!existsSync(envPath)) throw new Error(".env.local not found — nothing to scan for.");
const env = parse(readFileSync(envPath));

const IS_PUBLIC = /^NEXT_PUBLIC_/;
const secrets: Array<{ name: string; value: string }> = [];
for (const [name, value] of Object.entries(env)) {
  // Display names and other non-secret settings would only produce noise.
  if (IS_PUBLIC.test(name) || /_NAME$/.test(name) || !value) continue;
  if (value.length >= 12) secrets.push({ name, value });
  // A connection string's password is the secret, and may appear on its own.
  try {
    const url = new URL(value);
    if (url.password && url.password.length >= 8) secrets.push({ name: `${name} (password part)`, value: decodeURIComponent(url.password) });
  } catch {
    /* not a URL */
  }
}

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

// 1. Browser bundle
const clientDir = ".next/static";
if (!existsSync(clientDir)) {
  note("SKIPPED  browser bundle: .next/static not found — run `pnpm build` first");
} else {
  const files = walk(clientDir).filter((f) => /\.(js|css|html|json|map)$/.test(f));
  const blobs = files.map((f) => ({ f, text: readFileSync(f, "utf8") }));
  for (const { name, value } of secrets) {
    const hit = blobs.find((b) => b.text.includes(value));
    if (hit) note(`FAIL  ${name} found in the BROWSER BUNDLE (${hit.f})`);
  }
  console.log(`scanned ${files.length} browser-bundle files for ${secrets.length} secret values`);
}

// 2. Committable files
const listed = git("ls-files", "-co", "--exclude-standard", "-z").split("\0").filter(Boolean);
const textFiles = listed.filter((f) => existsSync(f) && statSync(f).size < 2_000_000 && !/\.(png|jpg|jpeg|gif|ico|woff2?|pdf|lock)$/i.test(f) && f !== "pnpm-lock.yaml");
const SHAPES: Array<{ label: string; re: RegExp }> = [
  { label: "JWT-shaped token", re: /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/ },
  { label: "Resend-style API key", re: /\bre_[A-Za-z0-9_]{20,}/ },
  { label: "Supabase secret/personal key", re: /\b(sb_secret_|sbp_)[A-Za-z0-9_-]{16,}/ },
  { label: "Postgres URL containing a password", re: /postgres(ql)?:\/\/[^\s:@/]+:(?!password@|\[|<|your-|xxx)[^\s@/]{6,}@/ },
];
for (const file of textFiles) {
  const text = readFileSync(file, "utf8");
  for (const { name, value } of secrets) {
    if (text.includes(value)) note(`FAIL  ${name} appears in ${file}`);
  }
  text.split("\n").forEach((line, i) => {
    for (const { label, re } of SHAPES) if (re.test(line)) note(`FAIL  ${label} in ${file}:${i + 1}`);
  });
}
console.log(`scanned ${textFiles.length} committable files`);

// 3. History
let commits = 0;
try {
  commits = git("rev-list", "--all").split("\n").filter(Boolean).length;
  for (const { name, value } of secrets) {
    const hits = git("log", "--all", "--oneline", "-S", value).trim();
    if (hits) note(`FAIL  ${name} appears in git history: ${hits.split("\n").map((l) => l.slice(0, 7)).join(", ")}`);
  }
} catch {
  note("SKIPPED  git history (not a git repository?)");
}
console.log(`scanned ${commits} commits of history`);

const failed = findings.filter((f) => f.startsWith("FAIL"));
for (const f of findings) console.log(f);
console.log(failed.length === 0 ? "\nNo secret exposure found." : `\n${failed.length} exposure(s) found.`);
if (failed.length > 0) process.exitCode = 1;
