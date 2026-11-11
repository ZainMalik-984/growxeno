/**
 * The branded email layout (2026-11-12, owner request: "send a proper
 * professional template… currently the format is very flat"). Every email the
 * app sends goes through this: logo, a white card with a title, short
 * paragraphs, an optional details table, one clear button, and a footer.
 *
 * Email-client safe: table layout, inline styles only, no web fonts or
 * external CSS, a hidden preheader for the inbox preview, a 600px card that
 * shrinks on phones, and a plain-text version with the same content.
 * Everything passed in is escaped. Pure, so it is unit-tested.
 */

export const BRAND = {
  name: "Grow Xeno",
  green: "#15795B",
  greenDark: "#0F5E46",
  greenTint: "#E8F5EF",
  navy: "#141C2B",
  ink: "#1F2937",
  muted: "#6B7280",
  line: "#E5E7EB",
  page: "#F3F4F6",
};

/** Images must be on a public https address; local runs fall back to the live site. */
export function assetBase(appUrl: string): string {
  return /^https:\/\//.test(appUrl) ? appUrl.replace(/\/$/, "") : "https://www.growxeno.com";
}

export type EmailDetail = { label: string; value: string; href?: string };

export type EmailContent = {
  /** Shown in the inbox list after the subject. */
  preheader: string;
  /** Small label above the title, e.g. "New task". */
  eyebrow?: string;
  title: string;
  greeting?: string;
  paragraphs: string[];
  details?: EmailDetail[];
  /** A highlighted figure row, e.g. Need / Current / Stop at. */
  figures?: { label: string; value: string; strong?: boolean }[];
  button?: { label: string; url: string };
  /** Small print under the button. */
  note?: string;
  /** Why they got it, in the footer. */
  footerReason: string;
  appUrl: string;
  contactEmail?: string;
};

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Only http(s) links are ever put in an href. */
const safeUrl = (url: string) => (/^https?:\/\//i.test(url) ? escape(url) : "#");

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const base = assetBase(content.appUrl);
  const p = (text: string) => `<p style="margin:0 0 14px;font:15px/1.6 ${FONT};color:${BRAND.ink}">${escape(text)}</p>`;

  const details =
    content.details && content.details.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;border:1px solid ${BRAND.line};border-radius:10px;border-collapse:separate">
${content.details
  .map(
    (row, index) => `<tr>
  <td style="padding:11px 14px;${index > 0 ? `border-top:1px solid ${BRAND.line};` : ""}font:13px/1.4 ${FONT};color:${BRAND.muted};width:38%;vertical-align:top">${escape(row.label)}</td>
  <td style="padding:11px 14px;${index > 0 ? `border-top:1px solid ${BRAND.line};` : ""}font:600 14px/1.4 ${FONT};color:${BRAND.navy};word-break:break-word">${
    row.href ? `<a href="${safeUrl(row.href)}" style="color:${BRAND.green};text-decoration:underline">${escape(row.value)}</a>` : escape(row.value)
  }</td>
</tr>`,
  )
  .join("\n")}
</table>`
      : "";

  const figures =
    content.figures && content.figures.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:${BRAND.greenTint};border-radius:10px">
<tr>
${content.figures
  .map(
    (figure) => `<td align="center" style="padding:14px 8px;font:12px/1.4 ${FONT};color:${BRAND.muted}">${escape(figure.label)}<br>
  <span style="display:inline-block;margin-top:4px;font:${figure.strong ? 700 : 600} ${figure.strong ? 20 : 17}px/1.2 ${FONT};color:${figure.strong ? BRAND.greenDark : BRAND.navy}">${escape(figure.value)}</span></td>`,
  )
  .join("\n")}
</tr>
</table>`
      : "";

  const button = content.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 18px">
<tr><td style="border-radius:10px;background:${BRAND.green}">
  <a href="${safeUrl(content.button.url)}" style="display:inline-block;padding:13px 26px;font:600 15px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:10px">${escape(content.button.label)}</a>
</td></tr>
</table>
<p style="margin:0 0 18px;font:12px/1.5 ${FONT};color:${BRAND.muted}">Button not working? Copy this link into your browser:<br>
<a href="${safeUrl(content.button.url)}" style="color:${BRAND.green};word-break:break-all">${escape(content.button.url)}</a></p>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escape(content.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(content.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.page}">
<tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
    <tr><td style="padding:0 4px 18px">
      <img src="${base}/brand/grow-xeno-wordmark.png" width="150" alt="${BRAND.name}" style="display:block;width:150px;max-width:150px;height:auto;border:0">
    </td></tr>
    <tr><td style="background:#ffffff;border:1px solid ${BRAND.line};border-radius:14px;padding:30px 28px">
      ${content.eyebrow ? `<p style="margin:0 0 6px;font:600 12px/1.4 ${FONT};letter-spacing:.06em;text-transform:uppercase;color:${BRAND.green}">${escape(content.eyebrow)}</p>` : ""}
      <h1 style="margin:0 0 18px;font:700 22px/1.3 ${FONT};color:${BRAND.navy}">${escape(content.title)}</h1>
      ${content.greeting ? p(content.greeting) : ""}
      ${content.paragraphs.map(p).join("\n      ")}
      ${figures}
      ${details}
      ${button}
      ${content.note ? `<p style="margin:0;font:13px/1.5 ${FONT};color:${BRAND.muted}">${escape(content.note)}</p>` : ""}
    </td></tr>
    <tr><td style="padding:20px 6px 0;font:12px/1.6 ${FONT};color:${BRAND.muted}">
      ${escape(content.footerReason)}${
        content.contactEmail
          ? ` Questions? Write to <a href="mailto:${escape(content.contactEmail)}" style="color:${BRAND.muted};text-decoration:underline">${escape(content.contactEmail)}</a>.`
          : ""
      }<br>
      &copy; ${BRAND.name} &middot; Digital growth services
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    content.eyebrow ? content.eyebrow.toUpperCase() : null,
    content.title,
    "",
    content.greeting ?? null,
    ...content.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ...(content.figures ?? []).map((figure) => `${figure.label}: ${figure.value}`),
    content.figures?.length ? "" : null,
    ...(content.details ?? []).map((row) => `${row.label}: ${row.href && row.href !== row.value ? `${row.value} (${row.href})` : row.value}`),
    content.details?.length ? "" : null,
    content.button ? `${content.button.label}: ${content.button.url}` : null,
    content.button ? "" : null,
    content.note ?? null,
    content.note ? "" : null,
    "—",
    content.footerReason,
    BRAND.name,
  ]
    .filter((line): line is string => line !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  return { html, text };
}
