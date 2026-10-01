import { Invoice, WorkEntry } from '@/lib/models';
import { HttpError, ok, requireOid, requireUser, route } from '@/lib/api';
import { purgeExpiredInvoices } from '@/lib/invoices';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Takes an invoice back out of the trash. */
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'invoice');

  // An invoice past its window is gone, not restorable.
  await purgeExpiredInvoices(userId);

  const invoice = await Invoice.findOneAndUpdate(
    { _id: id, userId, deletedAt: { $ne: null } },
    { $set: { deletedAt: null, releasedEntryIds: [] } },
  ).lean();
  if (!invoice) throw new HttpError(404, 'That invoice is no longer in the trash.');

  // Hours that were handed back to "unbilled" are re-attached if nobody has
  // billed them elsewhere in the meantime.
  const released = invoice.releasedEntryIds ?? [];
  let rebilled = 0;
  if (released.length > 0) {
    const result = await WorkEntry.updateMany(
      { _id: { $in: released }, userId, billed: false },
      { $set: { billed: true, invoiceId: id } },
    );
    rebilled = result.modifiedCount;
  }

  return ok({ restored: true, rebilled, hoursLost: released.length - rebilled });
});
