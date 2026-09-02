import { Preset } from '@/lib/models';
import { HttpError, ok, requireUser, route } from '@/lib/api';
import { firstIssue, presetSchema } from '@/lib/schemas';
import { isSwissIban, normalizeIban } from '@/lib/qrbill';

export const runtime = 'nodejs';

export const GET = route(async () => {
  const userId = await requireUser();
  const presets = await Preset.find({ userId }).sort({ isDefault: -1, name: 1 }).lean();
  return ok(presets);
});

export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const parsed = presetSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));

  const data = parsed.data;
  const iban = normalizeIban(data.iban);
  if (!isSwissIban(iban)) throw new HttpError(400, 'Enter a valid Swiss or Liechtenstein IBAN.');

  // Exactly one preset is the default, so setting a new one clears the rest.
  if (data.isDefault) await Preset.updateMany({ userId }, { $set: { isDefault: false } });

  const preset = await Preset.create({ ...data, iban, userId });
  return ok(preset, 201);
});
