'use client';

/** A 401 mid-session means the login is no longer valid (expired, or the password changed elsewhere). */
function handleExpiredSession(res: Response) {
  if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login?expired=1';
  }
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);
  handleExpiredSession(res);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Request failed.');
  }
  return res.json();
};

export async function send(
  url: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown,
) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  handleExpiredSession(res);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed.');
  return data;
}

export function formatMoney(value: number, currency = 'CHF', locale = 'de-CH') {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

export function formatDate(value: string | Date, locale = 'de-CH') {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

/** yyyy-mm-dd for <input type="date">, in local time rather than UTC. */
export function toDateInput(value: string | Date) {
  const d = new Date(value);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

export function addDays(value: string | Date, days: number) {
  const d = new Date(value);
  d.setDate(d.getDate() + days);
  return d;
}

/* --------------------------------------------------- live input filtering */
// Strip disallowed characters as the user types, rather than validating
// after the fact - every address in this app is Swiss, so a ZIP is always
// four digits and a city name never contains one.

export function digitsOnly(value: string, maxLength?: number) {
  const digits = value.replace(/\D/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
}

export function withoutDigits(value: string) {
  return value.replace(/\d/g, '');
}

/** Swiss house numbers: digits with an optional letter or range, e.g. "12a", "3-5". */
export function houseNumberChars(value: string) {
  return value.replace(/[^0-9a-zA-Z\-/\s]/g, '');
}

/** IBAN is letters and digits only; kept uppercase and space-tolerant while typing. */
export function ibanChars(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9\s]/g, '');
}

/**
 * Many mobile keyboards offer only "," as a decimal separator depending on
 * the device's locale, but a plain `type="number"` input silently rejects
 * that character - the field just won't accept a decimal at all. Fields that
 * need a decimal use `type="text"` with `inputMode="decimal"` instead and
 * parse through this, so "," and "." are accepted and treated as equal.
 */
export function parseDecimal(value: string): number {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
