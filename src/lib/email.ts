import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export const emailEnabled = () => Boolean(resend);

const FROM = () => process.env.EMAIL_FROM || 'Qrilly <onboarding@resend.dev>';

/**
 * Resend's free tier (100 emails/day, no card required) needs a verified
 * sending domain to reach arbitrary recipients; until EMAIL_FROM points at
 * one, `onboarding@resend.dev` only delivers to the account's own inbox. In
 * dev, with no RESEND_API_KEY set at all, the link is logged instead so the
 * flow is still testable end to end.
 */
export async function sendVerificationEmail(to: string, name: string, verifyUrl: string) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set. Verification link for ${to}:\n${verifyUrl}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM(),
    to,
    subject: 'Confirm your Qrilly account',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #B0293A;">Welcome to Qrilly${name ? `, ${escapeHtml(name)}` : ''}</h2>
        <p>Confirm your email address to finish creating your account.</p>
        <p>
          <a href="${verifyUrl}" style="display:inline-block;background:#B0293A;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">
            Confirm email
          </a>
        </p>
        <p style="color:#666;font-size:13px;">Or paste this link into your browser: ${verifyUrl}</p>
        <p style="color:#666;font-size:13px;">This link expires in 24 hours. If you didn't create a Qrilly account, you can ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    console.error('[email] Failed to send verification email:', error);
    throw new Error('Could not send the verification email. Try again shortly.');
  }
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set. Password reset link for ${to}:\n${resetUrl}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM(),
    to,
    subject: 'Reset your Qrilly password',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #B0293A;">Reset your password${name ? `, ${escapeHtml(name)}` : ''}</h2>
        <p>Someone asked to reset the password on this Qrilly account. If that was you, choose a new one here:</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;background:#B0293A;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">
            Choose a new password
          </a>
        </p>
        <p style="color:#666;font-size:13px;">Or paste this link into your browser: ${resetUrl}</p>
        <p style="color:#666;font-size:13px;">This link expires in 1 hour. If you didn't ask for this, you can ignore this email - your password stays as it is.</p>
      </div>
    `,
  });

  if (error) {
    console.error('[email] Failed to send password reset email:', error);
    throw new Error('Could not send the email. Try again shortly.');
  }
}

const DELETED_COPY: Record<string, { subject: (n: string) => string; body: (n: string, who: string) => string }> = {
  EN: {
    subject: (n) => `Invoice ${n} has been withdrawn`,
    body: (n, who) =>
      `Hello,\n\ninvoice ${n} from ${who} has been withdrawn and is no longer valid. Please do not pay it - if you already did, get in touch with us.\n\nKind regards,\n${who}`,
  },
  IT: {
    subject: (n) => `La fattura ${n} è stata ritirata`,
    body: (n, who) =>
      `Buongiorno,\n\nla fattura ${n} di ${who} è stata ritirata e non è più valida. Vi preghiamo di non pagarla - se l’avete già fatto, contattateci.\n\nCordiali saluti,\n${who}`,
  },
  DE: {
    subject: (n) => `Rechnung ${n} wurde zurückgezogen`,
    body: (n, who) =>
      `Guten Tag\n\ndie Rechnung ${n} von ${who} wurde zurückgezogen und ist nicht mehr gültig. Bitte bezahlen Sie sie nicht - falls Sie bereits bezahlt haben, melden Sie sich bei uns.\n\nFreundliche Grüsse\n${who}`,
  },
  FR: {
    subject: (n) => `La facture ${n} a été retirée`,
    body: (n, who) =>
      `Bonjour,\n\nla facture ${n} de ${who} a été retirée et n’est plus valable. Merci de ne pas la payer - si vous l’avez déjà fait, contactez-nous.\n\nCordialement,\n${who}`,
  },
};

/** Tells a client that an invoice they were sent has been withdrawn. */
export async function sendInvoiceDeletedEmail(options: {
  to: string;
  replyTo?: string;
  language: string;
  number: string;
  creditor: string;
}) {
  if (!resend) throw new Error('Email sending is not configured. Set RESEND_API_KEY to enable it.');
  const copy = DELETED_COPY[options.language] ?? DELETED_COPY.EN;
  const subject = copy.subject(options.number);
  const body = copy.body(options.number, options.creditor);

  const { error } = await resend.emails.send({
    from: FROM(),
    to: options.to,
    replyTo: options.replyTo,
    subject,
    html: `<div style="font-family: sans-serif; max-width: 560px; white-space: pre-wrap;">${escapeHtml(body)}</div>`,
    text: body,
  });
  if (error) {
    console.error('[email] Failed to send withdrawal notice:', error);
    throw new Error(error.message || 'The notice could not be emailed.');
  }
}

export async function sendInvoiceEmail(options: {
  to: string;
  replyTo?: string;
  subject: string;
  body: string;
  filename: string;
  pdf: Buffer;
}) {
  if (!resend) {
    throw new Error('Email sending is not configured. Set RESEND_API_KEY to enable it.');
  }

  const html = `<div style="font-family: sans-serif; max-width: 560px; white-space: pre-wrap;">${escapeHtml(
    options.body,
  )}</div>`;

  const { error } = await resend.emails.send({
    from: FROM(),
    to: options.to,
    replyTo: options.replyTo,
    subject: options.subject,
    html,
    text: options.body,
    attachments: [{ filename: options.filename, content: options.pdf.toString('base64') }],
  });

  if (error) {
    console.error('[email] Failed to send invoice:', error);
    throw new Error(error.message || 'The invoice could not be emailed.');
  }
}

/** User-supplied text goes into HTML bodies, so it is escaped rather than trusted. */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
