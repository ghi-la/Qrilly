import bcrypt from 'bcryptjs';
import { User } from '@/lib/models';
import { HttpError, ok, requireUser, route } from '@/lib/api';
import { rateLimit } from '@/lib/rateLimit';
import { passwordProblem } from '@/lib/validation';

export const runtime = 'nodejs';

export const PATCH = route(async (req: Request) => {
  const userId = await requireUser();
  if (!rateLimit(`password:${userId}`, 10, 15 * 60_000)) {
    throw new HttpError(429, 'Too many attempts. Try again later.');
  }

  const { currentPassword, newPassword } = await req.json();
  const problem = passwordProblem(String(newPassword ?? ''));
  if (problem) throw new HttpError(400, problem);

  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'User not found.');
  if (!(await bcrypt.compare(String(currentPassword ?? ''), user.passwordHash))) {
    throw new HttpError(400, 'Your current password is not right.');
  }

  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  return ok({ changed: true });
});
