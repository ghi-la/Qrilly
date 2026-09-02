import { webcrypto } from 'node:crypto';
import { User } from './models';

/**
 * Server-held envelope encryption for the personal data on invoices: debtor
 * name/address/email, plus line-item text, messages and notes.
 * ENCRYPTION_MASTER_KEY wraps each user's per-account data-encryption key
 * (DEK), so the server can always decrypt in order to list invoices and
 * re-render their PDFs - decryption never depends on anything living in the
 * browser.
 *
 * A stored field looks like "<iv>.<ciphertext>", both base64. Documents carry
 * `encVersion: 1` to mark that their sensitive fields really are ciphertext.
 */

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  return Buffer.from(bytes as ArrayBuffer).toString('base64');
}

function fromB64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

let masterKeyPromise: Promise<webcrypto.CryptoKey> | null = null;

function getMasterKey(): Promise<webcrypto.CryptoKey> {
  if (!masterKeyPromise) {
    const raw = process.env.ENCRYPTION_MASTER_KEY;
    if (!raw) throw new Error('ENCRYPTION_MASTER_KEY is not set.');
    const bytes = fromB64(raw);
    if (bytes.length !== 32) {
      throw new Error('ENCRYPTION_MASTER_KEY must be 32 random bytes, base64-encoded.');
    }
    masterKeyPromise = webcrypto.subtle.importKey('raw', bytes, 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ]);
  }
  return masterKeyPromise;
}

async function generateDek(): Promise<webcrypto.CryptoKey> {
  return webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

async function wrapDekWithMaster(
  dek: webcrypto.CryptoKey,
): Promise<{ wrapped: string; iv: string }> {
  const master = await getMasterKey();
  const raw = await webcrypto.subtle.exportKey('raw', dek);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, master, raw);
  return { wrapped: toB64(ciphertext), iv: toB64(iv) };
}

async function unwrapDekWithMaster(wrappedB64: string, ivB64: string): Promise<webcrypto.CryptoKey> {
  const master = await getMasterKey();
  const raw = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) },
    master,
    fromB64(wrappedB64),
  );
  return webcrypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
}

/** Generates a fresh DEK for a brand-new account, wrapped for storage on the User doc. */
export async function generateDekWrappedForNewUser(): Promise<{
  encDekMaster: string;
  encDekMasterIv: string;
}> {
  const dek = await generateDek();
  const { wrapped, iv } = await wrapDekWithMaster(dek);
  return { encDekMaster: wrapped, encDekMasterIv: iv };
}

/** Loads (or lazily creates) the signed-in user's DEK, unwrapped with the server master key. */
export async function getUserDek(userId: unknown): Promise<webcrypto.CryptoKey> {
  const user = (await User.findById(userId, { encDekMaster: 1, encDekMasterIv: 1 }).lean()) as {
    encDekMaster?: string | null;
    encDekMasterIv?: string | null;
  } | null;
  if (!user) throw new Error('User not found.');

  if (user.encDekMaster && user.encDekMasterIv) {
    return unwrapDekWithMaster(user.encDekMaster, user.encDekMasterIv);
  }

  const dek = await generateDek();
  const { wrapped, iv } = await wrapDekWithMaster(dek);
  await User.updateOne({ _id: userId }, { $set: { encDekMaster: wrapped, encDekMasterIv: iv } });
  return dek;
}

/** Encrypts one field's plaintext into a storable `"<iv>.<ciphertext>"` blob. */
export async function encryptField(dek: webcrypto.CryptoKey, plaintext: string): Promise<string> {
  if (!plaintext) return '';
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    dek,
    new TextEncoder().encode(plaintext),
  );
  return `${toB64(iv)}.${toB64(ciphertext)}`;
}

/** Decrypts one stored blob. Only call this when `encVersion` says it is ciphertext. */
export async function decryptField(dek: webcrypto.CryptoKey, blob: string): Promise<string> {
  if (!blob) return '';
  const dot = blob.indexOf('.');
  if (dot < 0) return '[unable to decrypt]';
  try {
    const iv = fromB64(blob.slice(0, dot));
    const ciphertext = fromB64(blob.slice(dot + 1));
    const plain = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, ciphertext);
    return new TextDecoder().decode(plain);
  } catch {
    return '[unable to decrypt]';
  }
}

/**
 * Walks `paths` (dot-notation; `[]` steps into every array element) on a plain
 * object and rewrites each string it finds. Takes and returns
 * `Record<string, unknown>` because callers pass Mongoose `.lean()` documents,
 * whose inferred type is too loose to structurally match a named interface.
 */
async function mapPaths(
  obj: Record<string, unknown>,
  paths: string[],
  fn: (value: string) => Promise<string>,
): Promise<Record<string, unknown>> {
  const clone = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;

  const walk = async (node: unknown, parts: string[]): Promise<void> => {
    if (node === null || node === undefined) return;
    const [head, ...rest] = parts;
    if (head === '[]') {
      if (!Array.isArray(node)) return;
      await Promise.all(node.map((entry) => walk(entry, rest)));
      return;
    }
    const holder = node as Record<string, unknown>;
    if (rest.length === 0) {
      const value = holder[head];
      if (typeof value === 'string' && value) holder[head] = await fn(value);
      return;
    }
    await walk(holder[head], rest);
  };

  await Promise.all(paths.map((path) => walk(clone, path.split('.'))));
  return clone;
}

/** Fields on a Client document that are encrypted at rest. */
export const CLIENT_ENCRYPTED_PATHS = [
  'name',
  'email',
  'address.street',
  'address.buildingNumber',
  'address.zip',
  'address.city',
  'notes',
];

/**
 * Fields on an Invoice document that are encrypted at rest. The debtor block
 * is a snapshot taken when the invoice was created, so a PDF regenerated
 * years later still shows the address that was actually billed.
 */
export const INVOICE_ENCRYPTED_PATHS = [
  'debtor.name',
  'debtor.email',
  'debtor.address.street',
  'debtor.address.buildingNumber',
  'debtor.address.zip',
  'debtor.address.city',
  'message',
  'notes',
  'groups.[].title',
  'groups.[].items.[].description',
];

export const encryptDoc = (
  dek: webcrypto.CryptoKey,
  doc: Record<string, unknown>,
  paths: string[],
) => mapPaths(doc, paths, (v) => encryptField(dek, v)).then((d) => ({ ...d, encVersion: 1 }));

export const decryptDoc = async (
  dek: webcrypto.CryptoKey,
  doc: Record<string, unknown>,
  paths: string[],
) => (doc.encVersion !== 1 ? doc : mapPaths(doc, paths, (v) => decryptField(dek, v)));
