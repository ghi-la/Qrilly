import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { auth } from './auth';
import { connectDB } from './db';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Connects to the database and returns the signed-in user's id. */
export async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new HttpError(401, 'Sign in to continue.');
  await connectDB();
  return new mongoose.Types.ObjectId(id);
}

/** Wraps a route handler so thrown errors become clean JSON responses. */
export function route<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse | Response>,
) {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      // Mongo's duplicate-key error is the only 500 that's really a conflict.
      if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
        return NextResponse.json({ error: 'That invoice number is already used.' }, { status: 409 });
      }
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      console.error(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });

export function oid(value: unknown) {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) return null;
  return new mongoose.Types.ObjectId(String(value));
}

/** Every document read is scoped to the owner, so an id alone is never enough. */
export function requireOid(value: unknown, label = 'record') {
  const id = oid(value);
  if (!id) throw new HttpError(400, `Invalid ${label} id.`);
  return id;
}
