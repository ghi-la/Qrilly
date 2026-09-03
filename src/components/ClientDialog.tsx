'use client';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { digitsOnly, houseNumberChars, send, withoutDigits } from '@/lib/client';

export interface ClientRecord {
  _id?: string;
  name: string;
  email: string;
  address: {
    street: string;
    buildingNumber: string;
    zip: string;
    city: string;
    country: string;
  };
  notes: string;
}

export const blankClient = (): ClientRecord => ({
  name: '',
  email: '',
  address: { street: '', buildingNumber: '', zip: '', city: '', country: 'CH' },
  notes: '',
});

export default function ClientDialog({
  open,
  client,
  onClose,
  onSaved,
}: {
  open: boolean;
  client: ClientRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ClientRecord>(blankClient);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(client ? { ...blankClient(), ...client } : blankClient());
      setError(null);
    }
  }, [open, client]);

  const updateAddress = (patch: Partial<ClientRecord['address']>) =>
    setForm((current) => ({ ...current, address: { ...current.address, ...patch } }));

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const payload = { ...form };
      delete (payload as { _id?: string })._id;
      if (client?._id) await send(`/api/clients/${client._id}`, 'PATCH', payload);
      else await send('/api/clients', 'POST', payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clientDialog.couldNotBeSaved'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{client?._id ? t('clientDialog.editTitle') : t('clientDialog.newTitle')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 7 }}>
              <TextField
                label={t('clientDialog.name')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                label={t('clientDialog.email')}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 8 }}>
              <TextField
                label={t('clientDialog.street')}
                value={form.address.street}
                onChange={(e) => updateAddress({ street: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                label={t('clientDialog.buildingNumber')}
                value={form.address.buildingNumber}
                onChange={(e) => updateAddress({ buildingNumber: houseNumberChars(e.target.value) })}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                label={t('clientDialog.zip')}
                value={form.address.zip}
                onChange={(e) => updateAddress({ zip: digitsOnly(e.target.value, 4) })}
                slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 4 } }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 8 }}>
              <TextField
                label={t('clientDialog.city')}
                value={form.address.city}
                onChange={(e) => updateAddress({ city: withoutDigits(e.target.value) })}
                fullWidth
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label={t('clientDialog.notes')}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                multiline
                minRows={2}
                fullWidth
              />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={save} disabled={busy || !form.name}>
          {busy ? t('common.saving') : t('clientDialog.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
