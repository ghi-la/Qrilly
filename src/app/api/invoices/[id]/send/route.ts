import { Invoice, Preset } from '@/lib/models';
import { HttpError, ok, requireOid, requireUser, route } from '@/lib/api';
import { firstIssue, sendSchema } from '@/lib/schemas';
import { emailEnabled, sendInvoiceEmail } from '@/lib/email';
import { renderInvoice } from '@/lib/invoices';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'invoice');

  if (!emailEnabled()) {
    throw new HttpError(503, 'Email sending is not configured. Set RESEND_API_KEY to enable it.');
  }
  // Per-account throttle: an authenticated user still shouldn't be able to
  // turn this into an open relay for someone else's inbox.
  if (!rateLimit(`send:${userId}`, 30, 60 * 60_000)) {
    throw new HttpError(429, 'Too many invoices sent in the last hour. Try again later.');
  }

  const parsed = sendSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));

  const { pdf, invoice } = await renderInvoice(userId, id);
  const preset = await Preset.findOne({ _id: invoice.presetId, userId }).lean();

  await sendInvoiceEmail({
    to: parsed.data.to,
    replyTo: preset?.creditor?.email || undefined,
    subject: parsed.data.subject,
    body: parsed.data.body,
    filename: `invoice-${String(invoice.number).replace(/[^\w.-]/g, '_')}.pdf`,
    pdf,
  });

  const update: Record<string, unknown> = {
    $set: { sentAt: new Date() },
    $addToSet: { sentTo: parsed.data.to },
  };
  if (parsed.data.markAsSent && invoice.status === 'draft') {
    (update.$set as Record<string, unknown>).status = 'sent';
  }
  await Invoice.updateOne({ _id: id, userId }, update);

  return ok({ sent: true, to: parsed.data.to });
});
