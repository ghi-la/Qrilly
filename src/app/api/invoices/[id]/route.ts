import { Invoice } from '@/lib/models';
import { HttpError, ok, requireOid, requireUser, route } from '@/lib/api';
import { firstIssue, invoiceSchema, statusSchema } from '@/lib/schemas';
import { buildInvoiceDoc, encryptInvoice, loadInvoice } from '@/lib/invoices';

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
    const update: Record<string, unknown> = { status: parsed.data.status };
    if (parsed.data.status === 'paid') update.paidAt = new Date();
    const updated = await Invoice.findOneAndUpdate({ _id: id, userId }, { $set: update });
    if (!updated) throw new HttpError(404, 'Invoice not found.');
    return ok({ status: parsed.data.status });
  }

  const existing = await Invoice.findOne({ _id: id, userId }).lean();
  if (!existing) throw new HttpError(404, 'Invoice not found.');

  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));

  // Keep the number that was already issued unless the form explicitly
  // changed it - re-deriving it here would burn another sequence value.
  const doc = await buildInvoiceDoc(
    userId,
    { ...parsed.data, number: parsed.data.number || String(existing.number) },
    existing as Record<string, unknown>,
  );
  const encrypted = await encryptInvoice(userId, doc);
  await Invoice.updateOne({ _id: id, userId }, { $set: encrypted });

  return ok({ ...doc, _id: String(id) });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'invoice');
  const result = await Invoice.deleteOne({ _id: id, userId });
  if (result.deletedCount === 0) throw new HttpError(404, 'Invoice not found.');
  return ok({ deleted: true });
});
