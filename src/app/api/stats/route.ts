import { Invoice, WorkEntry } from '@/lib/models';
import { ok, requireUser, route } from '@/lib/api';

export const runtime = 'nodejs';

/**
 * Dashboard figures. Everything summed here lives in the denormalised
 * `totals` block, which is plaintext by design - the encrypted fields are the
 * personal ones, not the amounts - so this stays a single aggregation rather
 * than a decrypt-everything pass.
 */
export const GET = route(async () => {
  const userId = await requireUser();

  const rows = await Invoice.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: { status: '$status', currency: '$currency' },
        count: { $sum: 1 },
        total: { $sum: '$totals.total' },
      },
    },
  ]);

  const now = new Date();
  const overdue = await Invoice.aggregate([
    { $match: { userId, status: 'sent', dueDate: { $lt: now } } },
    { $group: { _id: '$currency', count: { $sum: 1 }, total: { $sum: '$totals.total' } } },
  ]);

  // Not billed yet - how much logged work is sitting there waiting, and for
  // how many distinct clients. No currency here (a preset's currency isn't
  // snapshotted onto the entry), so this stays a plain count rather than a
  // money total that could silently mix currencies.
  const [unbilled] = await WorkEntry.aggregate([
    { $match: { userId, billed: false } },
    { $group: { _id: null, count: { $sum: 1 }, clients: { $addToSet: '$clientId' } } },
  ]);

  return ok({
    byStatus: rows.map((row) => ({
      status: row._id.status,
      currency: row._id.currency,
      count: row.count,
      total: row.total,
    })),
    overdue: overdue.map((row) => ({ currency: row._id, count: row.count, total: row.total })),
    unbilledEntries: {
      count: unbilled?.count ?? 0,
      clientCount: unbilled?.clients?.length ?? 0,
    },
  });
});
