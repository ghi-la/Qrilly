'use client';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { fetcher, formatDate, formatMoney, send } from '@/lib/client';
import { fillTemplate } from '@/lib/template';

interface InvoiceLike {
  _id: string;
  number: string;
  presetId: string;
  currency: 'CHF' | 'EUR';
  dueDate: string;
  debtor: { name: string; email?: string };
  creditor: { name: string };
  totals: { total: number };
}

export default function SendInvoiceDialog({
  open,
  invoice,
  onClose,
  onSent,
}: {
  open: boolean;
  invoice: InvoiceLike;
  onClose: () => void;
  onSent: () => void;
}) {
  const { data: preset } = useSWR<{ emailSubject: string; emailBody: string }>(
    open ? `/api/presets/${invoice.presetId}` : null,
    fetcher,
  );

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [markAsSent, setMarkAsSent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !preset) return;
    const values = {
      number: invoice.number,
      client: invoice.debtor?.name ?? '',
      creditor: invoice.creditor?.name ?? '',
      total: formatMoney(invoice.totals?.total ?? 0, invoice.currency),
      dueDate: formatDate(invoice.dueDate),
    };
    setTo(invoice.debtor?.email ?? '');
    setSubject(fillTemplate(preset.emailSubject ?? '', values));
    setBody(fillTemplate(preset.emailBody ?? '', values));
    setError(null);
  }, [open, preset, invoice]);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await send(`/api/invoices/${invoice._id}/send`, 'POST', { to, subject, body, markAsSent });
      onSent();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The invoice could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Email invoice {invoice.number}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Alert severity="info">The PDF is generated fresh and attached to this message.</Alert>
          <TextField
            label="To"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            fullWidth
          />
          <TextField
            label="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            multiline
            minRows={6}
            fullWidth
          />
          <FormControlLabel
            control={
              <Switch checked={markAsSent} onChange={(e) => setMarkAsSent(e.target.checked)} />
            }
            label="Mark the invoice as sent"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !to || !subject}>
          {busy ? 'Sending...' : 'Send'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
