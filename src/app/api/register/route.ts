import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import { Preset, User } from '@/lib/models';
import { HttpError, ok, route } from '@/lib/api';
import { isDisposableEmail, isValidEmail } from '@/lib/validation';
import { sendVerificationEmail } from '@/lib/email';
import { createVerificationToken, VERIFICATION_TOKEN_TTL_MS } from '@/lib/verification';
import { generateDekWrappedForNewUser } from '@/lib/serverCrypto';
import { clientIp, rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

export const POST = route(async (req: Request) => {
  if (process.env.ALLOW_REGISTRATION === 'false') {
    throw new HttpError(403, 'Registration is closed on this instance.');
  }
  if (!rateLimit(`register:${clientIp(req)}`, 5, 60 * 60_000)) {
    throw new HttpError(429, 'Too many sign-up attempts. Try again later.');
  }

  const { name, email, password } = await req.json();
  const cleanEmail = String(email ?? '')
    .toLowerCase()
    .trim();

  if (!isValidEmail(cleanEmail)) throw new HttpError(400, 'Enter a valid email address.');
  if (isDisposableEmail(cleanEmail)) {
    throw new HttpError(
      400,
      'Temporary/disposable email addresses are not allowed. Please use a permanent email address.',
    );
  }
  if (String(password ?? '').length < 8) {
    throw new HttpError(400, 'Passwords need at least 8 characters.');
  }

  await connectDB();
  if (await User.findOne({ email: cleanEmail })) {
    throw new HttpError(409, 'That email is already registered. Sign in instead.');
  }

  const { token, tokenHash } = createVerificationToken();
  const { encDekMaster, encDekMasterIv } = await generateDekWrappedForNewUser();

  const user = await User.create({
    name: String(name ?? '').trim() || cleanEmail.split('@')[0],
    email: cleanEmail,
    passwordHash: await bcrypt.hash(String(password), 10),
    encDekMaster,
    encDekMasterIv,
    emailVerified: false,
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    emailVerificationSentAt: new Date(),
  });

  // A starter preset so the first invoice is one form away rather than two.
  await Preset.create({
    userId: user._id,
    name: 'My business',
    isDefault: true,
    creditor: { name: user.name, email: cleanEmail, address: { country: 'CH' } },
    iban: 'CH0000000000000000000',
    invoicePrefix: `${new Date().getFullYear()}-`,
  });

  // The account (and its token) already exist at this point regardless of
  // whether the email goes out, so a delivery failure shouldn't turn into a
  // dead end where the user can't register OR resend. Log it and let them
  // retry from the "check your email" screen instead.
  const verifyUrl = new URL(`/verify-email?token=${token}`, req.url).toString();
  try {
    await sendVerificationEmail(cleanEmail, user.name ?? '', verifyUrl);
  } catch (err) {
    console.error('[register] Verification email failed to send:', err);
  }

  return ok({ id: String(user._id), requiresVerification: true }, 201);
});
