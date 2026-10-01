import { Invoice, WorkEntry } from '@/lib/models';
import { HttpError, ok, requireOids, requireUser, route } from '@/lib/api';
import { firstIssue, invoiceSchema } from '@/lib/schemas';
import { buildInvoiceDoc, decryptInvoices, encryptInvoice, purgeExpiredInvoices } from '@/lib/invoices';

export const runtime = 'nodejs';

export const GET = route(async (req: Request) => {
  const userId = await requireUser();
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const search = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 500);

  await purgeExpiredInvoices(userId);

  // "trash" is its own view; every other listing leaves deleted invoices out.
  const query: Record<string, unknown> = { userId, deletedAt: status === 'trash' ? { $ne: null } : null };
  if (status && status !== 'all' && status !== 'trash') query.status = status;

  if (url.searchParams.get('countOnly') === '1') {
    return ok({ count: await Invoice.countDocuments(query) });
  }

  const docs = await Invoice.find(query).sort({ issueDate: -1, createdAt: -1 }).limit(limit).lean();
  const invoices = await decryptInvoices(userId, docs as Record<string, unknown>[]);

  // Debtor names are ciphertext at rest, so the text search runs after
  // decryption rather than as a Mongo query.
  const filtered = search
    ? invoices.filter((inv) => {
        const debtor = (inv.debtor as { name?: string } | undefined)?.name ?? '';
        return (
          String(inv.number ?? '').toLowerCase().includes(search) ||
          debtor.toLowerCase().includes(search)
        );
      })
    : invoices;

  // How many hours each invoice billed, so deleting one can offer the choice.
  const counts = await WorkEntry.aggregate([
    { $match: { userId, billed: true, invoiceId: { $in: filtered.map((i) => i._id) } } },
    { $group: { _id: '$invoiceId', count: { $sum: 1 } } },
  ]);
  const countById = new Map(counts.map((c) => [String(c._id), c.count as number]));

  return ok(filtered.map((inv) => ({ ...inv, entryCount: countById.get(String(inv._id)) ?? 0 })));
});

export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const parsed = invoiceSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));

  // Checked before anything is created, so a bad selection never burns an
  // invoice number or leaves a half-made invoice behind.
  const sourceIds = [...new Set(parsed.data.sourceEntryIds ?? [])];
  const entryIds = requireOids(sourceIds, 'entry');
  if (entryIds.length > 0) {
    const sources = await WorkEntry.find({ _id: { $in: entryIds }, userId, billed: false })
      .select({ presetId: 1, clientId: 1 })
      .lean();
    if (sources.length !== entryIds.length) {
      throw new HttpError(409, 'Some of the selected hours are already billed or no longer exist.');
    }
    const [first] = sources;
    const sameBatch = sources.every(
      (e) => String(e.presetId) === String(first.presetId) && String(e.clientId) === String(first.clientId),
    );
    if (!sameBatch || String(first.presetId) !== parsed.data.presetId) {
      throw new HttpError(400, 'Hours from different clients or presets cannot be billed on one invoice.');
    }
  }

  const doc = await buildInvoiceDoc(userId, { ...parsed.data, status: undefined });
  const encrypted = await encryptInvoice(userId, doc);
  const created = await Invoice.create(encrypted);

  // `billed: false` in the filter keeps two concurrent requests from both
  // claiming the same entry; if this one lost the race, the invoice is undone.
  if (entryIds.length > 0) {
    const claimed = await WorkEntry.updateMany(
      { _id: { $in: entryIds }, userId, billed: false },
      { $set: { billed: true, invoiceId: created._id } },
    );
    if (claimed.modifiedCount !== entryIds.length) {
      await WorkEntry.updateMany(
        { userId, invoiceId: created._id },
        { $set: { billed: false, invoiceId: null } },
      );
      await Invoice.deleteOne({ _id: created._id, userId });
      throw new HttpError(409, 'Some of the selected hours were billed by another request.');
    }
  }

  return ok({ ...doc, _id: String(created._id) }, 201);
});
