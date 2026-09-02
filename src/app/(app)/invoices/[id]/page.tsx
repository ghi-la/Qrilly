'use client';

import { Button, Chip, Stack } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import SendIcon from '@mui/icons-material/Send';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
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
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: invoice, mutate, isLoading } = useSWR(`/api/invoices/${id}`, fetcher);
  const [sendOpen, setSendOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isLoading || !invoice) return <Loading label="Loading invoice..." />;

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
        title={`Invoice ${invoice.number}`}
        subtitle={invoice.debtor?.name}
        action={<Chip label={invoice.status} color={STATUS_COLOR[invoice.status] ?? 'default'} />}
      />

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          href={`/api/invoices/${id}/pdf`}
        >
          Download PDF
        </Button>
        <Button
          variant="outlined"
          startIcon={<VisibilityIcon />}
          href={`/api/invoices/${id}/pdf?inline=1`}
          target="_blank"
          rel="noopener"
        >
          Preview
        </Button>
        <Button variant="outlined" startIcon={<SendIcon />} onClick={() => setSendOpen(true)}>
          Email
        </Button>
        {invoice.status !== 'paid' && (
          <Button variant="outlined" color="success" startIcon={<TaskAltIcon />} onClick={markPaid}>
            Mark paid
          </Button>
        )}
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          onClick={() => setConfirmOpen(true)}
        >
          Delete
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
        title="Delete this invoice?"
        message="The record and everything needed to rebuild its PDF are removed. This cannot be undone."
        busy={busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </>
  );
}
