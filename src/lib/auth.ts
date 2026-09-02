import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectDB } from './db';
import { User } from './models';
import { authConfig } from './auth.config';
import { clientIp, rateLimit } from './rateLimit';

/** Thrown by `authorize` so the client can tell this apart from a wrong password. */
class EmailNotVerifiedSignin extends CredentialsSignin {
  code = 'email-not-verified';
}

class TooManyAttemptsSignin extends CredentialsSignin {
  code = 'too-many-attempts';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, remember: {} },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? '')
          .toLowerCase()
          .trim();
        const password = String(credentials?.password ?? '');
        if (!email || !password) return null;

        // Throttled on both axes: one address can't be brute-forced from many
        // IPs, and one IP can't spray many addresses.
        const ip = clientIp(request as Request);
        if (!rateLimit(`login:ip:${ip}`, 20, 15 * 60_000)) throw new TooManyAttemptsSignin();
        if (!rateLimit(`login:email:${email}`, 10, 15 * 60_000)) throw new TooManyAttemptsSignin();

        await connectDB();
        const user = await User.findOne({ email });
        if (!user) {
          // Compare against a dummy hash anyway so a missing account and a
          // wrong password take the same time to answer.
          await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        if (!user.emailVerified) throw new EmailNotVerifiedSignin();

        return {
          id: String(user._id),
          email: user.email,
          name: user.name ?? user.email,
          remember: credentials?.remember === 'true',
        };
      },
    }),
  ],
});
