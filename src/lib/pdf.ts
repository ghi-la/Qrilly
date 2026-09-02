import PDFDocument from 'pdfkit';
import { SwissQRBill } from 'swissqrbill/pdf';
import type { Data as QrBillData } from 'swissqrbill/types';
import { formatIban, formatReference, type QrLanguage, type ReferenceType } from './qrbill';
import { computeTotals, type InvoiceGroup } from './totals';
import { labelsFor } from './pdfLabels';

/**
 * Renders an invoice to a PDF on demand. Nothing here is persisted: the
 * database holds the invoice as structured data and this module is the only
 * thing that turns it into a document, so a download years from now is
 * regenerated from the same record rather than served from a stale blob.
 *
 * The QR slip itself is drawn by `swissqrbill`, which also validates the
 * payment data against the standard and throws if it doesn't comply.
 */

export interface RenderableInvoice {
  number: string;
  issueDate: Date | string;
  dueDate: Date | string;
  currency: 'CHF' | 'EUR';
  qrLanguage: QrLanguage;
  referenceType: ReferenceType;
  reference: string;
  iban: string;
  vatNumber?: string;
  footerNote?: string;
  message?: string;
  notes?: string;
  vatIncluded?: boolean;
  discountPercent?: number;
  roundTo5Cents?: boolean;
  creditor: Party;
  debtor: Party;
  groups: InvoiceGroup[];
}

interface Party {
  name: string;
  email?: string;
  address: {
    street?: string;
    buildingNumber?: string;
    zip?: string;
    city?: string;
    country?: string;
  };
}

export interface LogoInput {
  mime: string;
  data: string; // base64
}

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 50;
const RIGHT = PAGE.width - MARGIN;
const CONTENT_WIDTH = RIGHT - MARGIN;

// Column edges for the line-item table.
const COL = {
  description: { x: MARGIN, width: 210 },
  quantity: { x: MARGIN + 215, width: 45 },
  unit: { x: MARGIN + 265, width: 45 },
  unitPrice: { x: MARGIN + 310, width: 70 },
  vat: { x: MARGIN + 382, width: 38 },
  amount: { x: MARGIN + 422, width: 73 },
};

const money = (value: number, currency: string) =>
  new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ` ${currency}`;

const plain = (value: number) =>
  new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value,
  );

const quantity = (value: number) =>
  new Intl.NumberFormat('de-CH', { maximumFractionDigits: 3 }).format(value);

const date = (value: Date | string) =>
  new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(value),
  );

