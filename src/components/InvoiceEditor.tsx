'use client';

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
  FormControlLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type FocusEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import {
  addDays,
  digitsOnly,
  fetcher,
  formatDate,
  formatMoney,
  houseNumberChars,
  send,
  toDateInput,
  withoutDigits,
} from '@/lib/client';
import {
  CURRENCIES,
  MAX_MESSAGE_LENGTH,
  QR_LANGUAGES,
  deriveReference,
  formatReference,
  isQrIban,
  type ReferenceType,
} from '@/lib/qrbill';
import {
  UNIT_SUGGESTIONS,
  VAT_RATES,
  computeTotals,
  emptyExtraGroup,
  emptyGroup,
  emptyItem,
  emptySimpleItem,
  type InvoiceGroup,
  type InvoiceItem,
} from '@/lib/totals';
import { BOTTOM_BAR_HEIGHT } from './AppShell';
import { DecimalField, ErrorNote, Loading } from './ui';

interface PresetLineGroup {
  name: string;
  unit: string;
  unitPrice: number;
  vatRate: number;
}

interface Preset {
  _id: string;
  name: string;
  iban: string;
  currency: 'CHF' | 'EUR';
  qrLanguage: 'DE' | 'FR' | 'IT' | 'EN';
  referenceType: ReferenceType;
  paymentTermDays: number;
  defaultVatRate: number;
  vatIncluded: boolean;
  roundTo5Cents: boolean;
  isDefault: boolean;
  lineGroups: PresetLineGroup[];
}

interface ClientRecord {
  _id: string;
  name: string;
  email?: string;
  address: {
    street?: string;
    buildingNumber?: string;
    zip?: string;
    city?: string;
    country?: string;
  };
}

/** A logged work entry, as handed off from the entries page (see WorkEntryDoc). */
interface WorkEntryData {
  _id: string;
  presetId: string;
  clientId: string;
  groupName: string;
  unit: string;
  unitPrice: number;
  vatRate: number;
  quantity: number;
  note: string;
  entryDate: string;
}

interface FormState {
  presetId: string;
  clientId: string;
  number: string;
  issueDate: string;
  dueDate: string;
  currency: 'CHF' | 'EUR';
  qrLanguage: 'DE' | 'FR' | 'IT' | 'EN';
  referenceType: ReferenceType;
  referenceKey: string;
  debtor: {
    name: string;
    email: string;
    address: {
      street: string;
      buildingNumber: string;
      zip: string;
      city: string;
      country: string;
    };
  };
  groups: InvoiceGroup[];
  vatIncluded: boolean;
  discountPercent: number;
  roundTo5Cents: boolean;
  message: string;
  notes: string;
  /** Work entries this invoice was built from, billed once it's saved. */
  sourceEntryIds?: string[];
}

const blankForm = (): FormState => ({
  presetId: '',
  clientId: '',
  number: '',
  issueDate: toDateInput(new Date()),
  dueDate: toDateInput(addDays(new Date(), 30)),
  currency: 'CHF',
  qrLanguage: 'EN',
  referenceType: 'NON',
  referenceKey: '',
  debtor: {
    name: '',
    email: '',
    address: { street: '', buildingNumber: '', zip: '', city: '', country: 'CH' },
  },
  groups: [emptyGroup()],
  vatIncluded: false,
  discountPercent: 0,
  roundTo5Cents: false,
  message: '',
  notes: '',
});

// Mirrors the two-line "street / zip city" address block printed on the PDF,
// so the client card can preview it exactly as it will appear on the bill.
function addressLines(address: FormState['debtor']['address']): string[] {
  const street = [address.street, address.buildingNumber].filter(Boolean).join(' ');
  const city = [address.zip, address.city].filter(Boolean).join(' ');
  return [street, city].filter(Boolean);
}

function lineAmount(item: InvoiceItem, vatIncluded: boolean): number {
  const rate = Number(item.vatRate) || 0;
  const raw = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  return vatIncluded ? raw / (1 + rate / 100) : raw;
}

function TotalsRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography
        variant={emphasize ? 'subtitle1' : 'body2'}
        color={emphasize ? 'text.primary' : 'text.secondary'}
        fontWeight={emphasize ? 700 : 400}
      >
        {label}
      </Typography>
      <Typography
        variant={emphasize ? 'subtitle1' : 'body2'}
        fontWeight={emphasize ? 700 : 500}
        sx={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

// A number field's value is shown with a leading "0" placeholder; without
// this, typing at the start prepends onto it (e.g. "0" -> "50" instead of
// "5"). Selecting the existing content on focus makes the first keystroke
// replace it instead.
const selectOnFocus = (e: FocusEvent<HTMLInputElement>) => e.target.select();

// The page behaves like a single-page wizard: each section collapses to a
// one-line summary once the user moves on, and re-expanding it (its header,
// or the section itself) is how they go back to change it. Only one section
// is open at a time.
type StepId = 'settings' | 'client' | 'dates' | 'items' | 'message';
const STEP_ORDER: StepId[] = ['settings', 'client', 'dates', 'items', 'message'];
const nextStep = (id: StepId): StepId | null => STEP_ORDER[STEP_ORDER.indexOf(id) + 1] ?? null;

function Step({
  title,
  summary,
  active,
  onToggle,
  children,
}: {
  title: string;
  summary?: string;
  active: boolean;
  onToggle: (expanded: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Accordion expanded={active} onChange={(_e, expanded) => onToggle(expanded)} disableGutters>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{ '& .MuiAccordionSummary-content': { minWidth: 0 } }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 0.25, sm: 2 }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          sx={{ width: '100%', minWidth: 0, pr: 1 }}
        >
          <Typography variant="h6">{title}</Typography>
          {!active && summary && (
            <Typography variant="body2" color="text.secondary" noWrap sx={{ minWidth: 0, width: '100%' }}>
              {summary}
            </Typography>
          )}
        </Stack>
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  );
}

function ContinueButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
      <Button variant="outlined" onClick={onClick} disabled={disabled}>
        {t('common.continue')}
      </Button>
    </Stack>
  );
}

