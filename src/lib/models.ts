import mongoose, { Schema, model, models } from 'mongoose';
import type { Currency, QrLanguage, ReferenceType } from './qrbill';
import type { InvoiceGroup } from './totals';

/* ------------------------------------------------------------------ types */

export interface Address {
  street: string;
  buildingNumber: string;
  zip: string;
  city: string;
  country: string;
}

export interface Party {
  name: string;
  email?: string;
  address: Address;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'canceled';

export interface UserDoc {
  name?: string;
  email: string;
  passwordHash: string;
  encDekMaster?: string;
  encDekMasterIv?: string;
  emailVerified: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpires?: Date;
  emailVerificationSentAt?: Date;
  locale?: string;
  /** App-wide language; also the default language for newly created presets. */
  language: QrLanguage;
}

export interface FileAssetDoc {
  userId: mongoose.Types.ObjectId;
  name?: string;
  mime: string;
  size: number;
  /** base64 - see the note on the schema below. */
  data: string;
}

export interface PresetDoc {
  userId: mongoose.Types.ObjectId;
  name: string;
  isDefault: boolean;
  creditor: Party;
  iban: string;
  vatNumber: string;
  phone: string;
  website: string;
  logoFileId?: mongoose.Types.ObjectId | null;
  referenceType: ReferenceType;
  currency: Currency;
  qrLanguage: QrLanguage;
  invoicePrefix: string;
  nextNumber: number;
  paymentTermDays: number;
  defaultVatRate: number;
  vatIncluded: boolean;
  roundTo5Cents: boolean;
  footerNote: string;
  emailSubject: string;
  emailBody: string;
}

export interface ClientDoc {
  userId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  address: Address;
  notes: string;
  encVersion: number;
}

export interface InvoiceDoc {
  userId: mongoose.Types.ObjectId;
  presetId: mongoose.Types.ObjectId;
  clientId?: mongoose.Types.ObjectId | null;
  number: string;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  creditor: Party;
  debtor: Party;
  iban: string;
  vatNumber: string;
  logoFileId?: mongoose.Types.ObjectId | null;
  footerNote: string;
  referenceType: ReferenceType;
  reference: string;
  currency: Currency;
  qrLanguage: QrLanguage;
  groups: InvoiceGroup[];
  vatIncluded: boolean;
  discountPercent: number;
  roundTo5Cents: boolean;
  message: string;
  notes: string;
  totals: { net: number; vatTotal: number; total: number };
  sentAt?: Date;
  sentTo: string[];
  paidAt?: Date;
  encVersion: number;
}

/* ---------------------------------------------------------------- schemas */

const AddressSchema = new Schema<Address>(
  {
    street: { type: String, default: '' },
    buildingNumber: { type: String, default: '' },
    zip: { type: String, default: '' },
    city: { type: String, default: '' },
    country: { type: String, default: 'CH' },
  },
  { _id: false },
);

const PartySchema = new Schema<Party>(
  {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: AddressSchema, default: () => ({}) },
  },
  { _id: false },
);

const ItemSchema = new Schema(
  {
    description: { type: String, default: '' },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: '' },
    unitPrice: { type: Number, default: 0 },
    vatRate: { type: Number, default: 0 },
  },
  { _id: false },
);

const GroupSchema = new Schema(
  {
    title: { type: String, default: '' },
    showTitle: { type: Boolean, default: true },
    items: { type: [ItemSchema], default: [] },
  },
  { _id: false },
);

const UserSchema = new Schema<UserDoc>(
  {
    name: String,
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    // Envelope encryption key material - see lib/serverCrypto.ts.
    encDekMaster: String,
    encDekMasterIv: String,

    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: String,
    emailVerificationExpires: Date,
    emailVerificationSentAt: Date,

    locale: { type: String, default: 'en-CH' },
    language: { type: String, enum: ['DE', 'FR', 'IT', 'EN'], default: 'EN' },
  },
  { timestamps: true },
);

/**
 * Logos live in their own collection rather than on the preset, so an invoice
 * can pin the exact logo it was issued with. Files are immutable: replacing a
 * logo creates a new document and leaves old invoices pointing at the old one.
 */
const FileAssetSchema = new Schema<FileAssetDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: String,
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: String, required: true },
  },
  { timestamps: true },
);

