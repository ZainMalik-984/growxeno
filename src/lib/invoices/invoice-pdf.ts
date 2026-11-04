import {
  computeTotals,
  formatDate,
  formatMoney,
  hasCountableItems,
  isCountable,
  lineTotal,
  partyLines,
  printableItems,
  type InvoiceData,
  type InvoiceParty,
} from "./invoice";

/**
 * Draws the invoice as a vector A4 PDF (real, selectable text) and downloads
 * it. Runs entirely in the browser; nothing is uploaded or stored.
 */

type RGB = [number, number, number];

const INK: RGB = [24, 33, 38];
const MUTED: RGB = [99, 110, 116];
const FAINT: RGB = [148, 158, 163];
const LINE: RGB = [226, 231, 229];
const GREEN: RGB = [4, 150, 82];
const TINT: RGB = [241, 249, 244];
const ZEBRA: RGB = [249, 251, 250];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 18; // page margin
const RIGHT = PAGE_W - M;
const FOOTER_Y = PAGE_H - 14;
const BODY_BOTTOM = FOOTER_Y - 10;

const LOGO_SRC = "/brand/grow-xeno-wordmark.png";
const LOGO_RATIO = 171 / 720;

async function loadImage(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fileName(number: string): string {
  const cleaned = number.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `Invoice-${cleaned || "draft"}.pdf`;
}

export async function downloadInvoicePdf(data: InvoiceData): Promise<void> {
  const logo = await loadImage(LOGO_SRC);
  const doc = await buildInvoicePdf(data, logo);
  doc.save(fileName(data.number));
}

/** Builds the PDF document. `logo` is a PNG data URL (or null for a text heading). */
export async function buildInvoicePdf(data: InvoiceData, logo: string | null) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const font = (style: "normal" | "bold", size: number) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  };
  const label = (text: string, x: number, y: number, align: "left" | "right" = "left") => {
    font("bold", 7);
    color(FAINT);
    doc.setCharSpace(0.35);
    doc.text(text.toUpperCase(), x, y, { align });
    doc.setCharSpace(0);
  };

  doc.setProperties({ title: `Invoice ${data.number}`, creator: "Grow Xeno" });

  // ── Header ────────────────────────────────────────────────────────────
  fill(GREEN);
  doc.rect(0, 0, PAGE_W, 2.5, "F");

  const logoW = 56;
  if (logo) {
    doc.addImage(logo, "PNG", M, 13, logoW, logoW * LOGO_RATIO);
  } else {
    font("bold", 18);
    color(INK);
    doc.text(data.from.name || "Grow Xeno", M, 24);
  }

  font("bold", 24);
  color(INK);
  doc.text("INVOICE", RIGHT, 22, { align: "right" });
  font("normal", 10);
  color(MUTED);
  doc.text(`No. ${data.number || "—"}`, RIGHT, 28.5, { align: "right" });

  stroke(LINE);
  doc.setLineWidth(0.3);
  doc.line(M, 38, RIGHT, 38);

  // ── Parties + summary box ─────────────────────────────────────────────
  const top = 47;
  const colW = 54;

  const drawParty = (title: string, party: InvoiceParty, x: number): number => {
    label(title, x, top);
    let y = top + 6;
    font("bold", 10.5);
    color(INK);
    const name = doc.splitTextToSize(party.name || "—", colW) as string[];
    doc.text(name, x, y);
    y += name.length * 4.6;
    font("normal", 8.8);
    color(MUTED);
    for (const line of partyLines(party)) {
      const wrapped = doc.splitTextToSize(line, colW) as string[];
      doc.text(wrapped, x, y);
      y += wrapped.length * 4.1;
    }
    return y;
  };

  const fromBottom = drawParty("Billed by", data.from, M);
  const toBottom = drawParty("Billed to", data.billTo, M + colW + 6);

  const totals = computeTotals(data);
  const boxX = 140;
  const boxW = RIGHT - boxX;
  const summary: [string, string][] = [["Issue date", formatDate(data.issueDate) || "—"]];
  if (data.showDueDate) summary.push(["Due date", formatDate(data.dueDate) || "—"]);
  const boxH = 24 + summary.length * 7;
  fill(TINT);
  doc.roundedRect(boxX, top - 5, boxW, boxH, 2, 2, "F");
  let sy = top + 1;
  for (const [k, v] of summary) {
    label(k, boxX + 5, sy);
    font("bold", 9);
    color(INK);
    doc.text(v, boxX + boxW - 5, sy, { align: "right" });
    sy += 7;
  }
  stroke([208, 230, 216]);
  doc.line(boxX + 5, sy - 3, boxX + boxW - 5, sy - 3);
  label("Amount due", boxX + 5, sy + 3);
  font("bold", 14);
  color(GREEN);
  doc.text(formatMoney(totals.total, data.currency), boxX + boxW - 5, sy + 12, { align: "right" });

  // ── Items table ───────────────────────────────────────────────────────
  // Qty and Unit price columns appear only when at least one item is countable;
  // otherwise the description takes their width.
  const items = printableItems(data.items);
  const showQty = hasCountableItems(items);
  const cols = {
    index: M + 3,
    desc: M + 12,
    descW: showQty ? 86 : 128,
    qty: 132,
    price: 160,
    amount: RIGHT - 3,
  };

  const drawTableHeader = (y: number): number => {
    fill(INK);
    doc.roundedRect(M, y, RIGHT - M, 9, 1.5, 1.5, "F");
    font("bold", 7.5);
    doc.setTextColor(255, 255, 255);
    doc.setCharSpace(0.3);
    doc.text("#", cols.index, y + 5.8);
    doc.text("DESCRIPTION", cols.desc, y + 5.8);
    if (showQty) {
      doc.text("QTY", cols.qty, y + 5.8, { align: "right" });
      doc.text("UNIT PRICE", cols.price, y + 5.8, { align: "right" });
    }
    doc.text("AMOUNT", cols.amount, y + 5.8, { align: "right" });
    doc.setCharSpace(0);
    return y + 9;
  };

  let y = Math.max(fromBottom, toBottom, top + boxH) + 8;
  y = drawTableHeader(y);

  items.forEach((item, i) => {
    font("normal", 9.2);
    const descLines = doc.splitTextToSize(item.description || "—", cols.descW) as string[];
    const rowH = Math.max(9, descLines.length * 4.3 + 5);

    if (y + rowH > BODY_BOTTOM) {
      doc.addPage();
      y = drawTableHeader(18);
    }

    if (i % 2 === 1) {
      fill(ZEBRA);
      doc.rect(M, y, RIGHT - M, rowH, "F");
    }
    const baseline = y + 5.8;
    font("normal", 8.5);
    color(FAINT);
    doc.text(String(i + 1).padStart(2, "0"), cols.index, baseline);
    font("normal", 9.2);
    color(INK);
    doc.text(descLines, cols.desc, baseline);
    if (showQty) {
      // A flat-price (quantity 0) item shows dashes; its price is in Amount.
      const countable = isCountable(item);
      color(countable ? MUTED : FAINT);
      doc.text(countable ? String(item.quantity) : "—", cols.qty, baseline, { align: "right" });
      doc.text(countable ? formatMoney(item.unitPrice || 0, data.currency) : "—", cols.price, baseline, {
        align: "right",
      });
    }
    font("bold", 9.2);
    color(INK);
    doc.text(formatMoney(lineTotal(item), data.currency), cols.amount, baseline, { align: "right" });

    stroke(LINE);
    doc.line(M, y + rowH, RIGHT, y + rowH);
    y += rowH;
  });

  if (items.length === 0) {
    font("normal", 9);
    color(FAINT);
    doc.text("No items added.", cols.desc, y + 6);
    y += 10;
  }

  // ── Totals (right) + notes (left) ─────────────────────────────────────
  const rows: [string, string][] = [["Subtotal", formatMoney(totals.subtotal, data.currency)]];
  if (data.discountPercent) rows.push([`Discount (${data.discountPercent}%)`, formatMoney(-totals.discount, data.currency)]);
  if (data.taxPercent) rows.push([`Tax (${data.taxPercent}%)`, formatMoney(totals.tax, data.currency)]);

  const notesBlocks: [string, string][] = [];
  if (data.paymentDetails.trim()) notesBlocks.push(["Payment details", data.paymentDetails.trim()]);
  if (data.notes.trim()) notesBlocks.push(["Notes", data.notes.trim()]);

  const notesW = 92;
  font("normal", 8.8);
  const notesHeight = notesBlocks.reduce(
    (h, [, body]) => h + 6 + (doc.splitTextToSize(body, notesW) as string[]).length * 4.1 + 4,
    0,
  );
  const totalsHeight = rows.length * 6.5 + 16;
  if (y + 8 + Math.max(notesHeight, totalsHeight) > BODY_BOTTOM) {
    doc.addPage();
    y = 18;
  } else {
    y += 8;
  }

  const tX = 122;
  let ty = y + 2;
  for (const [k, v] of rows) {
    font("normal", 9.2);
    color(MUTED);
    doc.text(k, tX, ty);
    color(INK);
    doc.text(v, RIGHT - 3, ty, { align: "right" });
    ty += 6.5;
  }
  fill(GREEN);
  doc.roundedRect(tX - 4, ty - 2.5, RIGHT - tX + 4, 12, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  font("bold", 9.5);
  doc.text("Total due", tX, ty + 5);
  font("bold", 12);
  doc.text(formatMoney(totals.total, data.currency), RIGHT - 3, ty + 5.2, { align: "right" });

  let ny = y;
  for (const [title, body] of notesBlocks) {
    label(title, M, ny + 2);
    font("normal", 8.8);
    color(MUTED);
    const lines = doc.splitTextToSize(body, notesW) as string[];
    doc.text(lines, M, ny + 7.5);
    ny += 6 + lines.length * 4.1 + 4;
  }

  // ── Footer on every page ──────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  const contact = [data.from.name, data.from.email].filter(Boolean).join("  ·  ");
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    stroke(LINE);
    doc.line(M, FOOTER_Y - 5, RIGHT, FOOTER_Y - 5);
    font("bold", 8);
    color(INK);
    doc.text("Thank you for your business.", M, FOOTER_Y);
    font("normal", 8);
    color(FAINT);
    if (contact) doc.text(contact, PAGE_W / 2, FOOTER_Y, { align: "center" });
    doc.text(`Page ${p} of ${pages}`, RIGHT, FOOTER_Y, { align: "right" });
  }

  return doc;
}
