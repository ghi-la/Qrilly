import { connectDB } from '@/lib/db';
import { User } from '@/lib/models';
import { HttpError, ok, route } from '@/lib/api';
import { sendPasswordResetEmail } from '@/lib/email';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { createVerificationToken, PASSWORD_RESET_COOLDOWN_MS, PASSWORD_RESET_TTL_MS } from '@/lib/verification';

export const runtime = 'nodejs';

export const POST = route(async (req: Request) => {
  if (!rateLimit(`forgot:${clientIp(req)}`, 5, 60 * 60_000)) {
    throw new HttpError(429, 'Too many requests. Try again later.');
  }

  const { email } = await req.json();
  const cleanEmail = String(email ?? '')
    .toLowerCase()
    .trim();

  // Same answer whether or not the address has an account.
  const generic = ok({ sent: true });
  if (!cleanEmail) return generic;

  await connectDB();
  const user = await User.findOne({ email: cleanEmail });
  if (!user) return generic;

  if (user.passwordResetSentAt && Date.now() - user.passwordResetSentAt.getTime() < PASSWORD_RESET_COOLDOWN_MS) {
    return generic;
  }

  const { token, tokenHash } = createVerificationToken();
  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  user.passwordResetSentAt = new Date();
  await user.save();

  const resetUrl = new URL(`/reset-password?token=${token}`, req.url).toString();
  try {
    await sendPasswordResetEmail(cleanEmail, user.name ?? '', resetUrl);
  } catch (err) {
    console.error('[forgot-password] Failed to send:', err);
  }

  return generic;
});
