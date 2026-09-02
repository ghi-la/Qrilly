import { ok, requireOid, requireUser, route } from '@/lib/api';
import { renderInvoice } from '@/lib/invoices';

export const runtime = 'nodejs';
// The document is rebuilt from the record on every request, so there is
// nothing here worth caching at the edge.
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'invoice');
  const { pdf, invoice } = await renderInvoice(userId, id);

  const inline = new URL(req.url).searchParams.get('inline') === '1';
  const filename = `invoice-${String(invoice.number).replace(/[^\w.-]/g, '_')}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
});

export const POST = route(async () => ok({ error: 'Use GET.' }, 405));
