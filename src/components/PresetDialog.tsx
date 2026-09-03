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
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { digitsOnly, fetcher, houseNumberChars, ibanChars, send, withoutDigits } from '@/lib/client';
import { isSupportedLanguage, type SupportedLanguage } from '@/lib/i18n';
import { DecimalField } from './ui';
import {
  CURRENCIES,
  QR_LANGUAGES,
  formatIban,
  isQrIban,
  isSwissIban,
  normalizeIban,
  type QrLanguage,
} from '@/lib/qrbill';
import { UNIT_SUGGESTIONS, VAT_RATES } from '@/lib/totals';

export interface PresetLineGroup {
  name: string;
  unit: string;
  unitPrice: number;
  vatRate: number;
}

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
  lineGroups: PresetLineGroup[];
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
  lineGroups: [],
});

// Actual message text sent to clients, so it follows the account's language
// like the rest of the preset's bill content - not routed through i18next,
// since these strings' {{placeholders}} must stay literal for fillTemplate().
const DEFAULT_EMAIL_TEMPLATE: Record<SupportedLanguage, { subject: string; body: string }> = {
  en: {
    subject: 'Invoice {{number}} from {{creditor}}',
    body: 'Dear {{client}},\n\nPlease find invoice {{number}} attached, for {{total}}, due on {{dueDate}}.\n\nKind regards,\n{{creditor}}',
  },
  it: {
    subject: 'Fattura {{number}} da {{creditor}}',
    body: 'Gentile {{client}},\n\nIn allegato la fattura {{number}}, per un importo di {{total}}, con scadenza {{dueDate}}.\n\nCordiali saluti,\n{{creditor}}',
  },
};

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
  const { t } = useTranslation();
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
      const templateLang = settings?.language?.toLowerCase() ?? 'en';
      const template = DEFAULT_EMAIL_TEMPLATE[isSupportedLanguage(templateLang) ? templateLang : 'en'];
      setForm(
        preset
          ? { ...blankPreset(), ...preset }
          : {
              ...blankPreset(),
              qrLanguage: settings?.language ?? 'EN',
              emailSubject: template.subject,
              emailBody: template.body,
            },
      );
      setError(null);
    }
  }, [open, preset, settings]);

  const update = (patch: Partial<PresetRecord>) => setForm((current) => ({ ...current, ...patch }));

  // Every invoice created from this preset starts with one group per entry
  // here, each pre-filled with its own unit, price and VAT rate - an "Extra"
  // group (no unit/price/VAT, just a description and amount) is always
  // offered on top, so it's not something a preset needs to define.
  // These read the array from the functional setState updater rather than
  // the `form` closure - with the closure, several fast keystrokes fired
  // before a re-render each computed their patch against the same stale
  // array, so quick typing silently dropped or corrupted edits.
  const addLineGroup = () =>
    setForm((current) => ({
      ...current,
      lineGroups: [
        ...current.lineGroups,
        { name: '', unit: 'pcs', unitPrice: 0, vatRate: current.defaultVatRate },
      ],
    }));

  const updateLineGroup = (index: number, patch: Partial<PresetLineGroup>) =>
    setForm((current) => ({
      ...current,
      lineGroups: current.lineGroups.map((group, i) => (i === index ? { ...group, ...patch } : group)),
    }));

  const removeLineGroup = (index: number) =>
    setForm((current) => ({
      ...current,
      lineGroups: current.lineGroups.filter((_, i) => i !== index),
    }));

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
      setError(data.error ?? t('presetDialog.logoUploadFailed'));
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
      setError(err instanceof Error ? err.message : t('presetDialog.couldNotBeSaved'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <DialogTitle>{preset?._id ? t('presetDialog.editTitle') : t('presetDialog.newTitle')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                label={t('presetDialog.presetName')}
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                helperText={t('presetDialog.presetNameHelper')}
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
                label={t('presetDialog.useByDefault')}
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
                    {t('presetDialog.uploadLogo')}
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
                      {t('presetDialog.removeLogo')}
                    </Button>
                  )}
                  <Typography variant="caption" display="block" color="text.secondary">
                    {t('presetDialog.logoHint')}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          </Grid>

          <Divider textAlign="left">
            <Typography variant="overline">{t('presetDialog.creditorSection')}</Typography>
          </Divider>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label={t('presetDialog.businessOrPerson')}
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
                label={t('presetDialog.email')}
                type="email"
                value={form.creditor.email}
                onChange={(e) => update({ creditor: { ...form.creditor, email: e.target.value } })}
                helperText={t('presetDialog.emailHelper')}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 8, md: 5 }}>
              <TextField
                label={t('presetDialog.street')}
                value={form.creditor.address.street}
                onChange={(e) => updateAddress({ street: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 4, md: 2 }}>
              <TextField
                label={t('presetDialog.buildingNumber')}
                value={form.creditor.address.buildingNumber}
                onChange={(e) => updateAddress({ buildingNumber: houseNumberChars(e.target.value) })}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 4, md: 2 }}>
              <TextField
                label={t('presetDialog.zip')}
                value={form.creditor.address.zip}
                onChange={(e) => updateAddress({ zip: digitsOnly(e.target.value, 4) })}
                slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 4 } }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 8, md: 3 }}>
              <TextField
                label={t('presetDialog.city')}
                value={form.creditor.address.city}
                onChange={(e) => updateAddress({ city: withoutDigits(e.target.value) })}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label={t('presetDialog.ibanLabel')}
                value={form.iban}
                onChange={(e) => updateIban(ibanChars(e.target.value))}
                error={!ibanValid}
                helperText={
                  !ibanValid
                    ? t('presetDialog.ibanInvalid')
                    : form.iban
                      ? qrIban
                        ? t('presetDialog.ibanHintQr', { iban: formatIban(form.iban) })
                        : formatIban(form.iban)
                      : t('presetDialog.ibanHintDefault')
                }
                required
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label={t('presetDialog.vatNumber')}
                value={form.vatNumber}
                onChange={(e) => update({ vatNumber: e.target.value })}
                placeholder="CHE-123.456.789 MWST"
                fullWidth
              />
            </Grid>
          </Grid>

          <Divider textAlign="left">
            <Typography variant="overline">{t('presetDialog.invoiceDefaultsSection')}</Typography>
          </Divider>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                select
                label={t('presetDialog.referenceType')}
                value={form.referenceType}
                onChange={(e) => update({ referenceType: e.target.value as PresetRecord['referenceType'] })}
                disabled={qrIban}
                helperText={
                  qrIban
                    ? t('presetDialog.referenceTypeHintQrIban')
                    : !ibanValid || !form.iban
                      ? undefined
                      : t('presetDialog.referenceTypeHintOther')
                }
                fullWidth
              >
                <MenuItem value="QRR" disabled={!qrIban}>
                  {t('presetDialog.referenceQrr')}
                </MenuItem>
                <MenuItem value="SCOR" disabled={qrIban}>
                  {t('presetDialog.referenceScor')}
                </MenuItem>
                <MenuItem value="NON" disabled={qrIban}>
                  {t('presetDialog.referenceNone')}
                </MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                select
                label={t('presetDialog.currency')}
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
                label={t('presetDialog.language')}
                value={form.qrLanguage}
                onChange={(e) => update({ qrLanguage: e.target.value as PresetRecord['qrLanguage'] })}
                helperText={t('presetDialog.languageHelper')}
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
                label={t('presetDialog.defaultVat')}
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
                label={t('presetDialog.numberPrefix')}
                value={form.invoicePrefix}
                onChange={(e) => update({ invoicePrefix: e.target.value })}
                helperText={t('presetDialog.numberPrefixHelper', {
                  next: `${form.invoicePrefix}${String(form.nextNumber).padStart(4, '0')}`,
                })}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <TextField
                label={t('presetDialog.nextNumber')}
                type="number"
                value={form.nextNumber}
                onChange={(e) => update({ nextNumber: Number(e.target.value) })}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label={t('presetDialog.paymentTermDays')}
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
                label={t('presetDialog.pricesIncludeVat')}
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
                label={t('presetDialog.roundTotals')}
              />
            </Grid>

            <Grid size={12}>
              <TextField
                label={t('presetDialog.footerNote')}
                value={form.footerNote}
                onChange={(e) => update({ footerNote: e.target.value })}
                multiline
                minRows={2}
                helperText={t('presetDialog.footerNoteHelper')}
                fullWidth
              />
            </Grid>
          </Grid>

          <Divider textAlign="left">
            <Typography variant="overline">{t('presetDialog.lineItemGroupsSection')}</Typography>
          </Divider>

          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {t('presetDialog.lineItemGroupsIntro')}
            </Typography>

            <Stack spacing={1.5}>
              {form.lineGroups.map((group, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 1.5 }}>
                  <Grid container spacing={1.5} alignItems="center">
                    <Grid size={{ xs: 12, sm: 5 }}>
                      <TextField
                        label={t('presetDialog.groupName')}
                        placeholder={t('presetDialog.groupNamePlaceholder')}
                        value={group.name}
                        onChange={(e) => updateLineGroup(index, { name: e.target.value })}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 4, sm: 2 }}>
                      <TextField
                        select
                        label={t('presetDialog.unit')}
                        value={group.unit}
                        onChange={(e) => updateLineGroup(index, { unit: e.target.value })}
                        fullWidth
                      >
                        {[...new Set([group.unit, ...UNIT_SUGGESTIONS])]
                          .filter(Boolean)
                          .map((unit) => (
                            <MenuItem key={unit} value={unit}>
                              {unit}
                            </MenuItem>
                          ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 4, sm: 2 }}>
                      <DecimalField
                        label={t('presetDialog.unitPrice')}
                        value={group.unitPrice}
                        onChange={(value) => updateLineGroup(index, { unitPrice: value })}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 3, sm: 2 }}>
                      <TextField
                        select
                        label={t('presetDialog.vat')}
                        value={group.vatRate}
                        onChange={(e) => updateLineGroup(index, { vatRate: Number(e.target.value) })}
                        fullWidth
                      >
                        {[...new Set([group.vatRate, ...VAT_RATES])]
                          .sort((a, b) => a - b)
                          .map((rate) => (
                            <MenuItem key={rate} value={rate}>
                              {rate}%
                            </MenuItem>
                          ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 1 }} sx={{ textAlign: 'right' }}>
                      <IconButton onClick={() => removeLineGroup(index)} aria-label={t('invoiceEditor.removeGroup')}>
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                </Paper>
              ))}
            </Stack>

            <Button
              startIcon={<AddIcon />}
              variant="outlined"
              onClick={addLineGroup}
              sx={{ alignSelf: 'flex-start' }}
            >
              {t('presetDialog.addGroup')}
            </Button>
          </Stack>

          <Divider textAlign="left">
            <Typography variant="overline">{t('presetDialog.emailTemplateSection')}</Typography>
          </Divider>

          <Stack spacing={2}>
            <TextField
              label={t('presetDialog.subject')}
              value={form.emailSubject}
              onChange={(e) => update({ emailSubject: e.target.value })}
              fullWidth
            />
            <TextField
              label={t('presetDialog.body')}
              value={form.emailBody}
              onChange={(e) => update({ emailBody: e.target.value })}
              multiline
              minRows={4}
              helperText={t('presetDialog.bodyHelper')}
              fullWidth
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={
            busy ||
            !form.name ||
            !form.creditor.name ||
            !ibanValid ||
            !form.iban ||
            form.lineGroups.some((group) => !group.name.trim())
          }
        >
          {busy ? t('common.saving') : t('presetDialog.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
