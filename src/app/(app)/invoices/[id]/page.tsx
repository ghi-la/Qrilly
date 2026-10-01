'use client';

import { Alert, Button, Chip, CircularProgress, Stack } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import SendIcon from '@mui/icons-material/Send';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import InvoiceEditor from '@/components/InvoiceEditor';
import SendInvoiceDialog from '@/components/SendInvoiceDialog';
import DeleteInvoiceDialog, { type DeleteChoices } from '@/components/DeleteInvoiceDialog';
import { ConfirmDialog, Loading, PageHeader } from '@/components/ui';
import { fetcher, send } from '@/lib/client';

const STATUS_COLOR: Record<string, 'default' | 'primary' | 'success' | 'warning'> = {
  draft: 'default',
  sent: 'primary',
  paid: 'success',
  canceled: 'warning',
};

export default function InvoicePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: invoice, mutate, isLoading } = useSWR(`/api/invoices/${id}`, fetcher);
  const [sendOpen, setSendOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const STATUS_LABEL: Record<string, string> = {
    draft: t('invoices.statusLabel.draft'),
    sent: t('invoices.statusLabel.sent'),
    paid: t('invoices.statusLabel.paid'),
    canceled: t('invoices.statusLabel.canceled'),
  };

  if (isLoading || !invoice) return <Loading label={t('invoices.loadingInvoice')} />;

  const markPaid = async () => {
    setPaying(true);
    try {
      await send(`/api/invoices/${id}`, 'PATCH', { status: 'paid' });
      await mutate();
    } finally {
      setPaying(false);
    }
  };

  const cancelInvoice = async () => {
    setBusy(true);
    try {
      await send(`/api/invoices/${id}`, 'PATCH', { status: 'canceled' });
      setCancelOpen(false);
      await mutate();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (choices: DeleteChoices) => {
    setBusy(true);
    try {
      const result = await send(`/api/invoices/${id}`, 'DELETE', choices);
      if (result.notified === false) {
        window.alert(t('invoices.notifyFailed', { error: result.notifyError }));
      }
      router.push('/invoices');
      router.refresh();
    } catch (err) {
      setBusy(false);
      throw err;
    }
  };

  return (
    <>
      <PageHeader
        title={t('invoices.invoiceWithNumber', { number: invoice.number })}
        subtitle={invoice.debtor?.name}
        action={
          <Chip
            label={STATUS_LABEL[invoice.status] ?? invoice.status}
            color={STATUS_COLOR[invoice.status] ?? 'default'}
          />
        }
      />

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          href={`/api/invoices/${id}/pdf`}
        >
          {t('invoices.downloadPdf')}
        </Button>
        <Button
          variant="outlined"
          startIcon={<VisibilityIcon />}
          href={`/api/invoices/${id}/pdf?inline=1`}
          target="_blank"
          rel="noopener"
        >
          {t('invoices.preview')}
        </Button>
        {invoice.status !== 'canceled' && (
          <Button variant="outlined" startIcon={<SendIcon />} onClick={() => setSendOpen(true)}>
            {t('invoices.email')}
          </Button>
        )}
        {(invoice.status === 'draft' || invoice.status === 'sent') && (
          <Button variant="outlined" color="success" startIcon={paying ? <CircularProgress size={16} color="inherit" /> : <TaskAltIcon />}
            onClick={markPaid}
            disabled={paying}
          >
            {t('invoices.markPaid')}
          </Button>
        )}
        {invoice.status !== 'paid' && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setConfirmOpen(true)}
          >
            {t('invoices.delete')}
          </Button>
        )}
        {invoice.status === 'sent' && (
          <Button variant="outlined" color="error" startIcon={<BlockIcon />} onClick={() => setCancelOpen(true)}>
            {t('invoices.cancel')}
          </Button>
        )}
      </Stack>

      {invoice.status === 'draft' ? (
        <InvoiceEditor invoiceId={id} />
      ) : (
        <Alert severity="info">{t('invoices.lockedNotice')}</Alert>
      )}

      <SendInvoiceDialog
        open={sendOpen}
        invoice={{ ...invoice, _id: id }}
        onClose={() => setSendOpen(false)}
        onSent={() => mutate()}
      />
      <DeleteInvoiceDialog
        open={confirmOpen}
        invoice={invoice}
        busy={busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
      <ConfirmDialog
        open={cancelOpen}
        title={t('invoices.cancelConfirmTitle')}
        message={t('invoices.cancelConfirmMessage')}
        confirmLabel={t('invoices.cancelConfirmLabel')}
        cancelLabel={t('invoices.keepInvoice')}
        busy={busy}
        onClose={() => setCancelOpen(false)}
        onConfirm={cancelInvoice}
      />
    </>
  );
}
