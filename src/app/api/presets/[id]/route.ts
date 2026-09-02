import { Invoice, Preset } from '@/lib/models';
import { HttpError, ok, requireOid, requireUser, route } from '@/lib/api';
import { firstIssue, presetSchema } from '@/lib/schemas';
import { isSwissIban, normalizeIban } from '@/lib/qrbill';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'preset');
  const preset = await Preset.findOne({ _id: id, userId }).lean();
  if (!preset) throw new HttpError(404, 'Preset not found.');
  return ok(preset);
});

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'preset');
  const parsed = presetSchema.partial().safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));

  const data = { ...parsed.data };
  if (data.iban !== undefined) {
    data.iban = normalizeIban(data.iban);
    if (!isSwissIban(data.iban)) throw new HttpError(400, 'Enter a valid Swiss or Liechtenstein IBAN.');
  }
  if (data.isDefault) await Preset.updateMany({ userId }, { $set: { isDefault: false } });

  const preset = await Preset.findOneAndUpdate({ _id: id, userId }, { $set: data }, { new: true }).lean();
  if (!preset) throw new HttpError(404, 'Preset not found.');
  return ok(preset);
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'preset');

  // Invoices snapshot their creditor data, but they still point at the preset
  // for numbering, so deleting one that's in use would orphan them.
  if (await Invoice.exists({ userId, presetId: id })) {
    throw new HttpError(409, 'This preset is used by existing invoices, so it cannot be deleted.');
  }

  const result = await Preset.deleteOne({ _id: id, userId });
  if (result.deletedCount === 0) throw new HttpError(404, 'Preset not found.');
  return ok({ deleted: true });
});
