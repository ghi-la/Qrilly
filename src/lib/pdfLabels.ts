import type { QrLanguage } from './qrbill';

export interface PdfLabels {
  invoice: string;
  invoiceNo: string;
  issueDate: string;
  dueDate: string;
  vatNumber: string;
  billedTo: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  vat: string;
  amount: string;
  subtotal: string;
  groupSubtotal: string;
  discount: string;
  net: string;
  vatTotal: string;
  rounding: string;
  total: string;
  reference: string;
  account: string;
  notes: string;
  page: string;
  of: string;
}

/** PDF wording follows the same language as the QR slip underneath it. */
const LABELS: Record<QrLanguage, PdfLabels> = {
  EN: {
    invoice: 'Invoice',
    invoiceNo: 'Invoice no.',
    issueDate: 'Invoice date',
    dueDate: 'Due date',
    vatNumber: 'VAT no.',
    billedTo: 'Billed to',
    description: 'Description',
    quantity: 'Qty',
    unit: 'Unit',
    unitPrice: 'Unit price',
    vat: 'VAT',
    amount: 'Amount',
    subtotal: 'Subtotal',
    groupSubtotal: 'Subtotal',
    discount: 'Discount',
    net: 'Net total',
    vatTotal: 'VAT',
    rounding: 'Rounding',
    total: 'Total',
    reference: 'Reference',
    account: 'Account',
    notes: 'Notes',
    page: 'Page',
    of: 'of',
  },
  DE: {
    invoice: 'Rechnung',
    invoiceNo: 'Rechnungsnr.',
    issueDate: 'Rechnungsdatum',
    dueDate: 'Fällig am',
    vatNumber: 'MWST-Nr.',
    billedTo: 'Rechnung an',
    description: 'Bezeichnung',
    quantity: 'Menge',
    unit: 'Einheit',
    unitPrice: 'Preis',
    vat: 'MWST',
    amount: 'Betrag',
    subtotal: 'Zwischentotal',
    groupSubtotal: 'Zwischentotal',
    discount: 'Rabatt',
    net: 'Nettototal',
    vatTotal: 'MWST',
    rounding: 'Rundung',
    total: 'Total',
    reference: 'Referenz',
    account: 'Konto',
    notes: 'Bemerkungen',
    page: 'Seite',
    of: 'von',
  },
  FR: {
    invoice: 'Facture',
    invoiceNo: 'Facture n°',
    issueDate: 'Date de facture',
    dueDate: 'Échéance',
    vatNumber: 'N° TVA',
    billedTo: 'Facturé à',
    description: 'Désignation',
    quantity: 'Qté',
    unit: 'Unité',
    unitPrice: 'Prix unit.',
    vat: 'TVA',
    amount: 'Montant',
    subtotal: 'Sous-total',
    groupSubtotal: 'Sous-total',
    discount: 'Remise',
    net: 'Total net',
    vatTotal: 'TVA',
    rounding: 'Arrondi',
    total: 'Total',
    reference: 'Référence',
    account: 'Compte',
    notes: 'Remarques',
    page: 'Page',
    of: 'sur',
  },
  IT: {
    invoice: 'Fattura',
    invoiceNo: 'Fattura n.',
    issueDate: 'Data fattura',
    dueDate: 'Scadenza',
    vatNumber: 'N. IVA',
    billedTo: 'Fatturato a',
    description: 'Descrizione',
    quantity: 'Qtà',
    unit: 'Unità',
    unitPrice: 'Prezzo unit.',
    vat: 'IVA',
    amount: 'Importo',
    subtotal: 'Subtotale',
    groupSubtotal: 'Subtotale',
    discount: 'Sconto',
    net: 'Totale netto',
    vatTotal: 'IVA',
    rounding: 'Arrotondamento',
    total: 'Totale',
    reference: 'Riferimento',
    account: 'Conto',
    notes: 'Note',
    page: 'Pagina',
    of: 'di',
  },
};

export const labelsFor = (language: QrLanguage): PdfLabels => LABELS[language] ?? LABELS.EN;
