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
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FocusEvent, type ReactNode } from 'react';
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
  emptyGroup,
  emptyItem,
  type InvoiceGroup,
  type InvoiceItem,
} from '@/lib/totals';
import { ErrorNote, Loading } from './ui';

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

const REFERENCE_LABEL: Record<ReferenceType, string> = {
  QRR: 'QRR reference',
  SCOR: 'SCOR reference',
  NON: 'no reference',
};

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
  return (
    <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
      <Button variant="outlined" onClick={onClick} disabled={disabled}>
        Continue
      </Button>
    </Stack>
  );
}

export default function InvoiceEditor({ invoiceId }: { invoiceId?: string }) {
  const router = useRouter();
  const { data: presets } = useSWR<Preset[]>('/api/presets', fetcher);
  const { data: clients } = useSWR<ClientRecord[]>('/api/clients', fetcher);
  const { data: invoice, isLoading } = useSWR<Record<string, unknown>>(
    invoiceId ? `/api/invoices/${invoiceId}` : null,
    fetcher,
  );

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

    if (!presets) return;
    const preset = presets.find((p) => p.isDefault) ?? presets[0];
    if (preset) applyPreset(preset, true);
    setReady(true);
  }, [invoice, invoiceId, presets, ready]);

  // Once loaded, open the first step that still needs the user's attention.
  useEffect(() => {
    if (ready) setActiveSection(invoiceId ? null : 'client');
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
      groups: seedDates
        ? [{ title: '', items: [{ ...emptyItem(), vatRate: preset.defaultVatRate ?? 0 }] }]
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
    if (!activePreset) return { reference: '', error: undefined as string | undefined };
    const seed = form.referenceKey || form.number.replace(/\D/g, '') || '0';
    return deriveReference(form.referenceType, activePreset.iban, seed);
  }, [activePreset, form.referenceType, form.referenceKey, form.number]);

  // Surface the collapsed settings automatically if something in there needs attention.
  useEffect(() => {
    if (referencePreview.error) setActiveSection('settings');
  }, [referencePreview.error]);

  const settingsSummary = useMemo(() => {
    const parts = [
      activePreset?.name,
      form.currency,
      form.qrLanguage,
      REFERENCE_LABEL[form.referenceType],
      form.vatIncluded ? 'VAT incl.' : 'VAT excl.',
    ];
    if (form.discountPercent) parts.push(`${form.discountPercent}% discount`);
    if (form.roundTo5Cents) parts.push('rounded to 0.05');
    return parts.filter(Boolean).join(' · ');
  }, [activePreset, form.currency, form.qrLanguage, form.referenceType, form.vatIncluded, form.discountPercent, form.roundTo5Cents]);

  const debtorAddressLines = useMemo(
    () => addressLines(form.debtor.address),
    [form.debtor.address],
  );

  const clientSummary = useMemo(() => {
    if (!form.debtor.name) return 'No client selected yet';
    const cityLine = [form.debtor.address.zip, form.debtor.address.city].filter(Boolean).join(' ');
    return [form.debtor.name, cityLine].filter(Boolean).join(' · ');
  }, [form.debtor]);

  const datesSummary = useMemo(
    () =>
      `${form.number || '(auto-numbered)'} · issued ${formatDate(form.issueDate)} · due ${formatDate(form.dueDate)}`,
    [form.number, form.issueDate, form.dueDate],
  );

  const itemsSummary = useMemo(() => {
    const lineCount = form.groups.reduce((sum, g) => sum + g.items.length, 0);
    const groupWord = form.groups.length === 1 ? 'group' : 'groups';
    const lineWord = lineCount === 1 ? 'line' : 'lines';
    return `${form.groups.length} ${groupWord} · ${lineCount} ${lineWord} · ${formatMoney(totals.net, form.currency)} net`;
  }, [form.groups, totals.net, form.currency]);

  const messageSummary = useMemo(() => {
    if (!form.message && !form.notes) return 'No message or notes';
    return [form.message && `Slip: "${form.message}"`, form.notes && 'Notes added']
      .filter(Boolean)
      .join(' · ');
  }, [form.message, form.notes]);

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

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
      setError(err instanceof Error ? err.message : 'The invoice could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  if (invoiceId && isLoading) return <Loading label="Loading invoice..." />;
  if (presets && presets.length === 0) {
    return (
      <Alert severity="info" action={<Button href="/presets">Create one</Button>}>
        Create a sender preset first - it holds the IBAN and address every invoice is issued from.
      </Alert>
    );
  }

  return (
    <Stack spacing={3} sx={{ pb: 12 }}>
      <ErrorNote error={error} />

      <Step
        title="Payment & invoice settings"
        summary={settingsSummary}
        active={activeSection === 'settings'}
        onToggle={(expanded) => setActiveSection(expanded ? 'settings' : null)}
      >
        <>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                label="Preset"
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
                label="Currency"
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
                label="Bill language"
                value={form.qrLanguage}
                onChange={(e) => update({ qrLanguage: e.target.value as FormState['qrLanguage'] })}
                helperText="Defaults to the preset's language; change it per invoice if needed."
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
                label="Reference type"
                value={form.referenceType}
                onChange={(e) => update({ referenceType: e.target.value as ReferenceType })}
                helperText={
                  activePreset && isQrIban(activePreset.iban)
                    ? 'This preset uses a QR-IBAN, so QRR is required.'
                    : 'QR-IBAN accounts need QRR; ordinary IBANs take SCOR or none.'
                }
                fullWidth
              >
                <MenuItem value="QRR">QRR - QR reference</MenuItem>
                <MenuItem value="SCOR">SCOR - creditor reference</MenuItem>
                <MenuItem value="NON">No reference</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                label="Reference key (optional)"
                value={form.referenceKey}
                onChange={(e) => update({ referenceKey: e.target.value })}
                disabled={form.referenceType === 'NON'}
                helperText={
                  referencePreview.error
                    ? referencePreview.error
                    : referencePreview.reference
                      ? `Reference: ${formatReference(referencePreview.reference, form.referenceType)}`
                      : 'Left empty, the invoice number is used as the key.'
                }
                error={Boolean(referencePreview.error)}
                fullWidth
              />
            </Grid>

            <Grid size={12}>
              <Divider />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Discount"
                type="number"
                value={form.discountPercent}
                onChange={(e) => update({ discountPercent: Number(e.target.value) })}
                onFocus={selectOnFocus}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
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
                label="Prices include VAT"
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
                label="Round total to 0.05"
              />
            </Grid>
          </Grid>
          <ContinueButton onClick={() => setActiveSection(nextStep('settings'))} />
        </>
      </Step>

      <Step
        title="Client"
        summary={clientSummary}
        active={activeSection === 'client'}
        onToggle={(expanded) => setActiveSection(expanded ? 'client' : null)}
      >
        <>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                select
                label="Saved client"
                value={form.clientId}
                onChange={(e) => pickClient(e.target.value)}
                helperText="Pick one to fill the address, or type it in below."
                fullWidth
              >
                <MenuItem value="">One-off client</MenuItem>
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
                    label="Name"
                    value={form.debtor.name}
                    onChange={(e) => update({ debtor: { ...form.debtor, name: e.target.value } })}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Email"
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
                      label="Street"
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
                      label="No."
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
                      label="ZIP"
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
                      label="City"
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
                  Billed to - as printed on the invoice
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
                    No address yet
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
        title="Dates and numbering"
        summary={datesSummary}
        active={activeSection === 'dates'}
        onToggle={(expanded) => setActiveSection(expanded ? 'dates' : null)}
      >
        <>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Invoice number"
                value={form.number}
                onChange={(e) => update({ number: e.target.value })}
                helperText={invoiceId ? undefined : 'Leave empty to use the preset sequence.'}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <TextField
                label="Invoice date"
                type="date"
                value={form.issueDate}
                onChange={(e) => update({ issueDate: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <TextField
                label="Due date"
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
        title="Line items"
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
              Add lines, grouped by rate or job.
            </Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={() => update({ groups: [...form.groups, emptyGroup()] })}
            >
              Add group
            </Button>
          </Stack>

          <Stack spacing={3}>
            {form.groups.map((group, groupIndex) => {
              const settings = groupSettings(group);
              return (
                <Paper key={groupIndex} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 2 }}>
                    <TextField
                      label="Group title"
                      placeholder="e.g. Consulting, Travel, Materials"
                      value={group.title}
                      onChange={(e) => updateGroup(groupIndex, { title: e.target.value })}
                      helperText={
                        group.showTitle === false
                          ? 'Hidden from the invoice - only used to organize lines here.'
                          : undefined
                      }
                      fullWidth
                      slotProps={{
                        htmlInput: { style: { fontWeight: 700 } },
                      }}
                    />
                    <Tooltip
                      title={
                        group.showTitle === false
                          ? 'Title hidden from the invoice - click to show it'
                          : 'Title shown on the invoice - click to hide it'
                      }
                    >
                      <IconButton
                        onClick={() =>
                          updateGroup(groupIndex, { showTitle: group.showTitle === false })
                        }
                        aria-label={
                          group.showTitle === false
                            ? 'Show group title on invoice'
                            : 'Hide group title on invoice'
                        }
                      >
                        {group.showTitle === false ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      onClick={() =>
                        update({ groups: form.groups.filter((_, i) => i !== groupIndex) })
                      }
                      disabled={form.groups.length === 1}
                      aria-label="Remove group"
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Stack>

                  <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 4, md: 3 }}>
                      <TextField
                        label="Unit"
                        select
                        value={settings.unit}
                        onChange={(e) => updateGroupSettings(groupIndex, { unit: e.target.value })}
                        helperText="Applies to every line in this group"
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
                      <TextField
                        label="Unit price"
                        type="number"
                        value={settings.unitPrice}
                        onChange={(e) =>
                          updateGroupSettings(groupIndex, { unitPrice: Number(e.target.value) })
                        }
                        onFocus={selectOnFocus}
                        helperText="Applies to every line in this group"
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 4, md: 3 }}>
                      <TextField
                        label="VAT"
                        select
                        value={settings.vatRate}
                        onChange={(e) =>
                          updateGroupSettings(groupIndex, { vatRate: Number(e.target.value) })
                        }
                        helperText="Applies to every line in this group"
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

                  <Grid
                    container
                    spacing={1.5}
                    sx={{ display: { xs: 'none', sm: 'flex' }, px: 0.5, mb: 0.5 }}
                  >
                    <Grid size={{ sm: 6 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
                      >
                        Description
                      </Typography>
                    </Grid>
                    <Grid size={{ sm: 2 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
                      >
                        Qty
                      </Typography>
                    </Grid>
                    <Grid size={{ sm: 3 }} sx={{ textAlign: 'right' }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
                      >
                        Amount
                      </Typography>
                    </Grid>
                    <Grid size={{ sm: 1 }} />
                  </Grid>

                  <Stack spacing={2} divider={<Divider flexItem />}>
                    {group.items.map((item, itemIndex) => (
                      <Grid container spacing={1.5} key={itemIndex} alignItems="center">
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            label="Description"
                            value={item.description}
                            onChange={(e) =>
                              updateItem(groupIndex, itemIndex, { description: e.target.value })
                            }
                            multiline
                            maxRows={4}
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 5, sm: 2 }}>
                          <TextField
                            label="Qty"
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(groupIndex, itemIndex, {
                                quantity: Number(e.target.value),
                              })
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
                            Amount
                          </Typography>
                          <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatMoney(lineAmount(item, form.vatIncluded), form.currency)}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 2, sm: 1 }} sx={{ textAlign: 'right' }}>
                          <IconButton
                            onClick={() =>
                              updateGroup(groupIndex, {
                                items: group.items.filter((_, i) => i !== itemIndex),
                              })
                            }
                            disabled={group.items.length === 1}
                            aria-label="Remove line"
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
                          items: [...group.items, { ...emptyItem(), ...settings }],
                        })
                      }
                    >
                      Add line
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                      Subtotal {formatMoney(totals.groups[groupIndex]?.net ?? 0, form.currency)}
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
            Totals
          </Typography>
          <Stack spacing={1} sx={{ maxWidth: 380, ml: 'auto' }}>
            {multipleGroups &&
              totals.groups.map((group, i) => (
                <TotalsRow
                  key={i}
                  label={`Subtotal${group.title && group.showTitle ? ` - ${group.title}` : ''}`}
                  value={formatMoney(group.net, form.currency)}
                />
              ))}
            {hasAdjustments && <TotalsRow label="Subtotal" value={formatMoney(totals.net, form.currency)} />}
            {totals.discount > 0 && (
              <>
                <TotalsRow
                  label={`Discount ${form.discountPercent}%`}
                  value={`- ${formatMoney(totals.discount, form.currency)}`}
                />
                <TotalsRow label="Net total" value={formatMoney(totals.netAfterDiscount, form.currency)} />
              </>
            )}
            {totals.vatByRate.map((vat, i) => (
              <TotalsRow
                key={i}
                label={`VAT ${vat.rate}% (on ${formatMoney(vat.base, form.currency)})`}
                value={formatMoney(vat.amount, form.currency)}
              />
            ))}
            {totals.roundingAdjustment !== 0 && (
              <TotalsRow label="Rounding" value={formatMoney(totals.roundingAdjustment, form.currency)} />
            )}
            <Divider />
            <TotalsRow label="Total" value={formatMoney(totals.total, form.currency)} emphasize />
          </Stack>
        </CardContent>
      </Card>

      <Step
        title="Message & notes"
        summary={messageSummary}
        active={activeSection === 'message'}
        onToggle={(expanded) => setActiveSection(expanded ? 'message' : null)}
      >
        <>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                label="Message on the slip"
                value={form.message}
                onChange={(e) => update({ message: e.target.value.slice(0, MAX_MESSAGE_LENGTH) })}
                helperText={`${form.message.length}/${MAX_MESSAGE_LENGTH} - shown on the payment part.`}
                fullWidth
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Notes"
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
          bottom: 0,
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
              Total incl. VAT
            </Typography>
            <Typography variant="h6" lineHeight={1.2}>
              {formatMoney(totals.total, form.currency)}
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            onClick={save}
            disabled={busy || Boolean(referencePreview.error) || !form.debtor.name}
          >
            {busy ? 'Saving...' : invoiceId ? 'Save changes' : 'Create invoice'}
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