export default function InvoiceEditor({ invoiceId }: { invoiceId?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  // A batch of logged work entries handed off from the entries page, all
  // sharing one preset and client - seeds this invoice's groups instead of
  // the usual "one blank line per preset group" default.
  const fromEntriesIds = searchParams.get('fromEntries');
  const { data: presets } = useSWR<Preset[]>('/api/presets', fetcher);
  const { data: clients } = useSWR<ClientRecord[]>('/api/clients', fetcher);
  const { data: invoice, isLoading } = useSWR<Record<string, unknown>>(
    invoiceId ? `/api/invoices/${invoiceId}` : null,
    fetcher,
  );
  const { data: sourceEntries } = useSWR<WorkEntryData[]>(
    !invoiceId && fromEntriesIds ? `/api/entries?ids=${fromEntriesIds}` : null,
    fetcher,
  );

  const REFERENCE_LABEL: Record<ReferenceType, string> = {
    QRR: t('invoiceEditor.referenceLabel.QRR'),
    SCOR: t('invoiceEditor.referenceLabel.SCOR'),
    NON: t('invoiceEditor.referenceLabel.NON'),
  };

  const REFERENCE_ERROR_MESSAGE: Record<string, string> = {
    qrIbanRequired: t('invoiceEditor.referenceErrors.qrIbanRequired'),
    qrrOnQrIban: t('invoiceEditor.referenceErrors.qrrOnQrIban'),
    referenceKeyRequired: t('invoiceEditor.referenceErrors.referenceKeyRequired'),
  };

  const [form, setForm] = useState<FormState>(blankForm);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Wizard state: which section is currently expanded. An existing invoice
  // has every step already "done", so it loads fully collapsed; a new one
  // opens on the client step since the preset is already defaulted.
  const [activeSection, setActiveSection] = useState<StepId | null>(null);

  // Load an existing invoice into the form, or seed a new one from the
  // default preset so the common case needs no setup at all.
  useEffect(() => {
    if (ready) return;

    if (invoiceId) {
      if (!invoice) return;
      setForm({
        ...blankForm(),
        ...(invoice as unknown as FormState),
        presetId: String(invoice.presetId ?? ''),
        clientId: invoice.clientId ? String(invoice.clientId) : '',
        number: String(invoice.number ?? ''),
        issueDate: toDateInput(String(invoice.issueDate)),
        dueDate: toDateInput(String(invoice.dueDate)),
        referenceKey: '',
      });
      setReady(true);
      return;
    }

    if (fromEntriesIds) {
      if (!presets || !clients || !sourceEntries) return;
      if (sourceEntries.length === 0) {
        setError(t('invoiceEditor.entriesNotFound'));
        setReady(true);
        return;
      }
      const [first] = sourceEntries;
      const sameBatch = sourceEntries.every(
        (e) => e.presetId === first.presetId && e.clientId === first.clientId,
      );
      if (!sameBatch) {
        setError(t('invoiceEditor.entriesMismatch'));
        setReady(true);
        return;
      }
      const preset = presets.find((p) => p._id === first.presetId);
      if (!preset) {
        setError(t('invoiceEditor.presetGone'));
        setReady(true);
        return;
      }

      applyPreset(preset, true);
      pickClient(first.clientId);

      const byGroup = new Map<string, InvoiceGroup>();
      for (const entry of sourceEntries) {
        if (!byGroup.has(entry.groupName)) {
          byGroup.set(entry.groupName, { title: entry.groupName, showTitle: true, items: [] });
        }
        byGroup.get(entry.groupName)!.items.push({
          description: entry.note || `${entry.groupName} - ${formatDate(entry.entryDate)}`,
          quantity: entry.quantity,
          unit: entry.unit,
          unitPrice: entry.unitPrice,
          vatRate: entry.vatRate,
        });
      }
      update({
        groups: [...byGroup.values()],
        sourceEntryIds: sourceEntries.map((e) => e._id),
      });
      setReady(true);
      return;
    }

    if (!presets) return;
    const preset = presets.find((p) => p.isDefault) ?? presets[0];
    if (preset) applyPreset(preset, true);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice, invoiceId, presets, clients, sourceEntries, fromEntriesIds, ready]);

  // Once loaded, open the first step that still needs the user's attention.
  useEffect(() => {
    if (ready) setActiveSection(invoiceId || fromEntriesIds ? null : 'client');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const activePreset = useMemo(
    () => presets?.find((p) => p._id === form.presetId),
    [presets, form.presetId],
  );

  function applyPreset(preset: Preset, seedDates = false) {
    setForm((current) => ({
      ...current,
      presetId: preset._id,
      currency: preset.currency,
      qrLanguage: preset.qrLanguage,
      referenceType: preset.referenceType,
      vatIncluded: preset.vatIncluded,
      roundTo5Cents: preset.roundTo5Cents,
      dueDate: seedDates
        ? toDateInput(addDays(new Date(), preset.paymentTermDays ?? 30))
        : current.dueDate,
      // Every invoice starts with one group per standard category the preset
      // defines, pre-filled with that category's unit/price/VAT so only a
      // description and quantity are left to fill in.
      groups: seedDates
        ? preset.lineGroups.length > 0
          ? preset.lineGroups.map((g) => ({
              title: g.name,
              showTitle: true,
              items: [
                { description: '', quantity: 0, unit: g.unit, unitPrice: g.unitPrice, vatRate: g.vatRate },
              ],
            }))
          : [{ title: '', items: [{ ...emptyItem(), vatRate: preset.defaultVatRate ?? 0 }] }]
        : current.groups,
    }));
  }

  const totals = useMemo(
    () =>
      computeTotals(form.groups, {
        vatIncluded: form.vatIncluded,
        discountPercent: form.discountPercent,
        roundTo5Cents: form.roundTo5Cents,
      }),
    [form.groups, form.vatIncluded, form.discountPercent, form.roundTo5Cents],
  );

  const multipleGroups = form.groups.length > 1;
  const hasAdjustments =
    totals.discount > 0 || totals.vatByRate.length > 0 || totals.roundingAdjustment !== 0;

  // The reference is derived from the same helper the server uses, so an
  // invalid combination surfaces while typing rather than on save.
  const referencePreview = useMemo(() => {
    if (!activePreset) return { reference: '', errorCode: undefined as string | undefined };
    const seed = form.referenceKey || form.number.replace(/\D/g, '') || '0';
    return deriveReference(form.referenceType, activePreset.iban, seed);
  }, [activePreset, form.referenceType, form.referenceKey, form.number]);
  const referenceError = referencePreview.errorCode
    ? REFERENCE_ERROR_MESSAGE[referencePreview.errorCode]
    : undefined;

  // Surface the collapsed settings automatically if something in there needs attention.
  useEffect(() => {
    if (referenceError) setActiveSection('settings');
  }, [referenceError]);

  const settingsSummary = useMemo(() => {
    const parts = [
      activePreset?.name,
      form.currency,
      form.qrLanguage,
      REFERENCE_LABEL[form.referenceType],
      form.vatIncluded ? t('invoiceEditor.vatIncludedSummary') : t('invoiceEditor.vatExcludedSummary'),
    ];
    if (form.discountPercent) parts.push(t('invoiceEditor.discountSummary', { percent: form.discountPercent }));
    if (form.roundTo5Cents) parts.push(t('invoiceEditor.roundedSummary'));
    return parts.filter(Boolean).join(' · ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePreset, form.currency, form.qrLanguage, form.referenceType, form.vatIncluded, form.discountPercent, form.roundTo5Cents, t]);

  const debtorAddressLines = useMemo(
    () => addressLines(form.debtor.address),
    [form.debtor.address],
  );

  const clientSummary = useMemo(() => {
    if (!form.debtor.name) return t('invoiceEditor.noClientSelected');
    const cityLine = [form.debtor.address.zip, form.debtor.address.city].filter(Boolean).join(' ');
    return [form.debtor.name, cityLine].filter(Boolean).join(' · ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.debtor, t]);

  const datesSummary = useMemo(
    () =>
      [
        form.number || t('invoiceEditor.autoNumbered'),
        t('invoiceEditor.issuedOn', { date: formatDate(form.issueDate) }),
        t('invoiceEditor.dueOn', { date: formatDate(form.dueDate) }),
      ].join(' · '),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.number, form.issueDate, form.dueDate, t],
  );

  const itemsSummary = useMemo(() => {
    const lineCount = form.groups.reduce((sum, g) => sum + g.items.length, 0);
    return [
      t('invoiceEditor.groupsCount', { count: form.groups.length }),
      t('invoiceEditor.linesCount', { count: lineCount }),
      t('invoiceEditor.netAmount', { amount: formatMoney(totals.net, form.currency) }),
    ].join(' · ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.groups, totals.net, form.currency, t]);

  const messageSummary = useMemo(() => {
    if (!form.message && !form.notes) return t('invoiceEditor.noMessageOrNotes');
    return [
      form.message && t('invoiceEditor.slipMessage', { message: form.message }),
      form.notes && t('invoiceEditor.notesAdded'),
    ]
      .filter(Boolean)
      .join(' · ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.message, form.notes, t]);

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const hasExtraGroup = form.groups.some((group) => group.simpleItems);

  const addExtraGroup = () =>
    setForm((current) => ({ ...current, groups: [...current.groups, emptyExtraGroup()] }));

  const updateGroup = (index: number, patch: Partial<InvoiceGroup>) =>
    setForm((current) => ({
      ...current,
      groups: current.groups.map((group, i) => (i === index ? { ...group, ...patch } : group)),
    }));

  const updateItem = (groupIndex: number, itemIndex: number, patch: Record<string, unknown>) =>
    setForm((current) => ({
      ...current,
      groups: current.groups.map((group, gi) =>
        gi !== groupIndex
          ? group
          : {
              ...group,
              items: group.items.map((item, ii) =>
                ii === itemIndex ? { ...item, ...patch } : item,
              ),
            },
      ),
    }));

  // Unit, unit price and VAT are one setting per group: changing it here
  // applies to every line already in the group, and new lines inherit it.
  const groupSettings = (group: InvoiceGroup) => ({
    unit: group.items[0]?.unit ?? 'pcs',
    unitPrice: group.items[0]?.unitPrice ?? 0,
    vatRate: group.items[0]?.vatRate ?? activePreset?.defaultVatRate ?? 0,
  });

  const updateGroupSettings = (
    groupIndex: number,
    patch: { unit?: string; unitPrice?: number; vatRate?: number },
  ) =>
    setForm((current) => ({
      ...current,
      groups: current.groups.map((group, gi) =>
        gi !== groupIndex
          ? group
          : { ...group, items: group.items.map((item) => ({ ...item, ...patch })) },
      ),
    }));

  const pickClient = (clientId: string) => {
    const client = clients?.find((c) => c._id === clientId);
    if (!client) {
      // "One-off client" starts from a blank slate rather than keeping
      // whatever a previously-picked saved client had filled in.
      update({
        clientId: '',
        debtor: {
          name: '',
          email: '',
          address: { street: '', buildingNumber: '', zip: '', city: '', country: 'CH' },
        },
      });
      return;
    }
    update({
      clientId,
      debtor: {
        name: client.name ?? '',
        email: client.email ?? '',
        address: {
          street: client.address?.street ?? '',
          buildingNumber: client.address?.buildingNumber ?? '',
          zip: client.address?.zip ?? '',
          city: client.address?.city ?? '',
          country: client.address?.country || 'CH',
        },
      },
    });
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const payload = {
        ...form,
        clientId: form.clientId || null,
        number: form.number || undefined,
        discountPercent: Number(form.discountPercent) || 0,
      };
      const saved = invoiceId
        ? await send(`/api/invoices/${invoiceId}`, 'PATCH', payload)
        : await send('/api/invoices', 'POST', payload);
      router.push(`/invoices/${invoiceId ?? saved._id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invoiceEditor.couldNotBeSaved'));
    } finally {
      setBusy(false);
    }
  };

  if (invoiceId && isLoading) return <Loading label={t('invoiceEditor.loadingInvoice')} />;
  if (presets && presets.length === 0) {
    return (
      <Alert severity="info" action={<Button href="/settings/presets">{t('invoiceEditor.needsPresetAction')}</Button>}>
        {t('invoiceEditor.needsPresetTitle')}
      </Alert>
    );
  }

  return (
    <Stack spacing={3} sx={{ pb: { xs: `calc(96px + ${BOTTOM_BAR_HEIGHT}px)`, md: 12 } }}>
      <ErrorNote error={error} />

      <Step
        title={t('invoiceEditor.steps.settings')}
        summary={settingsSummary}
        active={activeSection === 'settings'}
        onToggle={(expanded) => setActiveSection(expanded ? 'settings' : null)}
      >
        <>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                label={t('invoiceEditor.preset')}
                value={form.presetId}
                onChange={(e) => {
                  const preset = presets?.find((p) => p._id === e.target.value);
                  if (preset) applyPreset(preset);
                }}
                fullWidth
              >
                {(presets ?? []).map((preset) => (
                  <MenuItem key={preset._id} value={preset._id}>
                    {preset.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                select
                label={t('invoiceEditor.currency')}
                value={form.currency}
                onChange={(e) => update({ currency: e.target.value as 'CHF' | 'EUR' })}
                fullWidth
              >
                {CURRENCIES.map((currency) => (
                  <MenuItem key={currency} value={currency}>
                    {currency}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                select
                label={t('invoiceEditor.billLanguage')}
                value={form.qrLanguage}
                onChange={(e) => update({ qrLanguage: e.target.value as FormState['qrLanguage'] })}
                helperText={t('invoiceEditor.billLanguageHelper')}
                fullWidth
              >
                {QR_LANGUAGES.map((language) => (
                  <MenuItem key={language} value={language}>
                    {language}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                label={t('invoiceEditor.referenceType')}
                value={form.referenceType}
                onChange={(e) => update({ referenceType: e.target.value as ReferenceType })}
                helperText={
                  activePreset && isQrIban(activePreset.iban)
                    ? t('invoiceEditor.referenceTypeHintQrIban')
                    : t('invoiceEditor.referenceTypeHintOther')
                }
                fullWidth
              >
                <MenuItem value="QRR">{t('invoiceEditor.referenceQrrOption')}</MenuItem>
                <MenuItem value="SCOR">{t('invoiceEditor.referenceScorOption')}</MenuItem>
                <MenuItem value="NON">{t('invoiceEditor.referenceNoneOption')}</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                label={t('invoiceEditor.referenceKey')}
                value={form.referenceKey}
                onChange={(e) => update({ referenceKey: e.target.value })}
                disabled={form.referenceType === 'NON'}
                helperText={
                  referenceError
                    ? referenceError
                    : referencePreview.reference
                      ? t('invoiceEditor.referenceKeyHelperValue', {
                          reference: formatReference(referencePreview.reference, form.referenceType),
                        })
                      : t('invoiceEditor.referenceKeyHelperDefault')
                }
                error={Boolean(referenceError)}
                fullWidth
              />
            </Grid>

            <Grid size={12}>
              <Divider />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <DecimalField
                label={t('invoiceEditor.discount')}
                value={form.discountPercent}
                onChange={(value) => update({ discountPercent: value })}
                onFocus={selectOnFocus}
                slotProps={{
                  input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.vatIncluded}
                    onChange={(e) => update({ vatIncluded: e.target.checked })}
                  />
                }
                label={t('invoiceEditor.pricesIncludeVat')}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.roundTo5Cents}
                    onChange={(e) => update({ roundTo5Cents: e.target.checked })}
                  />
                }
                label={t('invoiceEditor.roundTotal')}
              />
            </Grid>
          </Grid>
          <ContinueButton onClick={() => setActiveSection(nextStep('settings'))} />
        </>
      </Step>

      <Step
        title={t('invoiceEditor.steps.client')}
        summary={clientSummary}
        active={activeSection === 'client'}
        onToggle={(expanded) => setActiveSection(expanded ? 'client' : null)}
      >
        <>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                select
                label={t('invoiceEditor.savedClient')}
                value={form.clientId}
                onChange={(e) => pickClient(e.target.value)}
                helperText={t('invoiceEditor.savedClientHelper')}
                fullWidth
              >
                <MenuItem value="">{t('invoiceEditor.oneOffClient')}</MenuItem>
                {(clients ?? []).map((client) => (
                  <MenuItem key={client._id} value={client._id}>
                    {client.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label={t('invoiceEditor.name')}
                    value={form.debtor.name}
                    onChange={(e) => update({ debtor: { ...form.debtor, name: e.target.value } })}
                    required
                    fullWidth
                  />
                  <TextField
                    label={t('invoiceEditor.email')}
                    type="email"
                    value={form.debtor.email}
                    onChange={(e) =>
                      update({ debtor: { ...form.debtor, email: e.target.value } })
                    }
                    fullWidth
                  />
                </Stack>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 8, sm: 5 }}>
                    <TextField
                      label={t('invoiceEditor.street')}
                      value={form.debtor.address.street}
                      onChange={(e) =>
                        update({
                          debtor: {
                            ...form.debtor,
                            address: { ...form.debtor.address, street: e.target.value },
                          },
                        })
                      }
                      fullWidth
                    />
                  </Grid>
                  <Grid size={{ xs: 4, sm: 2 }}>
                    <TextField
                      label={t('invoiceEditor.buildingNumber')}
                      value={form.debtor.address.buildingNumber}
                      onChange={(e) =>
                        update({
                          debtor: {
                            ...form.debtor,
                            address: {
                              ...form.debtor.address,
                              buildingNumber: houseNumberChars(e.target.value),
                            },
                          },
                        })
                      }
                      fullWidth
                    />
                  </Grid>
                  <Grid size={{ xs: 4, sm: 2 }}>
                    <TextField
                      label={t('invoiceEditor.zip')}
                      value={form.debtor.address.zip}
                      onChange={(e) =>
                        update({
                          debtor: {
                            ...form.debtor,
                            address: { ...form.debtor.address, zip: digitsOnly(e.target.value, 4) },
                          },
                        })
                      }
                      slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 4 } }}
                      fullWidth
                    />
                  </Grid>
                  <Grid size={{ xs: 8, sm: 3 }}>
                    <TextField
                      label={t('invoiceEditor.city')}
                      value={form.debtor.address.city}
                      onChange={(e) =>
                        update({
                          debtor: {
                            ...form.debtor,
                            address: { ...form.debtor.address, city: withoutDigits(e.target.value) },
                          },
                        })
                      }
                      fullWidth
                    />
                  </Grid>
                </Grid>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Box
                sx={{
                  height: '100%',
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ textTransform: 'uppercase', letterSpacing: 1 }}
                >
                  {t('invoiceEditor.billedToLabel')}
                </Typography>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 1 }}>
                  {form.debtor.name || '—'}
                </Typography>
                {debtorAddressLines.length > 0 ? (
                  debtorAddressLines.map((line, i) => (
                    <Typography key={i} variant="body2" color="text.secondary">
                      {line}
                    </Typography>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('invoiceEditor.noAddressYet')}
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
          <ContinueButton
            onClick={() => setActiveSection(nextStep('client'))}
            disabled={!form.debtor.name}
          />
        </>
      </Step>

      <Step
        title={t('invoiceEditor.steps.dates')}
        summary={datesSummary}
        active={activeSection === 'dates'}
        onToggle={(expanded) => setActiveSection(expanded ? 'dates' : null)}
      >
        <>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label={t('invoiceEditor.invoiceNumber')}
                value={form.number}
                onChange={(e) => update({ number: e.target.value })}
                helperText={invoiceId ? undefined : t('invoiceEditor.invoiceNumberHelper')}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <TextField
                label={t('invoiceEditor.invoiceDate')}
                type="date"
                value={form.issueDate}
                onChange={(e) => update({ issueDate: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <TextField
                label={t('invoiceEditor.dueDate')}
                type="date"
                value={form.dueDate}
                onChange={(e) => update({ dueDate: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            </Grid>
          </Grid>
          <ContinueButton onClick={() => setActiveSection(nextStep('dates'))} />
        </>
      </Step>

      <Step
        title={t('invoiceEditor.steps.items')}
        summary={itemsSummary}
        active={activeSection === 'items'}
        onToggle={(expanded) => setActiveSection(expanded ? 'items' : null)}
      >
        <>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              {t('invoiceEditor.itemsIntro')}
            </Typography>
            {!hasExtraGroup && (
              <Button startIcon={<AddIcon />} onClick={addExtraGroup}>
                {t('invoiceEditor.addExtraGroup')}
              </Button>
            )}
          </Stack>

          <Stack spacing={3}>
            {form.groups.map((group, groupIndex) => {
              const settings = groupSettings(group);
              return (
                <Paper key={groupIndex} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 2 }}>
                    <TextField
                      label={t('invoiceEditor.groupTitle')}
                      placeholder={t('invoiceEditor.groupTitlePlaceholder')}
                      value={group.title}
                      onChange={(e) => updateGroup(groupIndex, { title: e.target.value })}
                      helperText={
                        group.showTitle === false ? t('invoiceEditor.groupTitleHiddenHelper') : undefined
                      }
                      fullWidth
                      slotProps={{
                        htmlInput: { style: { fontWeight: 700 } },
                      }}
                    />
                    <Tooltip
                      title={
                        group.showTitle === false
                          ? t('invoiceEditor.groupTitleTooltipHidden')
                          : t('invoiceEditor.groupTitleTooltipShown')
                      }
                    >
                      <IconButton
                        onClick={() =>
                          updateGroup(groupIndex, { showTitle: group.showTitle === false })
                        }
                        aria-label={
                          group.showTitle === false
                            ? t('invoiceEditor.showGroupTitle')
                            : t('invoiceEditor.hideGroupTitle')
                        }
                      >
                        {group.showTitle === false ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          groups: current.groups.filter((_, i) => i !== groupIndex),
                        }))
                      }
                      disabled={form.groups.length === 1}
                      aria-label={t('invoiceEditor.removeGroup')}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Stack>

                  {!group.simpleItems && (
                    <Grid container spacing={1.5} sx={{ mb: 2 }}>
                      <Grid size={{ xs: 4, md: 3 }}>
                        <TextField
                          label={t('invoiceEditor.unit')}
                          select
                          value={settings.unit}
                          onChange={(e) => updateGroupSettings(groupIndex, { unit: e.target.value })}
                          helperText={t('invoiceEditor.unitHelper')}
                          fullWidth
                        >
                          {[...new Set([settings.unit, ...UNIT_SUGGESTIONS])]
                            .filter(Boolean)
                            .map((unit) => (
                              <MenuItem key={unit} value={unit}>
                                {unit}
                              </MenuItem>
                            ))}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 4, md: 3 }}>
                        <DecimalField
                          label={t('invoiceEditor.unitPrice')}
                          value={settings.unitPrice}
                          onChange={(value) => updateGroupSettings(groupIndex, { unitPrice: value })}
                          onFocus={selectOnFocus}
                          helperText={t('invoiceEditor.unitHelper')}
                          fullWidth
                        />
                      </Grid>
                      <Grid size={{ xs: 4, md: 3 }}>
                        <TextField
                          label={t('invoiceEditor.vat')}
                          select
                          value={settings.vatRate}
                          onChange={(e) =>
                            updateGroupSettings(groupIndex, { vatRate: Number(e.target.value) })
                          }
                          helperText={t('invoiceEditor.unitHelper')}
                          fullWidth
                        >
                          {[...new Set([settings.vatRate, ...VAT_RATES])]
                            .sort((a, b) => a - b)
                            .map((rate) => (
                              <MenuItem key={rate} value={rate}>
                                {rate}%
                              </MenuItem>
                            ))}
                        </TextField>
                      </Grid>
                    </Grid>
                  )}

                  <Grid
                    container
                    spacing={1.5}
                    sx={{ display: { xs: 'none', sm: 'flex' }, px: 0.5, mb: 0.5 }}
                  >
                    <Grid size={{ sm: group.simpleItems ? 8 : 6 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
                      >
                        {t('invoiceEditor.descriptionHeader')}
                      </Typography>
                    </Grid>
                    {!group.simpleItems && (
                      <Grid size={{ sm: 2 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
                        >
                          {t('invoiceEditor.qtyHeader')}
                        </Typography>
                      </Grid>
                    )}
                    <Grid size={{ sm: 3 }} sx={{ textAlign: 'right' }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
                      >
                        {t('invoiceEditor.amountHeader')}
                      </Typography>
                    </Grid>
                    <Grid size={{ sm: 1 }} />
                  </Grid>

                  <Stack spacing={2} divider={<Divider flexItem />}>
                    {group.items.map((item, itemIndex) => (
                      <Grid container spacing={1.5} key={itemIndex} alignItems="center">
                        <Grid size={{ xs: 12, sm: group.simpleItems ? 8 : 6 }}>
                          <TextField
                            label={t('invoiceEditor.description')}
                            value={item.description}
                            onChange={(e) =>
                              updateItem(groupIndex, itemIndex, { description: e.target.value })
                            }
                            multiline
                            maxRows={4}
                            fullWidth
                          />
                        </Grid>
                        {group.simpleItems ? (
                          <Grid size={{ xs: 10, sm: 3 }}>
                            <DecimalField
                              label={t('invoiceEditor.amount')}
                              value={item.unitPrice}
                              onChange={(value) =>
                                updateItem(groupIndex, itemIndex, { unitPrice: value })
                              }
                              onFocus={selectOnFocus}
                              fullWidth
                            />
                          </Grid>
                        ) : (
                          <>
                            <Grid size={{ xs: 5, sm: 2 }}>
                              <DecimalField
                                label={t('invoiceEditor.quantity')}
                                value={item.quantity}
                                onChange={(value) =>
                                  updateItem(groupIndex, itemIndex, { quantity: value })
                                }
                                onFocus={selectOnFocus}
                                fullWidth
                              />
                            </Grid>
                            <Grid size={{ xs: 5, sm: 3 }} sx={{ textAlign: 'right' }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: { xs: 'block', sm: 'none' } }}
                              >
                                {t('invoiceEditor.amountHeader')}
                              </Typography>
                              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                {formatMoney(lineAmount(item, form.vatIncluded), form.currency)}
                              </Typography>
                            </Grid>
                          </>
                        )}
                        <Grid size={{ xs: 2, sm: 1 }} sx={{ textAlign: 'right' }}>
                          <IconButton
                            onClick={() =>
                              updateGroup(groupIndex, {
                                items: group.items.filter((_, i) => i !== itemIndex),
                              })
                            }
                            disabled={group.items.length === 1}
                            aria-label={t('invoiceEditor.removeLine')}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Grid>
                      </Grid>
                    ))}
                  </Stack>

                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mt: 2 }}
                  >
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() =>
                        updateGroup(groupIndex, {
                          items: [
                            ...group.items,
                            group.simpleItems ? emptySimpleItem() : { ...emptyItem(), ...settings },
                          ],
                        })
                      }
                    >
                      {t('invoiceEditor.addLine')}
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                      {t('invoiceEditor.groupSubtotal', {
                        amount: formatMoney(totals.groups[groupIndex]?.net ?? 0, form.currency),
                      })}
                    </Typography>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
          <ContinueButton onClick={() => setActiveSection(nextStep('items'))} />
        </>
      </Step>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('invoiceEditor.totalsTitle')}
          </Typography>
          <Stack spacing={1} sx={{ maxWidth: 380, ml: 'auto' }}>
            {multipleGroups &&
              totals.groups.map((group, i) => (
                <TotalsRow
                  key={i}
                  label={
                    group.title && group.showTitle
                      ? t('invoiceEditor.subtotalWithTitle', { title: group.title })
                      : t('invoiceEditor.subtotal')
                  }
                  value={formatMoney(group.net, form.currency)}
                />
              ))}
            {hasAdjustments && (
              <TotalsRow label={t('invoiceEditor.subtotal')} value={formatMoney(totals.net, form.currency)} />
            )}
            {totals.discount > 0 && (
              <>
                <TotalsRow
                  label={t('invoiceEditor.discountWithPercent', { percent: form.discountPercent })}
                  value={`- ${formatMoney(totals.discount, form.currency)}`}
                />
                <TotalsRow
                  label={t('invoiceEditor.netTotal')}
                  value={formatMoney(totals.netAfterDiscount, form.currency)}
                />
              </>
            )}
            {totals.vatByRate.map((vat, i) => (
              <TotalsRow
                key={i}
                label={t('invoiceEditor.vatWithRate', {
                  rate: vat.rate,
                  base: formatMoney(vat.base, form.currency),
                })}
                value={formatMoney(vat.amount, form.currency)}
              />
            ))}
            {totals.roundingAdjustment !== 0 && (
              <TotalsRow label={t('invoiceEditor.rounding')} value={formatMoney(totals.roundingAdjustment, form.currency)} />
            )}
            <Divider />
            <TotalsRow label={t('invoiceEditor.total')} value={formatMoney(totals.total, form.currency)} emphasize />
          </Stack>
        </CardContent>
      </Card>

      <Step
        title={t('invoiceEditor.steps.message')}
        summary={messageSummary}
        active={activeSection === 'message'}
        onToggle={(expanded) => setActiveSection(expanded ? 'message' : null)}
      >
        <>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                label={t('invoiceEditor.messageOnSlip')}
                value={form.message}
                onChange={(e) => update({ message: e.target.value.slice(0, MAX_MESSAGE_LENGTH) })}
                helperText={t('invoiceEditor.messageOnSlipHelper', {
                  length: form.message.length,
                  max: MAX_MESSAGE_LENGTH,
                })}
                fullWidth
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label={t('invoiceEditor.notes')}
                value={form.notes}
                onChange={(e) => update({ notes: e.target.value })}
                multiline
                minRows={2}
                fullWidth
              />
            </Grid>
          </Grid>
        </>
      </Step>

      <Paper
        elevation={3}
        sx={{
          position: 'fixed',
          bottom: { xs: `${BOTTOM_BAR_HEIGHT}px`, md: 0 },
          left: { xs: 0, md: '232px' },
          right: 0,
          p: 2,
          borderRadius: 0,
          borderTop: 1,
          borderColor: 'divider',
          zIndex: (theme) => theme.zIndex.appBar,
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
          sx={{ maxWidth: 1100, mx: 'auto' }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t('invoiceEditor.totalInclVat')}
            </Typography>
            <Typography variant="h6" lineHeight={1.2}>
              {formatMoney(totals.total, form.currency)}
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            onClick={save}
            disabled={busy || Boolean(referenceError) || !form.debtor.name}
          >
            {busy ? t('common.saving') : invoiceId ? t('invoiceEditor.saveChanges') : t('invoiceEditor.createInvoice')}
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