export async function renderInvoicePdf(
  invoice: RenderableInvoice,
  logo?: LogoInput | null,
): Promise<Buffer> {
  const t = labelsFor(invoice.qrLanguage);
  const totals = computeTotals(invoice.groups ?? [], {
    vatIncluded: invoice.vatIncluded,
    discountPercent: invoice.discountPercent,
    roundTo5Cents: invoice.roundTo5Cents,
  });

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    autoFirstPage: false,
    info: { Title: `${t.invoice} ${invoice.number}`, Author: invoice.creditor.name },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.addPage();

  // The payment part owns the bottom 105 mm of the page it lands on, so every
  // page keeps that strip clear. `attachTo` then drops the slip under the
  // content of the last page instead of pushing it onto one of its own.
  const bottomLimit = PAGE.height - SwissQRBill.height - 6;
  let y = MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed <= bottomLimit) return;
    doc.addPage();
    y = MARGIN;
  };

  /* ------------------------------------------------------------- header */

  let headerBottom = y;

  if (logo) {
    try {
      doc.image(Buffer.from(logo.data, 'base64'), MARGIN, y, { fit: [150, 55] });
      headerBottom = y + 62;
    } catch {
      // A corrupt or unsupported image must not take the whole invoice down.
    }
  }

  const senderTop = logo ? headerBottom : y;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111');
  doc.text(invoice.creditor.name, MARGIN, senderTop, { width: 240 });
  doc.font('Helvetica').fontSize(9).fillColor('#444444');
  doc.text(addressLines(invoice.creditor).join('\n'), MARGIN, doc.y + 2, { width: 240 });
  if (invoice.creditor.email) doc.text(invoice.creditor.email, { width: 240 });
  if (invoice.vatNumber) doc.text(`${t.vatNumber} ${invoice.vatNumber}`, { width: 240 });
  const senderBottom = doc.y;

  // Invoice meta, right column.
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#111111');
  doc.text(t.invoice, RIGHT - 220, y, { width: 220, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#444444');
  const metaRows: [string, string][] = [
    [t.invoiceNo, invoice.number],
    [t.issueDate, date(invoice.issueDate)],
    [t.dueDate, date(invoice.dueDate)],
  ];
  if (invoice.reference) {
    metaRows.push([t.reference, formatReference(invoice.reference, invoice.referenceType)]);
  }
  let metaY = doc.y + 6;
  for (const [label, value] of metaRows) {
    doc.font('Helvetica').fillColor('#777777');
    doc.text(label, RIGHT - 260, metaY, { width: 110, align: 'right' });
    doc.font('Helvetica-Bold').fillColor('#111111');
    doc.text(value, RIGHT - 145, metaY, { width: 145, align: 'right' });
    metaY = doc.y + 3;
  }

  y = Math.max(senderBottom, metaY) + 20;

  /* ------------------------------------------------------------- debtor */

  ensureSpace(90);
  doc.font('Helvetica').fontSize(8).fillColor('#888888');
  doc.text(t.billedTo.toUpperCase(), MARGIN, y, { characterSpacing: 1 });
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111');
  doc.text(invoice.debtor.name, MARGIN, doc.y + 4, { width: 260 });
  doc.font('Helvetica').fontSize(10).fillColor('#333333');
  doc.text(addressLines(invoice.debtor).join('\n'), MARGIN, doc.y + 2, { width: 260 });
  y = doc.y + 16;

  if (invoice.message) {
    ensureSpace(40);
    doc.font('Helvetica').fontSize(10).fillColor('#333333');
    doc.text(invoice.message, MARGIN, y, { width: CONTENT_WIDTH });
    y = doc.y + 12;
  }

  /* -------------------------------------------------------------- table */

  const drawTableHeader = () => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#666666');
    doc.text(t.description.toUpperCase(), COL.description.x, y, { width: COL.description.width });
    doc.text(t.quantity.toUpperCase(), COL.quantity.x, y, {
      width: COL.quantity.width,
      align: 'right',
    });
    doc.text(t.unit.toUpperCase(), COL.unit.x, y, { width: COL.unit.width });
    doc.text(t.unitPrice.toUpperCase(), COL.unitPrice.x, y, {
      width: COL.unitPrice.width,
      align: 'right',
    });
    doc.text(t.vat.toUpperCase(), COL.vat.x, y, { width: COL.vat.width, align: 'right' });
    doc.text(t.amount.toUpperCase(), COL.amount.x, y, { width: COL.amount.width, align: 'right' });
    y += 14;
    doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.75).strokeColor('#111111').stroke();
    y += 8;
  };

  ensureSpace(60);
  drawTableHeader();

  const multipleGroups = (invoice.groups ?? []).length > 1;

  invoice.groups.forEach((group, groupIndex) => {
    if (groupIndex > 0) y += 14;

    if (group.title && group.showTitle !== false) {
      ensureSpace(30);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#B0293A');
      doc.text(group.title, COL.description.x, y, { width: CONTENT_WIDTH });
      y = doc.y + 8;
    }

    for (const item of group.items ?? []) {
      const rate = Number(item.vatRate) || 0;
      const raw = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      const lineNet = invoice.vatIncluded ? raw / (1 + rate / 100) : raw;

      doc.font('Helvetica').fontSize(9.5).fillColor('#222222');
      const height = Math.max(
        doc.heightOfString(item.description || '-', { width: COL.description.width }),
        12,
      );
      ensureSpace(height + 10);

      doc.text(item.description || '-', COL.description.x, y, { width: COL.description.width });
      doc.text(quantity(Number(item.quantity) || 0), COL.quantity.x, y, {
        width: COL.quantity.width,
        align: 'right',
      });
      doc.text(item.unit ?? '', COL.unit.x, y, { width: COL.unit.width });
      doc.text(plain(Number(item.unitPrice) || 0), COL.unitPrice.x, y, {
        width: COL.unitPrice.width,
        align: 'right',
      });
      doc.text(rate ? `${plain(rate)}%` : '-', COL.vat.x, y, {
        width: COL.vat.width,
        align: 'right',
      });
      doc.text(plain(round2(lineNet)), COL.amount.x, y, {
        width: COL.amount.width,
        align: 'right',
      });

      y += height + 6;
    }
  });

  /* ------------------------------------------------------------- totals */

  // Group subtotals are gathered here as one summary block right above the
  // grand total, rather than repeated after each group, so the reader sees
  // what the total is made of in one place.
  ensureSpace(110 + (multipleGroups ? totals.groups.length * 14 : 0));
  doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.75).strokeColor('#111111').stroke();
  y += 8;

  const totalRow = (label: string, value: string, bold = false, size = 9.5) => {
    // The grand total carries a currency suffix, so it gets a wider box than
    // the bare numbers above it and doesn't wrap onto a second line.
    const valueWidth = bold ? 150 : COL.amount.width;
    const valueX = RIGHT - valueWidth;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
    doc.fillColor(bold ? '#111111' : '#444444');
    doc.text(label, COL.unitPrice.x - 130, y, { width: valueX - (COL.unitPrice.x - 130) - 10, align: 'right' });
    doc.text(value, valueX, y, { width: valueWidth, align: 'right' });
    y += size + 4;
  };

  if (multipleGroups) {
    for (const group of totals.groups) {
      const label =
        group.title && group.showTitle ? `${t.groupSubtotal} - ${group.title}` : t.groupSubtotal;
      totalRow(label, plain(group.net));
    }
    y += 2;
    doc.moveTo(COL.unitPrice.x - 120, y).lineTo(RIGHT, y).lineWidth(0.4).strokeColor('#CCCCCC').stroke();
    y += 8;
  }

  const hasAdjustments =
    totals.discount > 0 || totals.vatByRate.length > 0 || totals.roundingAdjustment !== 0;

  if (hasAdjustments) totalRow(t.subtotal, plain(totals.net));
  if (totals.discount > 0) {
    totalRow(`${t.discount} ${plain(invoice.discountPercent ?? 0)}%`, `- ${plain(totals.discount)}`);
    totalRow(t.net, plain(totals.netAfterDiscount));
  }
  for (const vat of totals.vatByRate) {
    totalRow(`${t.vatTotal} ${plain(vat.rate)}% (${plain(vat.base)})`, plain(vat.amount));
  }
  if (totals.roundingAdjustment !== 0) {
    totalRow(t.rounding, plain(totals.roundingAdjustment));
  }

  y += 2;
  doc.moveTo(COL.unitPrice.x - 120, y).lineTo(RIGHT, y).lineWidth(0.5).strokeColor('#111111').stroke();
  y += 8;
  totalRow(t.total, money(totals.total, invoice.currency), true, 12);
  y += 6;

  /* ------------------------------------------------- payment details + notes */

  // The closing block is measured and placed as a unit: splitting an account
  // line from its notes across a page break reads worse than moving all three
  // down together.
  doc.font('Helvetica').fontSize(8.5);
  const notesHeight = invoice.notes
    ? 20 + doc.heightOfString(invoice.notes, { width: CONTENT_WIDTH })
    : 0;
  doc.fontSize(8);
  const footerHeight = invoice.footerNote
    ? 10 + doc.heightOfString(invoice.footerNote, { width: CONTENT_WIDTH })
    : 0;
  ensureSpace(14 + notesHeight + footerHeight);

  doc.font('Helvetica').fontSize(8.5).fillColor('#666666');
  doc.text(`${t.account}: ${formatIban(invoice.iban)}`, MARGIN, y, { width: 300 });
  y = doc.y + 2;

  if (invoice.notes) {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#666666');
    doc.text(t.notes, MARGIN, y + 8, { width: CONTENT_WIDTH });
    doc.font('Helvetica').fillColor('#555555');
    doc.text(invoice.notes, MARGIN, doc.y + 2, { width: CONTENT_WIDTH });
    y = doc.y;
  }

  if (invoice.footerNote) {
    doc.font('Helvetica').fontSize(8).fillColor('#888888');
    doc.text(invoice.footerNote, MARGIN, y + 10, { width: CONTENT_WIDTH });
    y = doc.y;
  }

  /* ------------------------------------------------------------ QR bill */

  // The slip is drawn on the last page created above, at a fixed offset from
  // that page's bottom edge - if the closing block above pushed past the
  // reserved strip, it needs a fresh page of its own rather than overlapping.
  if (y > bottomLimit) doc.addPage();

  // swissqrbill never sets its own fill colour: it inherits whatever `doc`
  // was left with, which by this point is the muted grey of the footer note.
  // Reset to black so the payment part prints in the standard's colour.
  doc.fillColor('#000000');

  const qrBill = new SwissQRBill(buildQrData(invoice, totals.total), {
    language: invoice.qrLanguage,
    fontName: 'Helvetica',
  });
  qrBill.attachTo(doc);

  doc.end();
  return finished;
}

