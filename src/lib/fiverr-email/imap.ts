import "server-only";

// ImapFlow is a modern IMAP client. It is imported dynamically so that the
// module can be tree-shaken in environments that don't use it, and to avoid
// build-time issues if the package hasn't been installed yet.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ImapFlow } = require("imapflow");

export interface FetchedEmail {
  messageId: string;
  subject: string;
  date: Date;
  text: string;
  html: string;
}

/**
 * Connect to Gmail via IMAP and fetch Fiverr notification emails in a date range.
 *
 * Uses App Password authentication — no OAuth required. The App Password must
 * be generated at myaccount.google.com/apppasswords with 2-Step Verification
 * enabled on the Gmail account.
 */
export async function fetchFiverrEmailsFromGmail(
  email: string,
  appPassword: string,
  since: Date,
  before?: Date,
): Promise<FetchedEmail[]> {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: email, pass: appPassword },
    logger: false,
  });

  await client.connect();

  const results: FetchedEmail[] = [];

  try {
    await client.mailboxOpen("INBOX");

    // Build search criteria: FROM fiverr.com, received in the given date window.
    // ImapFlow's search uses RFC 3501 criteria.
    const searchCriteria: Record<string, unknown> = {
      from: "fiverr.com",
      since,
    };
    if (before) {
      searchCriteria.before = before;
    }

    const uids = await client.search(searchCriteria, { uid: true });
    if (!uids || uids.length === 0) return [];

    for await (const msg of client.fetch(uids, { envelope: true, bodyStructure: true, source: true }, { uid: true })) {
      try {
        const raw: Buffer = msg.source;
        const rawStr = raw.toString("utf8");

        // Extract text and HTML parts from the raw RFC 2822 message.
        const { text, html } = extractParts(rawStr);

        const messageId: string =
          (msg.envelope?.messageId as string | undefined)?.replace(/[<>]/g, "") ??
          `uid-${msg.uid}`;

        const subject: string = (msg.envelope?.subject as string | undefined) ?? "";
        const dateVal = msg.envelope?.date;
        const date: Date = dateVal instanceof Date ? dateVal : new Date(dateVal as string);

        results.push({ messageId, subject, date, text, html });
      } catch {
        // Skip malformed messages silently — the cron logs them separately.
      }
    }
  } finally {
    await client.logout();
  }

  return results;
}

/**
 * Minimal RFC 2822 / MIME part extractor.
 * Returns the plaintext and HTML bodies from a raw email string.
 * Good enough for well-formed HTML emails from large senders like Fiverr.
 */
function extractParts(raw: string): { text: string; html: string } {
  // Decode quoted-printable
  const qpDecode = (s: string) =>
    s
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Find boundary if multipart
  const boundaryMatch = raw.match(/boundary="?([^"\r\n;]+)"?/i);

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = raw.split(new RegExp(`--${escapeRegex(boundary)}(?:--)?`));
    let text = "";
    let html = "";

    for (const part of parts) {
      const ctMatch = part.match(/Content-Type:\s*([^\r\n;]+)/i);
      const ceMatch = part.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);
      const ct = ctMatch?.[1]?.trim().toLowerCase() ?? "";
      const ce = ceMatch?.[1]?.trim().toLowerCase() ?? "";

      // Body is after the first blank line in the part
      const bodyStart = part.indexOf("\r\n\r\n") + 4;
      let body = bodyStart > 3 ? part.slice(bodyStart) : "";

      if (ce === "quoted-printable") body = qpDecode(body);
      else if (ce === "base64") {
        try {
          body = Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8");
        } catch {
          body = "";
        }
      }

      if (ct.includes("text/plain") && !text) text = body;
      else if (ct.includes("text/html") && !html) html = body;
    }

    return { text, html };
  }

  // Non-multipart: treat the whole body as text
  const bodyStart = raw.indexOf("\r\n\r\n") + 4;
  const body = bodyStart > 3 ? raw.slice(bodyStart) : raw;
  return { text: body, html: "" };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
