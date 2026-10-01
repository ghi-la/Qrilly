import { z } from 'zod';
import { Invoice, Preset, WorkEntry } from '@/lib/models';
import { HttpError, ok, requireOid, requireUser, route } from '@/lib/api';
import { firstIssue, invoiceSchema, statusSchema } from '@/lib/schemas';
import { buildInvoiceDoc, decryptInvoices, deleteInvoicesForever, encryptInvoice, loadInvoice } from '@/lib/invoices';
import { emailEnabled, sendInvoiceDeletedEmail } from '@/lib/email';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'invoice');
  return ok(await loadInvoice(userId, id));
});

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'invoice');
  const body = await req.json();

  // A status-only body is the "mark as paid" button rather than an edit, and
  // must not be run through the full-document path.
  if (Object.keys(body).length === 1 && 'status' in body) {
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));
    const current = await Invoice.findOne({ _id: id, userId, deletedAt: null }).select({ status: 1 }).lean();
    if (!current) throw new HttpError(404, 'Invoice not found.');

    // Issued invoices only move forward: draft -> sent -> paid, and anything
    // not yet paid can be canceled. Nothing goes back to draft.
    const allowed: Record<string, string[]> = {
      draft: ['sent', 'paid', 'canceled'],
      sent: ['paid', 'canceled'],
      paid: [],
      canceled: [],
    };
    if (!allowed[current.status]?.includes(parsed.data.status)) {
      throw new HttpError(409, `An invoice that is ${current.status} cannot be set to ${parsed.data.status}.`);
    }

    const update: Record<string, unknown> = { status: parsed.data.status };
    if (parsed.data.status === 'paid') update.paidAt = new Date();
    // Matching on the status read above keeps two concurrent changes from both winning.
    const updated = await Invoice.findOneAndUpdate({ _id: id, userId, status: current.status }, { $set: update });
    if (!updated) throw new HttpError(409, 'The invoice was changed by another request. Reload and try again.');
    return ok({ status: parsed.data.status });
  }

  const existing = await Invoice.findOne({ _id: id, userId, deletedAt: null }).lean();
  if (!existing) throw new HttpError(404, 'Invoice not found.');
  if (existing.status !== 'draft') {
    throw new HttpError(409, 'Only drafts can be edited. Cancel this invoice and issue a new one instead.');
  }

  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));

  // Keep the number that was already issued unless the form explicitly
  // changed it - re-deriving it here would burn another sequence value.
  const doc = await buildInvoiceDoc(
    userId,
    { ...parsed.data, status: undefined, number: parsed.data.number || String(existing.number) },
    // The status only ever changes through the status-only branch above.
    existing as Record<string, unknown>,
  );
  const encrypted = await encryptInvoice(userId, doc);
  await Invoice.updateOne({ _id: id, userId }, { $set: encrypted });

  return ok({ ...doc, _id: String(id) });
});

const deleteSchema = z.object({
  /** Tell the client the invoice was withdrawn (only meaningful once it was sent). */
  notifyClient: z.boolean().default(false),
  /** What happens to the hours the invoice billed. */
  hours: z.enum(['delete', 'unbill']).default('delete'),
});

/**
 * Without `?permanent=1` this moves the invoice to the trash, where it can be
 * restored for TRASH_DAYS days. With it, an invoice that is already in the
 * trash is removed for good, together with the hours it billed.
 */
export const DELETE = route(async (req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'invoice');

  if (new URL(req.url).searchParams.get('permanent') === '1') {
    if (!(await Invoice.exists({ _id: id, userId, deletedAt: { $ne: null } }))) {
      throw new HttpError(404, 'Invoice not found in the trash.');
    }
    await deleteInvoicesForever(userId, [id]);
    return ok({ deleted: true });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = deleteSchema.safeParse(body ?? {});
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));

  const existing = await Invoice.findOne({ _id: id, userId, deletedAt: null }).lean();
  if (!existing) throw new HttpError(404, 'Invoice not found.');
  if (existing.status === 'paid') {
    throw new HttpError(409, 'A paid invoice cannot be deleted - it is part of your accounts.');
  }

  const claimed = await Invoice.updateOne({ _id: id, userId, deletedAt: null }, { $set: { deletedAt: new Date() } });
  if (claimed.modifiedCount === 0) throw new HttpError(409, 'The invoice was changed by another request.');

  if (parsed.data.hours === 'unbill') {
    const billed = await WorkEntry.find({ userId, billed: true, invoiceId: id }).select({ _id: 1 }).lean();
    if (billed.length > 0) {
      await Invoice.updateOne({ _id: id, userId }, { $set: { releasedEntryIds: billed.map((e) => e._id) } });
      await WorkEntry.updateMany(
        { _id: { $in: billed.map((e) => e._id) }, userId },
        { $set: { billed: false, invoiceId: null } },
      );
    }
  }

  // Best effort: the invoice is already in the trash, so a mail problem is
  // reported rather than turned into a failed delete.
  let notified: boolean | null = null;
  let notifyError: string | undefined;
  if (parsed.data.notifyClient && existing.status === 'sent') {
    try {
      const [invoice] = await decryptInvoices(userId, [existing as Record<string, unknown>]);
      const to = (invoice.debtor as { email?: string } | undefined)?.email;
      if (!to) throw new Error('This invoice has no client email address.');
      if (!emailEnabled()) throw new Error('Email sending is not configured.');
      const preset = await Preset.findOne({ _id: existing.presetId, userId }).lean();
      await sendInvoiceDeletedEmail({
        to,
        replyTo: preset?.creditor?.email || undefined,
        language: String(existing.qrLanguage ?? 'EN'),
        number: String(existing.number),
        creditor: existing.creditor?.name ?? '',
      });
      notified = true;
    } catch (err) {
      notified = false;
      notifyError = err instanceof Error ? err.message : 'The notice could not be sent.';
    }
  }

  return ok({ deleted: true, notified, notifyError });
});
