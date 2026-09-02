'use client';

import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { digitsOnly, fetcher, houseNumberChars, ibanChars, send, withoutDigits } from '@/lib/client';
import {
  CURRENCIES,
  QR_LANGUAGES,
  formatIban,
  isQrIban,
  isSwissIban,
  normalizeIban,
  type QrLanguage,
} from '@/lib/qrbill';
import { VAT_RATES } from '@/lib/totals';

export interface PresetRecord {
  _id?: string;
  name: string;
  isDefault: boolean;
  creditor: {
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
  iban: string;
  vatNumber: string;
  phone: string;
  website: string;
  logoFileId: string | null;
  referenceType: 'QRR' | 'SCOR' | 'NON';
  currency: 'CHF' | 'EUR';
  qrLanguage: 'DE' | 'FR' | 'IT' | 'EN';
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

export const blankPreset = (): PresetRecord => ({
  name: '',
  isDefault: false,
  creditor: {
    name: '',
    email: '',
    address: { street: '', buildingNumber: '', zip: '', city: '', country: 'CH' },
  },
  iban: '',
  vatNumber: '',
  phone: '',
  website: '',
  logoFileId: null,
  referenceType: 'NON',
  currency: 'CHF',
  qrLanguage: 'EN',
  invoicePrefix: `${new Date().getFullYear()}-`,
  nextNumber: 1,
  paymentTermDays: 30,
  defaultVatRate: 8.1,
  vatIncluded: false,
  roundTo5Cents: false,
  footerNote: '',
  emailSubject: 'Invoice {{number}} from {{creditor}}',
  emailBody:
    'Dear {{client}},\n\nPlease find invoice {{number}} attached, for {{total}}, due on {{dueDate}}.\n\nKind regards,\n{{creditor}}',
});

export default function PresetDialog({
  open,
  preset,
  onClose,
  onSaved,
}: {
  open: boolean;
  preset: PresetRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const [form, setForm] = useState<PresetRecord>(blankPreset);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A new preset starts in the app's language; editing an existing one never
  // touches its already-chosen language.
  const { data: settings } = useSWR<{ language: QrLanguage }>('/api/settings', fetcher);

  useEffect(() => {
    if (open) {
      setForm(
        preset
          ? { ...blankPreset(), ...preset }
          : { ...blankPreset(), qrLanguage: settings?.language ?? 'EN' },
      );
      setError(null);
    }
  }, [open, preset, settings]);

  const update = (patch: Partial<PresetRecord>) => setForm((current) => ({ ...current, ...patch }));
  const updateAddress = (patch: Partial<PresetRecord['creditor']['address']>) =>
    setForm((current) => ({
      ...current,
      creditor: { ...current.creditor, address: { ...current.creditor.address, ...patch } },
    }));

  // A QRR reference only exists for a QR-IBAN, so the reference type is kept
  // in sync with the account as it's typed rather than silently rewritten on
  // save, which left an intentional QRR choice reverted with no explanation.
  const updateIban = (value: string) =>
    setForm((current) => {
      const nextQrIban = isQrIban(value);
      return {
        ...current,
        iban: value,
        referenceType: nextQrIban
          ? 'QRR'
          : current.referenceType === 'QRR'
            ? 'NON'
            : current.referenceType,
      };
    });

  const ibanValid = !form.iban || isSwissIban(form.iban);
  const qrIban = isQrIban(form.iban);

  const uploadLogo = async (file: File) => {
    setError(null);
    const body = new FormData();
    body.append('file', file);
    const res = await fetch('/api/files', { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? 'The logo could not be uploaded.');
      return;
    }
    update({ logoFileId: data._id });
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      // The reference type is kept valid for the IBAN as both are edited
      // (see updateIban), so what's in the form is already what should save.
      const payload = { ...form, iban: normalizeIban(form.iban) };
      delete (payload as { _id?: string })._id;

      if (preset?._id) await send(`/api/presets/${preset._id}`, 'PATCH', payload);
      else await send('/api/presets', 'POST', payload);

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The preset could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <DialogTitle>{preset?._id ? 'Edit preset' : 'New preset'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                label="Preset name"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                helperText="Only you see this - e.g. 'Studio GmbH' or 'Freelance'."
                required
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isDefault}
                    onChange={(e) => update({ isDefault: e.target.checked })}
                  />
                }
                label="Use by default"
              />
            </Grid>

            <Grid size={12}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar
                  src={form.logoFileId ? `/api/files/${form.logoFileId}` : undefined}
                  variant="rounded"
                  sx={{ width: 64, height: 64, bgcolor: 'action.hover' }}
                >
                  {form.name.slice(0, 1).toUpperCase()}
                </Avatar>
                <Box>
                  <Button component="label" size="small" variant="outlined">
                    Upload logo
                    <input
                      hidden
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadLogo(file);
                      }}
                    />
                  </Button>
                  {form.logoFileId && (
                    <Button size="small" onClick={() => update({ logoFileId: null })} sx={{ ml: 1 }}>
                      Remove
                    </Button>
                  )}
                  <Typography variant="caption" display="block" color="text.secondary">
                    PNG, JPEG or WebP, up to 600 KB.
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          </Grid>

          <Divider textAlign="left">
            <Typography variant="overline">Creditor</Typography>
          </Divider>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Business or person"
                value={form.creditor.name}
                onChange={(e) =>
                  update({ creditor: { ...form.creditor, name: e.target.value } })
                }
                required
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Email"
                type="email"
                value={form.creditor.email}
                onChange={(e) => update({ creditor: { ...form.creditor, email: e.target.value } })}
                helperText="Used as the reply-to address on sent invoices."
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 8, md: 5 }}>
              <TextField
                label="Street"
                value={form.creditor.address.street}
                onChange={(e) => updateAddress({ street: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 4, md: 2 }}>
              <TextField
                label="No."
                value={form.creditor.address.buildingNumber}
                onChange={(e) => updateAddress({ buildingNumber: houseNumberChars(e.target.value) })}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 4, md: 2 }}>
              <TextField
                label="ZIP"
                value={form.creditor.address.zip}
                onChange={(e) => updateAddress({ zip: digitsOnly(e.target.value, 4) })}
                slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 4 } }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 8, md: 3 }}>
              <TextField
                label="City"
                value={form.creditor.address.city}
                onChange={(e) => updateAddress({ city: withoutDigits(e.target.value) })}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="IBAN or QR-IBAN"
                value={form.iban}
                onChange={(e) => updateIban(ibanChars(e.target.value))}
                error={!ibanValid}
                helperText={
                  !ibanValid
                    ? 'That is not a valid Swiss or Liechtenstein IBAN.'
                    : form.iban
                      ? `${formatIban(form.iban)}${qrIban ? ' - QR-IBAN, QRR reference required' : ''}`
                      : 'CH or LI account the money is paid into.'
                }
                required
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="VAT number"
                value={form.vatNumber}
                onChange={(e) => update({ vatNumber: e.target.value })}
                placeholder="CHE-123.456.789 MWST"
                fullWidth
              />
            </Grid>
          </Grid>

          <Divider textAlign="left">
            <Typography variant="overline">Invoice defaults</Typography>
          </Divider>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                select
                label="Reference type"
                value={form.referenceType}
                onChange={(e) => update({ referenceType: e.target.value as PresetRecord['referenceType'] })}
                disabled={qrIban}
                helperText={
                  qrIban
                    ? 'This account uses a QR-IBAN, so QRR is required.'
                    : !ibanValid || !form.iban
                      ? undefined
                      : 'QRR needs a QR-IBAN (institution id 30000-31999); use SCOR or none here.'
                }
                fullWidth
              >
                <MenuItem value="QRR" disabled={!qrIban}>
                  QRR
                </MenuItem>
                <MenuItem value="SCOR" disabled={qrIban}>
                  SCOR
                </MenuItem>
                <MenuItem value="NON" disabled={qrIban}>
                  None
                </MenuItem>
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
                label="Language"
                value={form.qrLanguage}
                onChange={(e) => update({ qrLanguage: e.target.value as PresetRecord['qrLanguage'] })}
                helperText="Used for this account's bills and its QR slip."
                fullWidth
              >
                {QR_LANGUAGES.map((language) => (
                  <MenuItem key={language} value={language}>
                    {language}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                select
                label="Default VAT"
                value={form.defaultVatRate}
                onChange={(e) => update({ defaultVatRate: Number(e.target.value) })}
                fullWidth
              >
                {VAT_RATES.map((rate) => (
                  <MenuItem key={rate} value={rate}>
                    {rate}%
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 6, md: 4 }}>
              <TextField
                label="Number prefix"
                value={form.invoicePrefix}
                onChange={(e) => update({ invoicePrefix: e.target.value })}
                helperText={`Next: ${form.invoicePrefix}${String(form.nextNumber).padStart(4, '0')}`}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <TextField
                label="Next number"
                type="number"
                value={form.nextNumber}
                onChange={(e) => update({ nextNumber: Number(e.target.value) })}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Payment term (days)"
                type="number"
                value={form.paymentTermDays}
                onChange={(e) => update({ paymentTermDays: Number(e.target.value) })}
                fullWidth
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
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
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.roundTo5Cents}
                    onChange={(e) => update({ roundTo5Cents: e.target.checked })}
                  />
                }
                label="Round totals to 0.05"
              />
            </Grid>

            <Grid size={12}>
              <TextField
                label="Footer note"
                value={form.footerNote}
                onChange={(e) => update({ footerNote: e.target.value })}
                multiline
                minRows={2}
                helperText="Printed at the bottom of every invoice from this preset."
                fullWidth
              />
            </Grid>
          </Grid>

          <Divider textAlign="left">
            <Typography variant="overline">Email template</Typography>
          </Divider>

          <Stack spacing={2}>
            <TextField
              label="Subject"
              value={form.emailSubject}
              onChange={(e) => update({ emailSubject: e.target.value })}
              fullWidth
            />
            <TextField
              label="Body"
              value={form.emailBody}
              onChange={(e) => update({ emailBody: e.target.value })}
              multiline
              minRows={4}
              helperText="Placeholders: {{number}}, {{client}}, {{creditor}}, {{total}}, {{dueDate}}"
              fullWidth
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={busy || !form.name || !form.creditor.name || !ibanValid || !form.iban}
        >
          {busy ? 'Saving...' : 'Save preset'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