function buildQrData(invoice: RenderableInvoice, amount: number): QrBillData {
  const data: QrBillData = {
    amount: amount > 0 ? amount : undefined,
    creditor: {
      account: invoice.iban.replace(/\s/g, ''),
      address: invoice.creditor.address.street ?? '',
      buildingNumber: invoice.creditor.address.buildingNumber ?? '',
      city: invoice.creditor.address.city ?? '',
      country: invoice.creditor.address.country || 'CH',
      name: invoice.creditor.name,
      zip: invoice.creditor.address.zip ?? '',
    },
    currency: invoice.currency,
    debtor: {
      address: invoice.debtor.address.street ?? '',
      buildingNumber: invoice.debtor.address.buildingNumber ?? '',
      city: invoice.debtor.address.city ?? '',
      country: invoice.debtor.address.country || 'CH',
      name: invoice.debtor.name,
      zip: invoice.debtor.address.zip ?? '',
    },
  };

  if (invoice.referenceType !== 'NON' && invoice.reference) {
    data.reference = invoice.reference;
  }
  // The slip's message field doubles as the human-readable payment purpose;
  // without a structured reference it is often the only thing tying the
  // payment back to an invoice, so the number goes in as a fallback.
  const message = invoice.message?.trim() || `${invoice.number}`;
  data.message = message.slice(0, 140);

  return data;
}

function addressLines(party: Party): string[] {
  const street = [party.address.street, party.address.buildingNumber].filter(Boolean).join(' ');
  const city = [party.address.zip, party.address.city].filter(Boolean).join(' ');
  return [street, city].filter(Boolean);
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
