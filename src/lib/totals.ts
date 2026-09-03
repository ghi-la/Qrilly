/**
 * Money maths for an invoice. Shared by the editor (live preview) and the PDF
 * renderer, so what the user sees while typing is exactly what gets printed.
 *
 * An invoice is a list of *groups*, each with its own line items, so a job can
 * mix "consulting, 8 h at 150.-" with "travel, 220 km at 0.70/km" and still
 * subtotal sensibly.
 */

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
}

export interface InvoiceGroup {
  title: string;
  /** Whether the title prints on the invoice; defaults to true when unset. */
  showTitle?: boolean;
  /**
   * Flat "bonus" items: just a description and an amount, no unit/quantity/VAT
   * breakdown. Used for the ad-hoc "Extra" group, as opposed to a group whose
   * unit price and VAT rate come from a business preset.
   */
  simpleItems?: boolean;
  items: InvoiceItem[];
}

export interface TotalsOptions {
  /** True when unit prices already include VAT. */
  vatIncluded?: boolean;
  /** Percentage taken off the net total before VAT (0 = none). */
  discountPercent?: number;
  /** Swiss cash rounding of the grand total to the nearest 0.05. */
  roundTo5Cents?: boolean;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round5Cents = (n: number) => Math.round(n * 20) / 20;

/** Common Swiss VAT rates; the field is free-form so historical rates still work. */
export const VAT_RATES = [0, 2.6, 3.8, 8.1];

export const UNIT_SUGGESTIONS = ['h', 'day', 'pcs', 'km', 'kg', 'm²', 'flat rate'];

export interface Totals {
  groups: { title: string; showTitle: boolean; net: number }[];
  net: number;
  discount: number;
  netAfterDiscount: number;
  vatByRate: { rate: number; base: number; amount: number }[];
  vatTotal: number;
  gross: number;
  roundingAdjustment: number;
  total: number;
}

export function computeTotals(groups: InvoiceGroup[], options: TotalsOptions = {}): Totals {
  const { vatIncluded = false, discountPercent = 0, roundTo5Cents = false } = options;

  const groupTotals: { title: string; showTitle: boolean; net: number }[] = [];
  const baseByRate = new Map<number, number>();
  let net = 0;

  for (const group of groups ?? []) {
    let groupNet = 0;
    for (const item of group.items ?? []) {
      const rate = Number(item.vatRate) || 0;
      const raw = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      // With VAT-inclusive pricing the typed amount is the gross, so the net
      // has to be backed out before it can join the subtotal.
      const lineNet = vatIncluded ? raw / (1 + rate / 100) : raw;
      groupNet += lineNet;
      baseByRate.set(rate, (baseByRate.get(rate) ?? 0) + lineNet);
    }
    net += groupNet;
    groupTotals.push({
      title: group.title,
      showTitle: group.showTitle ?? true,
      net: round2(groupNet),
    });
  }

  const discountFactor = discountPercent > 0 ? 1 - discountPercent / 100 : 1;
  const discount = round2(net * (1 - discountFactor));
  const netAfterDiscount = round2(net - discount);

  // A discount reduces every rate's taxable base proportionally.
  const vatByRate = [...baseByRate.entries()]
    .filter(([rate, base]) => rate > 0 && Math.abs(base) > 0.0001)
    .sort((a, b) => a[0] - b[0])
    .map(([rate, base]) => {
      const discountedBase = round2(base * discountFactor);
      return { rate, base: discountedBase, amount: round2((discountedBase * rate) / 100) };
    });

  const vatTotal = round2(vatByRate.reduce((sum, v) => sum + v.amount, 0));
  const gross = round2(netAfterDiscount + vatTotal);
  const total = roundTo5Cents ? round5Cents(gross) : gross;

  return {
    groups: groupTotals,
    net: round2(net),
    discount,
    netAfterDiscount,
    vatByRate,
    vatTotal,
    gross,
    roundingAdjustment: round2(total - gross),
    total,
  };
}

export const emptyItem = (): InvoiceItem => ({
  description: '',
  quantity: 0,
  unit: 'pcs',
  unitPrice: 0,
  vatRate: 8.1,
});

export const emptyGroup = (): InvoiceGroup => ({
  title: '',
  showTitle: true,
  items: [emptyItem()],
});

/** Always offered alongside a preset's own groups, for anything that doesn't fit. */
export const EXTRA_GROUP_TITLE = 'Extra';

export const emptySimpleItem = (): InvoiceItem => ({
  description: '',
  quantity: 1,
  unit: '',
  unitPrice: 0,
  vatRate: 0,
});

export const emptyExtraGroup = (): InvoiceGroup => ({
  title: EXTRA_GROUP_TITLE,
  showTitle: true,
  simpleItems: true,
  items: [emptySimpleItem()],
});
