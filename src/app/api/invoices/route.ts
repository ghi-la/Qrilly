import { Invoice } from '@/lib/models';
import { HttpError, ok, requireUser, route } from '@/lib/api';
import { firstIssue, invoiceSchema } from '@/lib/schemas';
import { buildInvoiceDoc, decryptInvoices, encryptInvoice } from '@/lib/invoices';

export const runtime = 'nodejs';

export const GET = route(async (req: Request) => {
  const userId = await requireUser();
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const search = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 500);

  const query: Record<string, unknown> = { userId };
  if (status && status !== 'all') query.status = status;

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

  return ok(filtered);
});

export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const parsed = invoiceSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));

  const doc = await buildInvoiceDoc(userId, parsed.data);
  const encrypted = await encryptInvoice(userId, doc);
  const created = await Invoice.create(encrypted);

  return ok({ ...doc, _id: String(created._id) }, 201);
});
