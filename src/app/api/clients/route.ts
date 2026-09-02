import { Client } from '@/lib/models';
import { HttpError, ok, requireUser, route } from '@/lib/api';
import { clientSchema, firstIssue } from '@/lib/schemas';
import { CLIENT_ENCRYPTED_PATHS, decryptDoc, encryptDoc, getUserDek } from '@/lib/serverCrypto';

export const runtime = 'nodejs';

export const GET = route(async () => {
  const userId = await requireUser();
  const docs = await Client.find({ userId }).sort({ updatedAt: -1 }).lean();
  const dek = await getUserDek(userId);
  const clients = await Promise.all(
    docs.map((doc) => decryptDoc(dek, doc as Record<string, unknown>, CLIENT_ENCRYPTED_PATHS)),
  );
  // Names only become sortable once they're back in plaintext.
  clients.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
  return ok(clients);
});

export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const parsed = clientSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));

  const dek = await getUserDek(userId);
  const encrypted = await encryptDoc(dek, parsed.data, CLIENT_ENCRYPTED_PATHS);
  const client = await Client.create({ ...encrypted, userId });
  return ok({ ...parsed.data, _id: String(client._id) }, 201);
});
