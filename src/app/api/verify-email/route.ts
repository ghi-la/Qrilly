import { connectDB } from '@/lib/db';
import { User } from '@/lib/models';
import { HttpError, ok, route } from '@/lib/api';
import { hashVerificationToken } from '@/lib/verification';

export const runtime = 'nodejs';

export const POST = route(async (req: Request) => {
  const { token } = await req.json();
  const raw = String(token ?? '').trim();
  if (!raw) throw new HttpError(400, 'That link is missing its token.');

  await connectDB();
  // Only the hash is stored, so the raw token from the link is hashed to look
  // the account up - a database leak doesn't hand out working links.
  const user = await User.findOne({ emailVerificationTokenHash: hashVerificationToken(raw) });

  if (!user) throw new HttpError(400, 'That confirmation link is invalid or has already been used.');
  if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
    throw new HttpError(400, 'That confirmation link has expired. Request a new one.');
  }

  user.emailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return ok({ verified: true });
});
