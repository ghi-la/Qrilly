import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models';
import { HttpError, ok, route } from '@/lib/api';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { passwordProblem } from '@/lib/validation';
import { hashVerificationToken } from '@/lib/verification';

export const runtime = 'nodejs';

export const POST = route(async (req: Request) => {
  if (!rateLimit(`reset:${clientIp(req)}`, 10, 60 * 60_000)) {
    throw new HttpError(429, 'Too many attempts. Try again later.');
  }

  const { token, password } = await req.json();
  const raw = String(token ?? '').trim();
  if (!raw) throw new HttpError(400, 'That link is missing its token.');
  const problem = passwordProblem(String(password ?? ''));
  if (problem) throw new HttpError(400, problem);

  await connectDB();
  const user = await User.findOne({ passwordResetTokenHash: hashVerificationToken(raw) });
  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    throw new HttpError(400, 'That reset link is invalid or has expired. Request a new one.');
  }

  user.passwordHash = await bcrypt.hash(String(password), 10);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  // Following a link that reached this inbox also proves the address is theirs.
  user.emailVerified = true;
  await user.save();

  return ok({ reset: true });
});
