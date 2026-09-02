import { connectDB } from '@/lib/db';
import { User } from '@/lib/models';
import { HttpError, ok, route } from '@/lib/api';
import { sendVerificationEmail } from '@/lib/email';
import {
  createVerificationToken,
  VERIFICATION_RESEND_COOLDOWN_MS,
  VERIFICATION_TOKEN_TTL_MS,
} from '@/lib/verification';
import { clientIp, rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

export const POST = route(async (req: Request) => {
  if (!rateLimit(`resend:${clientIp(req)}`, 5, 60 * 60_000)) {
    throw new HttpError(429, 'Too many requests. Try again later.');
  }

  const { email } = await req.json();
  const cleanEmail = String(email ?? '')
    .toLowerCase()
    .trim();

  await connectDB();
  const user = await User.findOne({ email: cleanEmail });

  // Always answers the same way: whether an address has an account here is
  // not something an unauthenticated caller gets to find out.
  const generic = ok({ sent: true });
  if (!user || user.emailVerified) return generic;

  if (
    user.emailVerificationSentAt &&
    Date.now() - user.emailVerificationSentAt.getTime() < VERIFICATION_RESEND_COOLDOWN_MS
  ) {
    return generic;
  }

  const { token, tokenHash } = createVerificationToken();
  user.emailVerificationTokenHash = tokenHash;
  user.emailVerificationExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
  user.emailVerificationSentAt = new Date();
  await user.save();

  const verifyUrl = new URL(`/verify-email?token=${token}`, req.url).toString();
  try {
    await sendVerificationEmail(cleanEmail, user.name ?? '', verifyUrl);
  } catch (err) {
    console.error('[resend-verification] Failed to send:', err);
  }

  return generic;
});
