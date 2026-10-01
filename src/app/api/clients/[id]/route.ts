import { Client, WorkEntry } from '@/lib/models';
import { HttpError, ok, requireOid, requireUser, route } from '@/lib/api';
import { clientSchema, firstIssue } from '@/lib/schemas';
import { CLIENT_ENCRYPTED_PATHS, decryptDoc, encryptDoc, getUserDek } from '@/lib/serverCrypto';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'client');
  const doc = await Client.findOne({ _id: id, userId }).lean();
  if (!doc) throw new HttpError(404, 'Client not found.');
  const dek = await getUserDek(userId);
  return ok(await decryptDoc(dek, doc as Record<string, unknown>, CLIENT_ENCRYPTED_PATHS));
});

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'client');
  const parsed = clientSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));

  const dek = await getUserDek(userId);
  const encrypted = await encryptDoc(dek, parsed.data, CLIENT_ENCRYPTED_PATHS);
  const updated = await Client.findOneAndUpdate({ _id: id, userId }, { $set: encrypted }, { new: true });
  if (!updated) throw new HttpError(404, 'Client not found.');
  return ok({ ...parsed.data, _id: String(updated._id) });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'client');
  // Hours still waiting to be billed would be left without anyone to bill.
  if (await WorkEntry.exists({ userId, clientId: id, billed: false })) {
    throw new HttpError(409, 'This client still has unbilled hours. Bill or delete them first.');
  }

  const result = await Client.deleteOne({ _id: id, userId });
  if (result.deletedCount === 0) throw new HttpError(404, 'Client not found.');
  // Billed hours only ever lived on as a record of what an invoice covered;
  // the invoices keep their own copy of the client's details.
  await WorkEntry.deleteMany({ userId, clientId: id, billed: true });
  return ok({ deleted: true });
});
