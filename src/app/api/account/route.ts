import bcrypt from 'bcryptjs';
import { Client, FileAsset, Invoice, Preset, User, WorkEntry } from '@/lib/models';
import { HttpError, ok, requireUser, route } from '@/lib/api';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

/** Permanently removes the account and everything stored under it. */
export const DELETE = route(async (req: Request) => {
  const userId = await requireUser();
  if (!rateLimit(`delete-account:${userId}`, 5, 15 * 60_000)) {
    throw new HttpError(429, 'Too many attempts. Try again later.');
  }

  const { password } = await req.json();
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'User not found.');
  if (!(await bcrypt.compare(String(password ?? ''), user.passwordHash))) {
    throw new HttpError(400, 'That password is not right.');
  }

  // The user goes last: if anything fails midway the account still exists and
  // the request can simply be repeated.
  await Promise.all([
    WorkEntry.deleteMany({ userId }),
    Invoice.deleteMany({ userId }),
    Client.deleteMany({ userId }),
    Preset.deleteMany({ userId }),
    FileAsset.deleteMany({ userId }),
  ]);
  await User.deleteOne({ _id: userId });

  return ok({ deleted: true });
});
