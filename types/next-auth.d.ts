import 'next-auth';

declare module 'next-auth' {
  interface User {
    /** Set from the sign-in form so the JWT can pick a 7-day or 30-minute expiry. */
    remember?: boolean;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string;
    remember?: boolean;
  }
}
