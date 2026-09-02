import type { Types } from 'mongoose';
import { HttpError } from './api';
import { FileAsset, Invoice, Preset, type InvoiceDoc } from './models';
import {
  INVOICE_ENCRYPTED_PATHS,
  decryptDoc,
  encryptDoc,
  getUserDek,
} from './serverCrypto';
import { deriveReference, isSwissIban, normalizeIban } from './qrbill';
import { computeTotals } from './totals';
import { renderInvoicePdf } from './pdf';
import type { z } from 'zod';
import type { invoiceSchema } from './schemas';

export { fillTemplate } from './template';

type InvoiceInput = z.infer<typeof invoiceSchema>;

/**
 * Turns a validated payload plus the referenced preset into the document that
 * gets stored. Creditor details are copied rather than referenced so that
 * editing a preset later never rewrites history on issued invoices.
 */
export async function buildInvoiceDoc(
  userId: Types.ObjectId,
  input: InvoiceInput,
  existing?: Record<string, unknown>,
) {
  const preset = await Preset.findOne({ _id: input.presetId, userId }).lean();
  if (!preset) throw new HttpError(404, 'That preset no longer exists.');

  const iban = normalizeIban(preset.iban);
  if (!isSwissIban(iban)) {
    throw new HttpError(400, 'The preset holds an IBAN that is not a valid Swiss or Liechtenstein account.');
  }

  const referenceType = input.referenceType ?? preset.referenceType;
  const number = input.number?.trim() || (await nextInvoiceNumber(userId, preset._id));

  // QRR references are numeric, so the invoice number's digits are the natural
  // seed when the user hasn't supplied their own key.
  const seed = input.referenceKey?.trim() || number.replace(/\D/g, '') || String(Date.now());
  const { reference, error } = deriveReference(referenceType, iban, seed);
  if (error) throw new HttpError(400, error);

  const totals = computeTotals(input.groups, {
    vatIncluded: input.vatIncluded,
    discountPercent: input.discountPercent,
    roundTo5Cents: input.roundTo5Cents,
  });

  if (input.dueDate < input.issueDate) {
    throw new HttpError(400, 'The due date cannot be before the invoice date.');
  }

  return {
    userId,
    presetId: preset._id,
    clientId: input.clientId || null,
    number,
    status: input.status ?? (existing?.status as string) ?? 'draft',
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    creditor: preset.creditor,
    debtor: input.debtor,
    iban,
    vatNumber: preset.vatNumber ?? '',
    logoFileId: preset.logoFileId ?? null,
    footerNote: preset.footerNote ?? '',
    referenceType,
    reference,
    currency: input.currency ?? preset.currency,
    qrLanguage: input.qrLanguage ?? preset.qrLanguage,
    groups: input.groups,
    vatIncluded: input.vatIncluded,
    discountPercent: input.discountPercent,
    roundTo5Cents: input.roundTo5Cents,
    message: input.message,
    notes: input.notes,
    totals: { net: totals.net, vatTotal: totals.vatTotal, total: totals.total },
  };
}

/**
 * Reserves the next number on the preset. `findOneAndUpdate` with `$inc` is
 * atomic, so two invoices created at the same moment can't claim the same one.
 */
async function nextInvoiceNumber(userId: Types.ObjectId, presetId: unknown): Promise<string> {
  const preset = await Preset.findOneAndUpdate(
    { _id: presetId, userId },
    { $inc: { nextNumber: 1 } },
    { new: false },
  ).lean();
  if (!preset) throw new HttpError(404, 'That preset no longer exists.');
  const seq = String(preset.nextNumber ?? 1).padStart(4, '0');
  return `${preset.invoicePrefix ?? ''}${seq}`;
}

export async function encryptInvoice(userId: Types.ObjectId, doc: Record<string, unknown>) {
  const dek = await getUserDek(userId);
  return encryptDoc(dek, doc, INVOICE_ENCRYPTED_PATHS);
}

export async function decryptInvoices(userId: Types.ObjectId, docs: Record<string, unknown>[]) {
  if (docs.length === 0) return [];
  const dek = await getUserDek(userId);
  return Promise.all(docs.map((doc) => decryptDoc(dek, doc, INVOICE_ENCRYPTED_PATHS)));
}

/** Loads one invoice, decrypted, or throws. Ownership is part of the query. */
export async function loadInvoice(
  userId: Types.ObjectId,
  invoiceId: Types.ObjectId,
): Promise<InvoiceDoc> {
  const doc = await Invoice.findOne({ _id: invoiceId, userId }).lean();
  if (!doc) throw new HttpError(404, 'Invoice not found.');
  const [decrypted] = await decryptInvoices(userId, [doc as Record<string, unknown>]);
  return decrypted as unknown as InvoiceDoc;
}

/** Rebuilds the PDF from the stored record. Nothing is cached or persisted. */
export async function renderInvoice(userId: Types.ObjectId, invoiceId: Types.ObjectId) {
  const invoice = await loadInvoice(userId, invoiceId);

  let logo: { mime: string; data: string } | null = null;
  if (invoice.logoFileId) {
    const file = await FileAsset.findOne({ _id: invoice.logoFileId, userId })
      .select({ mime: 1, data: 1 })
      .lean();
    if (file) logo = { mime: file.mime, data: file.data };
  }

  const pdf = await renderInvoicePdf(invoice, logo);
  return { pdf, invoice };
}
