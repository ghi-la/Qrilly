'use client';

import { Button, Card, CardContent, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { InvoiceCardData } from '@/components/InvoiceCard';
import { ConfirmDialog } from '@/components/ui';
import { formatDate, formatMoney, send } from '@/lib/client';
import { TRASH_MS } from '@/lib/trash';

export default function TrashedInvoiceCard({
  invoice,
  onChanged,
}: {
  invoice: InvoiceCardData;
  onChanged: () => void | Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [restoring, setRestoring] = useState(false);
  const [foreverOpen, setForeverOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const msLeft = new Date(invoice.deletedAt ?? Date.now()).getTime() + TRASH_MS - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000));

  const restore = async () => {
    setRestoring(true);
    try {
      const result = await send(`/api/invoices/${invoice._id}/restore`, 'POST');
      if (result.hoursLost > 0) window.alert(t('invoices.restoredLostHours', { count: result.hoursLost }));
      await onChanged();
    } finally {
      setRestoring(false);
    }
  };

  const deleteForever = async () => {
    setBusy(true);
    try {
      await send(`/api/invoices/${invoice._id}?permanent=1`, 'DELETE');
      setForeverOpen(false);
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card sx={{ opacity: 0.9 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
            <Stack sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" noWrap>
                {invoice.debtor?.name || t('invoiceCard.untitledClient')}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {invoice.number} - {t('invoiceCard.issued', { date: formatDate(invoice.issueDate) })} -{' '}
                {formatMoney(invoice.totals?.total ?? 0, invoice.currency)}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip size="small" color="warning" label={t('invoices.daysLeft', { count: daysLeft })} />
              <Button
                size="small"
                variant="outlined"
                onClick={restore}
                disabled={restoring}
                startIcon={restoring ? <CircularProgress size={14} color="inherit" /> : <RestoreFromTrashIcon />}
              >
                {t('invoices.restore')}
              </Button>
              <Button
                size="small"
                color="error"
                onClick={() => setForeverOpen(true)}
                startIcon={<DeleteForeverIcon />}
              >
                {t('invoices.deleteForever')}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={foreverOpen}
        title={t('invoices.deleteForeverTitle')}
        message={t('invoices.deleteForeverMessage')}
        confirmLabel={t('invoices.deleteForever')}
        busy={busy}
        onClose={() => setForeverOpen(false)}
        onConfirm={deleteForever}
      />
    </>
  );
}
