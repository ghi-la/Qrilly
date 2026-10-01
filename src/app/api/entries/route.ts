import { Invoice, WorkEntry } from '@/lib/models';
import { HttpError, ok, requireOids, requireUser, route } from '@/lib/api';
import { purgeExpiredInvoices } from '@/lib/invoices';
import { resolveWorkEntryFields } from '@/lib/entries';
import { firstIssue, workEntrySchema } from '@/lib/schemas';
import { WORK_ENTRY_ENCRYPTED_PATHS, decryptDoc, encryptDoc, getUserDek } from '@/lib/serverCrypto';

export const runtime = 'nodejs';

export const GET = route(async (req: Request) => {
  const userId = await requireUser();
  const url = new URL(req.url);
  const idsParam = url.searchParams.get('ids');

  const query: Record<string, unknown> = { userId };
  if (idsParam) {
    const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
    query._id = { $in: requireOids(ids, 'entry') };
  }

  // Hours billed on an invoice that is in the trash stay out of sight until
  // it is restored (or purged, which removes them).
  await purgeExpiredInvoices(userId);
  const trashed = await Invoice.distinct('_id', { userId, deletedAt: { $ne: null } });
  if (trashed.length > 0) query.invoiceId = { $nin: trashed };

  const docs = await WorkEntry.find(query).sort({ entryDate: -1, createdAt: -1 }).lean();
  const dek = await getUserDek(userId);
  const entries = await Promise.all(
    docs.map((doc) => decryptDoc(dek, doc as Record<string, unknown>, WORK_ENTRY_ENCRYPTED_PATHS)),
  );
  return ok(entries);
});

export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const parsed = workEntrySchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));

  const fields = await resolveWorkEntryFields(userId, parsed.data);
  const dek = await getUserDek(userId);
  const encrypted = await encryptDoc(dek, fields, WORK_ENTRY_ENCRYPTED_PATHS);
  const entry = await WorkEntry.create({ ...encrypted, userId, billed: false, invoiceId: null });
  return ok({ ...fields, _id: String(entry._id), billed: false, invoiceId: null }, 201);
});
