/** @type {import('next').NextConfig} */

// Nothing loads remote scripts or styles, so the policy can stay tight.
// 'unsafe-inline' on styles is required by Emotion (MUI's style engine).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const nextConfig = {
  // These pull in native/dynamic file access (fonts, TLS) that the bundler
  // must not try to inline.
  serverExternalPackages: ['mongoose', 'bcryptjs', 'pdfkit', 'swissqrbill'],

  // pdfkit resolves its built-in AFM font metrics from disk at runtime, and
  // Vercel's tracer can't see those reads. Without this, PDF routes throw
  // "ENOENT .../data/Helvetica.afm" in production only.
  outputFileTracingIncludes: {
    '/api/invoices/**': ['./node_modules/pdfkit/js/data/**/*'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