/** A reusable sender profile: who is billing, from which account, with what defaults. */
const PresetSchema = new Schema<PresetDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    isDefault: { type: Boolean, default: false },

    creditor: { type: PartySchema, default: () => ({}) },
    iban: { type: String, required: true },
    vatNumber: { type: String, default: '' },
    phone: { type: String, default: '' },
    website: { type: String, default: '' },
    logoFileId: { type: Schema.Types.ObjectId, ref: 'FileAsset', default: null },

    referenceType: { type: String, enum: ['QRR', 'SCOR', 'NON'], default: 'NON' },
    currency: { type: String, enum: ['CHF', 'EUR'], default: 'CHF' },
    qrLanguage: { type: String, enum: ['DE', 'FR', 'IT', 'EN'], default: 'EN' },

    invoicePrefix: { type: String, default: '' },
    nextNumber: { type: Number, default: 1 },
    paymentTermDays: { type: Number, default: 30 },
    defaultVatRate: { type: Number, default: 8.1 },
    vatIncluded: { type: Boolean, default: false },
    roundTo5Cents: { type: Boolean, default: false },
    footerNote: { type: String, default: '' },

    emailSubject: { type: String, default: 'Invoice {{number}} from {{creditor}}' },
    emailBody: {
      type: String,
      default:
        'Dear {{client}},\n\nPlease find invoice {{number}} attached, for {{total}}, due on {{dueDate}}.\n\nKind regards,\n{{creditor}}',
    },
  },
  { timestamps: true },
);

const ClientSchema = new Schema<ClientDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: AddressSchema, default: () => ({}) },
    notes: { type: String, default: '' },
    encVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

/**
 * Everything needed to re-render the PDF, and nothing that is the PDF itself:
 * parties, lines, reference and layout choices are all stored as data and the
 * document is rebuilt on every download.
 */
const InvoiceSchema = new Schema<InvoiceDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    presetId: { type: Schema.Types.ObjectId, ref: 'Preset', required: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', default: null },

    number: { type: String, required: true },
    status: { type: String, enum: ['draft', 'sent', 'paid', 'canceled'], default: 'draft' },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },

    // Snapshots, not references: a preset edited next year must not silently
    // rewrite the address a past invoice was issued under.
    creditor: { type: PartySchema, default: () => ({}) },
    debtor: { type: PartySchema, default: () => ({}) },
    iban: { type: String, required: true },
    vatNumber: { type: String, default: '' },
    logoFileId: { type: Schema.Types.ObjectId, ref: 'FileAsset', default: null },
    footerNote: { type: String, default: '' },

    referenceType: { type: String, enum: ['QRR', 'SCOR', 'NON'], default: 'NON' },
    reference: { type: String, default: '' },
    currency: { type: String, enum: ['CHF', 'EUR'], default: 'CHF' },
    qrLanguage: { type: String, enum: ['DE', 'FR', 'IT', 'EN'], default: 'EN' },

    groups: { type: [GroupSchema], default: [] },
    vatIncluded: { type: Boolean, default: false },
    discountPercent: { type: Number, default: 0 },
    roundTo5Cents: { type: Boolean, default: false },
    message: { type: String, default: '' },
    notes: { type: String, default: '' },

    // Denormalised for list views and the dashboard; recomputed on every save
    // from the line items, which remain the source of truth.
    totals: {
      net: { type: Number, default: 0 },
      vatTotal: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },

    sentAt: Date,
    sentTo: { type: [String], default: [] },
    paidAt: Date,

    encVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

InvoiceSchema.index({ userId: 1, number: 1 }, { unique: true });
InvoiceSchema.index({ userId: 1, issueDate: -1 });

// `models.X ??` keeps hot reload from redefining a model that already exists.
export const User = (models.User as mongoose.Model<UserDoc>) ?? model<UserDoc>('User', UserSchema);
export const FileAsset =
  (models.FileAsset as mongoose.Model<FileAssetDoc>) ??
  model<FileAssetDoc>('FileAsset', FileAssetSchema);
export const Preset =
  (models.Preset as mongoose.Model<PresetDoc>) ?? model<PresetDoc>('Preset', PresetSchema);
export const Client =
  (models.Client as mongoose.Model<ClientDoc>) ?? model<ClientDoc>('Client', ClientSchema);
export const Invoice =
  (models.Invoice as mongoose.Model<InvoiceDoc>) ?? model<InvoiceDoc>('Invoice', InvoiceSchema);

export type { Currency, QrLanguage, ReferenceType };
