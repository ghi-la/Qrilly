/**
 * Best-effort in-memory rate limiting for the unauthenticated endpoints
 * (sign-up, verification resend) and for invoice sending. Serverless
 * instances don't share memory, so this throttles per instance rather than
 * globally - enough to blunt a naive script, and the right shape to swap for
 * Upstash/Redis later without touching the call sites.
 */

type Bucket = { count: number; resetAt: number };

const globalStore = global as unknown as { _rateLimit?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = globalStore._rateLimit ?? new Map();
globalStore._rateLimit = buckets;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/** Vercel sets x-forwarded-for; the first hop is the client. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
