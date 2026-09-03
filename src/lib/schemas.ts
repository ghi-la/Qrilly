import { z } from 'zod';

/**
 * One schema per payload, used by the API routes. Anything the client sends is
 * parsed through these before it reaches mongoose, so unknown keys are dropped
 * rather than written (no `userId` smuggled in from the browser, for example).
 */

const trimmed = (max: number) => z.string().trim().max(max);

// Every address in this app is Swiss, so these mirror the live keystroke
// filtering in the forms (see lib/client.ts) rather than a generic i18n rule.
export const addressSchema = z.object({
  street: trimmed(70).default(''),
  buildingNumber: trimmed(16).regex(/^[0-9a-zA-Z\-/\s]*$/, 'Enter a valid house number.').default(''),
  zip: trimmed(4).regex(/^\d{0,4}$/, 'ZIP must be 4 digits.').default(''),
  city: trimmed(35).regex(/^\D*$/, 'City must not contain numbers.').default(''),
  country: trimmed(2).default('CH'),
});

export const partySchema = z.object({
  name: trimmed(70),
  email: z.union([z.string().trim().email(), z.literal('')]).default(''),
  address: addressSchema,
});

export const presetLineGroupSchema = z.object({
  name: trimmed(60).min(1, 'Give the group a name.'),
  unit: trimmed(20).default(''),
  unitPrice: z.number().finite().default(0),
  vatRate: z.number().min(0).max(100).default(0),
});

export const presetSchema = z.object({
  name: trimmed(80).min(1, 'Give the preset a name.'),
  isDefault: z.boolean().default(false),
  creditor: partySchema,
  iban: trimmed(40).min(1, 'An IBAN is required.'),
  vatNumber: trimmed(40).default(''),
  phone: trimmed(40).default(''),
  website: trimmed(120).default(''),
  logoFileId: z.string().nullable().default(null),
  referenceType: z.enum(['QRR', 'SCOR', 'NON']).default('NON'),
  currency: z.enum(['CHF', 'EUR']).default('CHF'),
  qrLanguage: z.enum(['DE', 'FR', 'IT', 'EN']).default('EN'),
  invoicePrefix: trimmed(20).default(''),
  nextNumber: z.number().int().min(1).default(1),
  paymentTermDays: z.number().int().min(0).max(365).default(30),
  defaultVatRate: z.number().min(0).max(100).default(8.1),
  vatIncluded: z.boolean().default(false),
  roundTo5Cents: z.boolean().default(false),
  footerNote: trimmed(500).default(''),
  emailSubject: trimmed(200).default(''),
  emailBody: trimmed(4000).default(''),
  lineGroups: z.array(presetLineGroupSchema).max(30).default([]),
});

export const clientSchema = z.object({
  name: trimmed(70).min(1, 'A client needs a name.'),
  email: z.union([z.string().trim().email(), z.literal('')]).default(''),
  address: addressSchema,
  notes: trimmed(1000).default(''),
});

export const itemSchema = z.object({
  description: trimmed(500).default(''),
  quantity: z.number().finite().default(0),
  unit: trimmed(20).default(''),
  unitPrice: z.number().finite().default(0),
  vatRate: z.number().min(0).max(100).default(0),
});

export const groupSchema = z.object({
  title: trimmed(120).default(''),
  showTitle: z.boolean().default(true),
  simpleItems: z.boolean().default(false),
  items: z.array(itemSchema).max(200),
});

export const invoiceSchema = z.object({
  presetId: z.string().min(1, 'Pick a preset.'),
  clientId: z.string().nullable().default(null),
  number: trimmed(30).optional(),
  status: z.enum(['draft', 'sent', 'paid', 'canceled']).optional(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  debtor: partySchema,
  groups: z.array(groupSchema).min(1, 'Add at least one group of line items.').max(50),
  currency: z.enum(['CHF', 'EUR']).optional(),
  qrLanguage: z.enum(['DE', 'FR', 'IT', 'EN']).optional(),
  referenceType: z.enum(['QRR', 'SCOR', 'NON']).optional(),
  /** Your own key for the reference; the check digits are added server-side. */
  referenceKey: trimmed(25).default(''),
  vatIncluded: z.boolean().default(false),
  discountPercent: z.number().min(0).max(100).default(0),
  roundTo5Cents: z.boolean().default(false),
  message: trimmed(140).default(''),
  notes: trimmed(2000).default(''),
  /** Work entries this invoice bills; set once created, never sent for an edit. */
  sourceEntryIds: z.array(z.string()).max(200).optional(),
});

export const workEntrySchema = z.object({
  presetId: z.string().min(1, 'Pick a preset.'),
  clientId: z.string().min(1, 'Pick a client.'),
  groupName: trimmed(60).min(1, 'Pick a group.'),
  quantity: z.number().finite(),
  note: trimmed(500).default(''),
  entryDate: z.coerce.date(),
});

export const settingsSchema = z.object({
  language: z.enum(['DE', 'FR', 'IT', 'EN']),
});

export const statusSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'canceled']),
});

export const sendSchema = z.object({
  to: z.string().trim().email('Enter a valid recipient address.'),
  subject: trimmed(200).min(1),
  body: trimmed(8000).min(1),
  markAsSent: z.boolean().default(true),
});

/** Turns a ZodError into the single message the UI shows. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue?.message ?? 'Some fields are invalid.';
}
