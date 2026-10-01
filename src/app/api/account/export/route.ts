import { Client, FileAsset, Invoice, Preset, User, WorkEntry } from '@/lib/models';
import { HttpError, requireUser, route } from '@/lib/api';
import {
  CLIENT_ENCRYPTED_PATHS,
  INVOICE_ENCRYPTED_PATHS,
  WORK_ENTRY_ENCRYPTED_PATHS,
  decryptDoc,
  getUserDek,
} from '@/lib/serverCrypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Everything stored about the signed-in user, decrypted, as one JSON file. */
export const GET = route(async () => {
  const userId = await requireUser();
  const user = await User.findById(userId).select({ name: 1, email: 1, language: 1, createdAt: 1 }).lean();
  if (!user) throw new HttpError(404, 'User not found.');

  const dek = await getUserDek(userId);
  const decryptAll = (docs: unknown[], paths: string[]) =>
    Promise.all(docs.map((doc) => decryptDoc(dek, doc as Record<string, unknown>, paths)));

  const [presets, clients, invoices, entries, files] = await Promise.all([
    Preset.find({ userId }).lean(),
    Client.find({ userId }).lean(),
    Invoice.find({ userId }).sort({ issueDate: 1 }).lean(),
    WorkEntry.find({ userId }).sort({ entryDate: 1 }).lean(),
    FileAsset.find({ userId }).lean(),
  ]);

  const body = {
    exportedAt: new Date().toISOString(),
    account: user,
    presets,
    clients: await decryptAll(clients, CLIENT_ENCRYPTED_PATHS),
    invoices: await decryptAll(invoices, INVOICE_ENCRYPTED_PATHS),
    workEntries: await decryptAll(entries, WORK_ENTRY_ENCRYPTED_PATHS),
    files,
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="qrilly-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
});
