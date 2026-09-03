'use client';

import { Button, Chip, Stack } from '@mui/material';
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

  const STATUS_LABEL: Record<string, string> = {
    draft: t('invoices.statusLabel.draft'),
    sent: t('invoices.statusLabel.sent'),
    paid: t('invoices.statusLabel.paid'),
    canceled: t('invoices.statusLabel.canceled'),
  };

  if (isLoading || !invoice) return <Loading label={t('invoices.loadingInvoice')} />;

  const markPaid = async () => {
    await send(`/api/invoices/${id}`, 'PATCH', { status: 'paid' });
    void mutate();
  };

  const remove = async () => {
    setBusy(true);
    try {
      await send(`/api/invoices/${id}`, 'DELETE');
      router.push('/invoices');
      router.refresh();
    } finally {
      setBusy(false);
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
        <Button variant="outlined" startIcon={<SendIcon />} onClick={() => setSendOpen(true)}>
          {t('invoices.email')}
        </Button>
        {invoice.status !== 'paid' && (
          <Button variant="outlined" color="success" startIcon={<TaskAltIcon />} onClick={markPaid}>
            {t('invoices.markPaid')}
          </Button>
        )}
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          onClick={() => setConfirmOpen(true)}
        >
          {t('invoices.delete')}
        </Button>
      </Stack>

      <InvoiceEditor invoiceId={id} />

      <SendInvoiceDialog
        open={sendOpen}
        invoice={{ ...invoice, _id: id }}
        onClose={() => setSendOpen(false)}
        onSent={() => mutate()}
      />
      <ConfirmDialog
        open={confirmOpen}
        title={t('invoices.deleteConfirmTitle')}
        message={t('invoices.deleteConfirmMessage')}
        busy={busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </>
  );
}
