import { User } from '@/lib/models';
import { HttpError, ok, requireUser, route } from '@/lib/api';
import { firstIssue, settingsSchema } from '@/lib/schemas';

export const runtime = 'nodejs';

export const GET = route(async () => {
  const userId = await requireUser();
  const user = await User.findById(userId).select('language').lean();
  if (!user) throw new HttpError(404, 'User not found.');
  return ok({ language: user.language ?? 'EN' });
});

export const PATCH = route(async (req: Request) => {
  const userId = await requireUser();
  const parsed = settingsSchema.partial().safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));

  const user = await User.findByIdAndUpdate(userId, { $set: parsed.data }, { new: true })
    .select('language')
    .lean();
  if (!user) throw new HttpError(404, 'User not found.');
  return ok({ language: user.language ?? 'EN' });
});
