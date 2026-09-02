# Qrilly

Swiss QR-bill invoicing on Next.js. Sign in, save a sender preset (logo, address,
IBAN, numbering, VAT defaults), and issue invoices whose line items are grouped
the way the work is actually billed — consulting in hours in one group, travel
per kilometre in the next, each with its own subtotal.

Invoices are stored as **data**, never as a PDF or a blob. The document is
rebuilt from the record on every download, so a re-download in three years is
regenerated from the same fields rather than served from a stale file.

---

## Setup

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. MongoDB Atlas

Create a free cluster, add a database user, and allow network access from
`0.0.0.0/0` (Vercel's functions don't have fixed egress IPs on the Hobby plan).
Copy the connection string into `MONGODB_URI` and **add the database name after
the host** — without it Atlas silently uses `test`:

```
mongodb+srv://USER:PASSWORD@cluster-ghila.zrsoj.mongodb.net/qrilly?retryWrites=true&w=majority&appName=Cluster-Ghila
```

Indexes (including the unique one on invoice numbers per user) are created by
Mongoose on first connection. No migration step.

### 3. Generate the two keys

```bash
openssl rand -base64 32   # -> AUTH_SECRET
openssl rand -base64 32   # -> ENCRYPTION_MASTER_KEY
```

`ENCRYPTION_MASTER_KEY` wraps every user's data-encryption key. **Never rotate
it without re-wrapping each user's DEK first**, or their encrypted invoices
become permanently unreadable.

### 4. Email (optional)

Sign up at [resend.com](https://resend.com) (free tier: 100 emails/day, no card),
add and verify your sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM`.

Without a key: registration still works and the confirmation link is logged to
the server console, which is fine locally. Invoice emailing returns a clear
"not configured" error rather than failing silently.

### 5. Run

```bash
npm run dev
```

Register, click the link in your inbox (or copy it from the console), sign in.
A starter preset is created for you — open **Presets** and put your real IBAN in
before issuing anything.

---

## Deploying to Vercel

Import the repo, then set the environment variables in **Settings → Environment
Variables**: `MONGODB_URI`, `AUTH_SECRET`, `ENCRYPTION_MASTER_KEY`, and
optionally `RESEND_API_KEY`, `EMAIL_FROM`, `ALLOW_REGISTRATION`. No build
configuration is needed; `next.config.mjs` already carries the two settings that
matter for this stack:

- `serverExternalPackages` keeps mongoose, bcryptjs, pdfkit and swissqrbill out
  of the bundler.
- `outputFileTracingIncludes` ships pdfkit's AFM font metrics with the PDF
  routes. Without it, PDF generation throws `ENOENT .../Helvetica.afm` **in
  production only** — the tracer can't see those runtime file reads.

Once your own accounts exist, set `ALLOW_REGISTRATION=false` to close sign-ups.

---

## The QR bill

All three reference schemes are supported, with the standard's constraints
enforced in both directions:

| Type | When | Notes |
|------|------|-------|
| **QRR** | QR-IBAN accounts (institution id 30000–31999) | 27 digits, recursive mod-10 check digit. Required on a QR-IBAN. |
| **SCOR** | Ordinary IBANs | ISO 11649 creditor reference (`RF…`), mod-97 check. |
| **NON** | Ordinary IBANs | No structured reference; the invoice number goes in the message field. |

`src/lib/qrbill.ts` is pure — no Node or database imports — so the same
validation runs in the browser while you type and again on the server before
anything is written. The slip itself is drawn by
[`swissqrbill`](https://github.com/schoero/swissqrbill), which validates the
payment data against the specification and throws on anything non-compliant.

The payment part owns the bottom 105 mm of the page, so every page reserves that
strip and the slip lands under the content of the last one.

---

## Security

Modelled on [Ledgerly](https://github.com/ghi-la/Ledgerly):

- **Envelope encryption.** `ENCRYPTION_MASTER_KEY` (AES-GCM) wraps a per-user
  data-encryption key stored on the account. Debtor names, addresses and emails,
  line-item descriptions, group titles, slip messages and notes are ciphertext
  at rest (`"<iv>.<ciphertext>"`, marked by `encVersion: 1`). Amounts stay in
  plaintext so the dashboard aggregates without decrypting everything.
- **Passwords** are bcrypt-hashed. A missing account still runs a dummy compare,
  so wrong-password and no-such-user take the same time.
- **Email confirmation** is required before first sign-in. Only the SHA-256 hash
  of the token is stored, so a database leak doesn't hand out working links.
- **Sessions** are JWTs with a sliding expiry: 7 days with "keep me signed in",
  30 minutes of inactivity without. The Edge middleware uses a database-free
  config; the Credentials provider lives in the Node runtime.
- **Rate limiting** on sign-in (per IP *and* per address), registration, resend
  and invoice sending. In-memory, so it throttles per serverless instance — the
  call sites are shaped to swap in Redis without changes.
- **Ownership** is part of every query (`{ _id, userId }`), never a check after
  the fact. An id alone never grants access to a record, a logo or a PDF.
- **Uploads** are checked by magic bytes, not the browser's declared MIME type,
  and capped at 600 KB.
- **Headers**: CSP locked to `'self'`, HSTS, `nosniff`, `frame-ancestors 'none'`,
  restrictive permissions policy.
- Disposable/temp-mail domains are rejected at sign-up.

---

## Layout

```
src/
  app/
    (auth)/          login, register, verify-email
    (app)/           dashboard, invoices, clients, presets   (auth-gated layout)
    api/             REST endpoints; invoices/[id]/pdf renders on demand
  components/        AppShell, InvoiceEditor, dialogs, shared UI
  lib/
    qrbill.ts        IBAN/QR-IBAN, QRR, SCOR — pure, shared client + server
    totals.ts        grouped line items, VAT, discounts, 0.05 rounding — shared
    pdf.ts           the only place a PDF is produced
    serverCrypto.ts  DEK envelope encryption
    models.ts        typed Mongoose schemas
    auth.ts          Credentials provider, throttling
    schemas.ts       Zod payload validation for every route
```

`totals.ts` is imported by both the editor and the renderer, so the number in
the sticky footer while you type is the number that gets printed.

---

## Notes and limits

- Logos are stored base64 in Mongo (capped at 600 KB) rather than pulling an
  object store into a deployment that otherwise needs only a database. Files are
  immutable: uploading a replacement creates a new document, which is what lets
  an old invoice keep rendering with the logo it was issued with.
- Invoice search decrypts before filtering, so it is a scan rather than a Mongo
  text query. Fine for thousands of invoices per user; add a blind index if that
  stops being true.
- Currency is CHF or EUR — the QR-bill standard allows nothing else.
- Fonts are a system stack, so the build has no network dependency and the CSP
  stays locked to `'self'`.
