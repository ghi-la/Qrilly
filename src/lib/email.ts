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
