/**
 * Swiss QR-bill primitives: IBAN/QR-IBAN checks and the two reference
 * schemes the standard allows (QRR and SCOR), plus the "NON" case.
 * Pure functions with no Node or DB imports, so the same rules run in the
 * browser while typing and again on the server before anything is stored.
 */

export type ReferenceType = 'QRR' | 'SCOR' | 'NON';
export type Currency = 'CHF' | 'EUR';
export type QrLanguage = 'DE' | 'FR' | 'IT' | 'EN';

export const CURRENCIES: Currency[] = ['CHF', 'EUR'];
// The standard supports DE/FR too, but this instance only offers IT and EN.
export const QR_LANGUAGES: QrLanguage[] = ['IT', 'EN'];

const A_CODE = 'A'.charCodeAt(0);

export function normalizeIban(value: string): string {
  return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Groups an IBAN in fours for display: CH44 3199 9123 0008 8901 2. */
export function formatIban(value: string): string {
  return normalizeIban(value).replace(/(.{4})/g, '$1 ').trim();
}

/** ISO 7064 mod-97-10, the checksum shared by IBAN and the SCOR reference. */
function mod97(input: string): number {
  let remainder = 0;
  for (const char of input) {
    const digit = /[0-9]/.test(char) ? char : String(char.charCodeAt(0) - A_CODE + 10);
    remainder = Number(String(remainder) + digit) % 97;
  }
  return remainder;
}

export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  return mod97(iban.slice(4) + iban.slice(0, 4)) === 1;
}

/** The QR-bill standard only accepts Swiss and Liechtenstein accounts. */
export function isSwissIban(value: string): boolean {
  const iban = normalizeIban(value);
  return isValidIban(iban) && (iban.startsWith('CH') || iban.startsWith('LI'));
}

/**
 * A QR-IBAN carries an institution id in positions 5-9 between 30000 and
 * 31999. Those accounts require a QRR reference; ordinary IBANs forbid it.
 */
export function isQrIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!isSwissIban(iban)) return false;
  const iid = Number(iban.slice(4, 9));
  return Number.isInteger(iid) && iid >= 30000 && iid <= 31999;
}

/* ------------------------------------------------------------------- QRR */

// Recursive mod-10 (DIN 66003 / Swiss "Modulo 10, rekursiv") carry table.
const MOD10_TABLE = [
  [0, 9, 4, 6, 8, 2, 7, 1, 3, 5],
  [9, 4, 6, 8, 2, 7, 1, 3, 5, 0],
  [4, 6, 8, 2, 7, 1, 3, 5, 0, 9],
  [6, 8, 2, 7, 1, 3, 5, 0, 9, 4],
  [8, 2, 7, 1, 3, 5, 0, 9, 4, 6],
  [2, 7, 1, 3, 5, 0, 9, 4, 6, 8],
  [7, 1, 3, 5, 0, 9, 4, 6, 8, 2],
  [1, 3, 5, 0, 9, 4, 6, 8, 2, 7],
  [3, 5, 0, 9, 4, 6, 8, 2, 7, 1],
  [5, 0, 9, 4, 6, 8, 2, 7, 1, 3],
];

export function mod10Recursive(digits: string): number {
  let carry = 0;
  for (const char of digits) carry = MOD10_TABLE[carry][Number(char)];
  return (10 - carry) % 10;
}

/**
 * Builds the 27-digit QRR reference: up to 26 digits of your own numbering,
 * right-aligned and zero-padded, plus the recursive mod-10 check digit.
 */
export function buildQrReference(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '').slice(-26).padStart(26, '0');
  return digits + String(mod10Recursive(digits));
}

export function isValidQrReference(value: string): boolean {
  const digits = (value ?? '').replace(/\s/g, '');
  if (!/^[0-9]{27}$/.test(digits)) return false;
  return mod10Recursive(digits.slice(0, 26)) === Number(digits[26]);
}

/* ------------------------------------------------------------------ SCOR */

/** Builds an ISO 11649 creditor reference: RF + check digits + your own key. */
export function buildScorReference(raw: string): string {
  const body = (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 21);
  if (!body) return '';
  const check = 98 - mod97(body + 'RF00');
  return `RF${String(check).padStart(2, '0')}${body}`;
}

export function isValidScorReference(value: string): boolean {
  const ref = (value ?? '').toUpperCase().replace(/\s/g, '');
  if (!/^RF[0-9]{2}[A-Z0-9]{1,21}$/.test(ref)) return false;
  return mod97(ref.slice(4) + ref.slice(0, 4)) === 1;
}

/* -------------------------------------------------------------- shared */

/** QRR is printed in blocks of 5 from the right; SCOR in blocks of 4. */
export function formatReference(reference: string, type: ReferenceType): string {
  const ref = (reference ?? '').replace(/\s/g, '');
  if (!ref) return '';
  if (type === 'SCOR') return ref.replace(/(.{4})/g, '$1 ').trim();
  const head = ref.length % 5 || 5;
  return (ref.slice(0, head) + ' ' + ref.slice(head).replace(/(.{5})/g, '$1 ')).trim();
}

/**
 * Derives the reference an invoice should carry. QRR accounts must have one,
 * ordinary IBANs may use SCOR or none at all - which is the same constraint
 * the payment rails enforce, so it is checked here rather than at print time.
 */
export function deriveReference(
  type: ReferenceType,
  iban: string,
  seed: string,
): { reference: string; error?: string } {
  const qrIban = isQrIban(iban);
  if (type === 'QRR') {
    if (!qrIban) {
      return { reference: '', error: 'A QRR reference requires a QR-IBAN (institution id 30000-31999).' };
    }
    return { reference: buildQrReference(seed) };
  }
  if (qrIban) {
    return { reference: '', error: 'QR-IBAN accounts must use a QRR reference.' };
  }
  if (type === 'SCOR') {
    const reference = buildScorReference(seed);
    if (!reference) return { reference: '', error: 'Enter a reference key for the SCOR reference.' };
    return { reference };
  }
  return { reference: '' };
}

/** The QR bill only has room for ~140 characters of unstructured message. */
export const MAX_MESSAGE_LENGTH = 140;
