import { WorkEntry } from '@/lib/models';
import { HttpError, ok, requireOid, requireUser, route } from '@/lib/api';
import { resolveWorkEntryFields } from '@/lib/entries';
import { firstIssue, workEntrySchema } from '@/lib/schemas';
import { WORK_ENTRY_ENCRYPTED_PATHS, encryptDoc, getUserDek } from '@/lib/serverCrypto';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'entry');
  const parsed = workEntrySchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));

  const existing = await WorkEntry.findOne({ _id: id, userId }).select({ billed: 1 }).lean();
  if (!existing) throw new HttpError(404, 'Entry not found.');
  if (existing.billed) throw new HttpError(409, 'This entry is already billed and can no longer be edited.');

  const fields = await resolveWorkEntryFields(userId, parsed.data);
  const dek = await getUserDek(userId);
  const encrypted = await encryptDoc(dek, fields, WORK_ENTRY_ENCRYPTED_PATHS);
  const updated = await WorkEntry.findOneAndUpdate(
    { _id: id, userId, billed: false },
    { $set: encrypted },
    { new: true },
  );
  if (!updated) throw new HttpError(409, 'This entry is already billed and can no longer be edited.');
  return ok({ ...fields, _id: String(updated._id), billed: false, invoiceId: null });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'entry');

  const result = await WorkEntry.deleteOne({ _id: id, userId, billed: false });
  if (result.deletedCount === 0) {
    const stillThere = await WorkEntry.exists({ _id: id, userId });
    if (stillThere) throw new HttpError(409, 'This entry is already billed and can no longer be deleted.');
    throw new HttpError(404, 'Entry not found.');
  }
  return ok({ deleted: true });
});
